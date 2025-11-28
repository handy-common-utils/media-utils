import { GetMediaInfoOptions } from '../get-media-info';
import { AudioStreamInfo, MediaInfo } from '../media-info';
import { UnsupportedFormatError } from '../utils';

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
  const { done, value } = await reader.read();
  reader.cancel();

  if (done || !value || value.length < 44) {
    throw new UnsupportedFormatError('Not a WAV file: insufficient data');
  }

  // Check RIFF header
  if (value[0] !== 0x52 || value[1] !== 0x49 || value[2] !== 0x46 || value[3] !== 0x46) {
    // "RIFF"
    throw new UnsupportedFormatError('Not a WAV file: missing RIFF header');
  }

  // Check WAVE format
  if (value[8] !== 0x57 || value[9] !== 0x41 || value[10] !== 0x56 || value[11] !== 0x45) {
    // "WAVE"
    throw new UnsupportedFormatError('Not a WAV file: missing WAVE format');
  }

  // Find fmt chunk
  let fmtOffset = 12;
  while (fmtOffset < value.length - 8) {
    // eslint-disable-next-line unicorn/prefer-code-point
    const chunkId = String.fromCharCode(value[fmtOffset], value[fmtOffset + 1], value[fmtOffset + 2], value[fmtOffset + 3]);
    const chunkSize = value[fmtOffset + 4] | (value[fmtOffset + 5] << 8) | (value[fmtOffset + 6] << 16) | (value[fmtOffset + 7] << 24);

    if (chunkId === 'fmt ') {
      break;
    }

    fmtOffset += 8 + chunkSize;
  }

  if (fmtOffset >= value.length - 8) {
    throw new UnsupportedFormatError('Not a WAV file: missing fmt chunk');
  }

  // Parse fmt chunk (must be at least 16 bytes)
  const fmtChunkSize = value[fmtOffset + 4] | (value[fmtOffset + 5] << 8) | (value[fmtOffset + 6] << 16) | (value[fmtOffset + 7] << 24);
  if (fmtChunkSize < 16 || fmtOffset + 8 + 16 > value.length) {
    throw new UnsupportedFormatError('Not a WAV file: invalid fmt chunk');
  }

  const fmtData = value.subarray(fmtOffset + 8, fmtOffset + 8 + fmtChunkSize);

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

  while (dataOffset < value.length - 8) {
    // eslint-disable-next-line unicorn/prefer-code-point
    const chunkId = String.fromCharCode(value[dataOffset], value[dataOffset + 1], value[dataOffset + 2], value[dataOffset + 3]);
    const chunkSize = value[dataOffset + 4] | (value[dataOffset + 5] << 8) | (value[dataOffset + 6] << 16) | (value[dataOffset + 7] << 24);

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
