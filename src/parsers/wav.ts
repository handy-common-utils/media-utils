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
  const audioFormat = fmtData[0] | (fmtData[1] << 8);
  const channelCount = fmtData[2] | (fmtData[3] << 8);
  const sampleRate = fmtData[4] | (fmtData[5] << 8) | (fmtData[6] << 16) | (fmtData[7] << 24);
  const byteRate = fmtData[8] | (fmtData[9] << 8) | (fmtData[10] << 16) | (fmtData[11] << 24);
  const _blockAlign = fmtData[12] | (fmtData[13] << 8);
  const bitsPerSample = fmtData[14] | (fmtData[15] << 8);

  // Determine codec
  let codec = 'pcm_s16le';
  let codecDetail = `pcm_s${bitsPerSample}le`;

  if (audioFormat !== 1) {
    // Not PCM
    codecDetail = `unknown_0x${audioFormat.toString(16)}`;
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
    durationInSeconds,
  };

  return {
    container: 'wav',
    containerDetail: 'wav',
    durationInSeconds,
    videoStreams: [],
    audioStreams: [audioStream],
  };
}
