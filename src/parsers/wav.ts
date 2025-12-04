import { GetMediaInfoOptions } from '../get-media-info';
import { AudioStreamInfo, MediaInfo } from '../media-info';
import { readBeginning, UnsupportedFormatError } from '../utils';

/**
 * Parses WAV file from a stream and extracts media information.
 * WAV files use RIFF container format with simple header structure.
 *
 * @param stream The input media stream
 * @param _options Optional options for the parser
 * @returns Media information without the parser field
 * @throws UnsupportedFormatError if the stream is not a valid WAV file
 */
export async function parseWav(stream: ReadableStream<Uint8Array>, _options?: GetMediaInfoOptions): Promise<Omit<MediaInfo, 'parser'>> {
  const reader = stream.getReader();
  const buffer = await readBeginning(reader);

  if (!buffer || buffer.length < 44) {
    throw new UnsupportedFormatError('Not a WAV file: insufficient data');
  }

  // Check RIFF header
  if (buffer[0] !== 0x52 || buffer[1] !== 0x49 || buffer[2] !== 0x46 || buffer[3] !== 0x46) {
    // "RIFF"
    throw new UnsupportedFormatError('Not a WAV file: missing RIFF header');
  }

  // Check WAVE format
  if (buffer[8] !== 0x57 || buffer[9] !== 0x41 || buffer[10] !== 0x56 || buffer[11] !== 0x45) {
    // "WAVE"
    throw new UnsupportedFormatError('Not a WAV file: missing WAVE format');
  }

  // Find fmt chunk
  let fmtOffset = 12;
  while (fmtOffset < buffer.length - 8) {
    // eslint-disable-next-line unicorn/prefer-code-point
    const chunkId = String.fromCharCode(buffer[fmtOffset], buffer[fmtOffset + 1], buffer[fmtOffset + 2], buffer[fmtOffset + 3]);
    const chunkSize = buffer[fmtOffset + 4] | (buffer[fmtOffset + 5] << 8) | (buffer[fmtOffset + 6] << 16) | (buffer[fmtOffset + 7] << 24);

    if (chunkId === 'fmt ') {
      break;
    }

    fmtOffset += 8 + chunkSize;
  }

  if (fmtOffset >= buffer.length - 8) {
    throw new UnsupportedFormatError('Not a WAV file: missing fmt chunk');
  }

  // Parse fmt chunk (must be at least 16 bytes)
  const fmtChunkSize = buffer[fmtOffset + 4] | (buffer[fmtOffset + 5] << 8) | (buffer[fmtOffset + 6] << 16) | (buffer[fmtOffset + 7] << 24);
  if (fmtChunkSize < 16 || fmtOffset + 8 + 16 > buffer.length) {
    throw new UnsupportedFormatError('Not a WAV file: invalid fmt chunk');
  }

  const fmtData = buffer.subarray(fmtOffset + 8, fmtOffset + 8 + fmtChunkSize);

  // Parse fmt chunk fields (little-endian)
  // These are STREAM LEVEL properties — constant for the entire audio stream
  const audioFormat = fmtData[0] | (fmtData[1] << 8); // formatTag (wFormatTag)
  const channelCount = fmtData[2] | (fmtData[3] << 8);
  const sampleRate = fmtData[4] | (fmtData[5] << 8) | (fmtData[6] << 16) | (fmtData[7] << 24);
  const byteRate = fmtData[8] | (fmtData[9] << 8) | (fmtData[10] << 16) | (fmtData[11] << 24);
  const blockAlign = fmtData[12] | (fmtData[13] << 8); // nBlockAlign (STREAM LEVEL)
  const bitsPerSample = fmtData[14] | (fmtData[15] << 8);

  // Parse extra data for ADPCM formats
  let samplesPerBlock: number | undefined;
  if (fmtChunkSize >= 20 && audioFormat === 0x0002) {
    // MS ADPCM has extra data:
    // cbSize (2 bytes) + samplesPerBlock (2 bytes) + numCoef (2 bytes) + coefficients
    // samplesPerBlock is at offset 18 (after the 16-byte base WAVEFORMATEX + 2-byte cbSize)
    samplesPerBlock = fmtData[18] | (fmtData[19] << 8);
  }

  // Determine codec
  let codec = 'unknown';
  let codecDetail = `unknown_0x${audioFormat.toString(16)}`;

  switch (audioFormat) {
    case 0x0001: {
      // PCM
      switch (bitsPerSample) {
        case 8: {
          codec = 'pcm_u8';
          codecDetail = 'pcm_u8';
          break;
        }
        case 16: {
          codec = 'pcm_s16le';
          codecDetail = 'pcm_s16le';
          break;
        }
        case 24: {
          codec = 'pcm_s24le';
          codecDetail = 'pcm_s24le';
          break;
        }
        case 32: {
          codec = 'pcm_s32le';
          codecDetail = 'pcm_s32le';
          break;
        }
        default: {
          codec = 'pcm_s16le';
          codecDetail = `pcm_s${bitsPerSample}le`;
        }
      }
      break;
    }
    case 0x0002: {
      // MS ADPCM
      codec = 'adpcm_ms';
      codecDetail = 'adpcm_ms';
      break;
    }
    case 0x0003: {
      // IEEE Float
      codec = 'pcm_f32le';
      codecDetail = 'pcm_f32le';
      break;
    }
    case 0x0006: {
      // ALAW
      codec = 'pcm_alaw';
      codecDetail = 'pcm_alaw';
      break;
    }
    case 0x0007: {
      // MULAW
      codec = 'pcm_mulaw';
      codecDetail = 'pcm_mulaw';
      break;
    }
    case 0x0011: {
      // IMA ADPCM
      codec = 'adpcm_ima_wav';
      codecDetail = 'adpcm_ima_wav';
      break;
    }
    default: {
      if (audioFormat === 0xfffe) {
        // WAVE_FORMAT_EXTENSIBLE - tricky, depends on SubFormat
        codec = 'pcm_s16le'; // Fallback
        codecDetail = 'wave_format_extensible';
      }
    }
  }

  // Find data chunk to calculate duration
  let dataOffset = fmtOffset + 8 + fmtChunkSize;
  let dataSize = 0;

  while (dataOffset < buffer.length - 8) {
    // eslint-disable-next-line unicorn/prefer-code-point
    const chunkId = String.fromCharCode(buffer[dataOffset], buffer[dataOffset + 1], buffer[dataOffset + 2], buffer[dataOffset + 3]);
    const chunkSize = buffer[dataOffset + 4] | (buffer[dataOffset + 5] << 8) | (buffer[dataOffset + 6] << 16) | (buffer[dataOffset + 7] << 24);

    if (chunkId === 'data') {
      dataSize = chunkSize;
      break;
    }

    dataOffset += 8 + chunkSize;
  }

  // Calculate duration
  const durationInSeconds = byteRate > 0 ? dataSize / byteRate : undefined;

  const audioStream: AudioStreamInfo = {
    id: 1,
    codec: codec as any,
    codecDetail,
    channelCount,
    sampleRate,
    bitrate: byteRate * 8,
    bitsPerSample,
    durationInSeconds,
    // Expose codec-specific details (STREAM LEVEL properties)
    codecDetails: {
      formatTag: audioFormat,
      blockAlign,
      samplesPerBlock,
    },
  };

  return {
    container: 'wav',
    containerDetail: 'wav',
    durationInSeconds,
    videoStreams: [],
    audioStreams: [audioStream],
  };
}
