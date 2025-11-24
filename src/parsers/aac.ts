import { getAacProfileName } from '../codec-utils';
import { AudioStreamInfo, MediaInfo } from '../media-info';

/**
 * Parses an ADTS (Audio Data Transport Stream) header from AAC data.
 * ADTS headers are 7 bytes (without CRC) or 9 bytes (with CRC).
 *
 * @param data The AAC data with ADTS header
 * @returns Audio stream information extracted from the ADTS header
 * @throws Error if the data is not a valid ADTS header
 */
export function parseADTSHeader(data: Uint8Array): AudioStreamInfo {
  if (data.length < 7) {
    throw new Error('Not an AAC file: insufficient data');
  }

  // Parse ADTS header (7 bytes minimum)
  const header = data.slice(0, 7);

  // Check syncword (12 bits) - should be 0xFFF
  const syncword = (header[0] << 4) | (header[1] >> 4);
  if (syncword !== 0xfff) {
    throw new Error('Invalid ADTS header: syncword mismatch');
  }

  // Extract MPEG version (1 bit) - bit 3 of byte 1
  // 0 = MPEG-4, 1 = MPEG-2
  const _mpegVersion = (header[1] >> 3) & 0x01;

  // Extract protection absent (1 bit) - bit 0 of byte 1
  const _protectionAbsent = header[1] & 0x01;

  // Extract profile (2 bits) - bits 6-7 of byte 2
  const profileIndex = (header[2] >> 6) & 0x03;
  // Audio Object Type = profile + 1
  const audioObjectType = profileIndex + 1;
  const profile = getAacProfileName(audioObjectType);

  // Extract sampling frequency index (4 bits) - bits 2-5 of byte 2
  const samplingFreqIndex = (header[2] >> 2) & 0x0f;
  const samplingFrequencies = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  const sampleRate = samplingFrequencies[samplingFreqIndex];

  if (!sampleRate) {
    throw new Error(`Invalid ADTS header: unsupported sampling frequency index ${samplingFreqIndex}`);
  }

  // Extract channel configuration (3 bits)
  // 2 bits from byte 2 (bits 0-1) and 1 bit from byte 3 (bit 6)
  const channelConfig = ((header[2] & 0x01) << 2) | ((header[3] >> 6) & 0x03);

  // Channel configuration mapping:
  // 0 = defined in AOT Specific Config
  // 1 = 1 channel (mono)
  // 2 = 2 channels (stereo)
  // 3 = 3 channels
  // 4 = 4 channels
  // 5 = 5 channels
  // 6 = 5.1 channels
  // 7 = 7.1 channels
  const channelCount = channelConfig === 0 ? undefined : channelConfig;

  // Extract frame length (13 bits) - bits 0-1 of byte 3, all of byte 4, bits 5-7 of byte 5
  const _frameLength = ((header[3] & 0x03) << 11) | (header[4] << 3) | ((header[5] >> 5) & 0x07);

  return {
    id: 1,
    codec: 'aac',
    codecDetail: `mp4a.40.${audioObjectType}`,
    channelCount,
    sampleRate,
    profile,
    durationInSeconds: undefined,
  };
}

/**
 * Parses AAC file from a stream and extracts media information.
 * Note: The returned MediaInfo does not include the 'parser' field,
 * which should be set by the adapter.
 *
 * @param stream The input media stream
 * @returns Media information without the parser field
 * @throws Error if the stream is not a valid AAC file
 */
export async function parseAac(stream: ReadableStream<Uint8Array>): Promise<Omit<MediaInfo, 'parser'>> {
  // Read the first chunk to parse the ADTS header
  const reader = stream.getReader();
  const { done, value } = await reader.read();
  reader.cancel();

  if (done || !value) {
    throw new Error('Not an AAC file: insufficient data');
  }

  // Parse ADTS header using the AAC-specific parser
  const audioStream = parseADTSHeader(value);

  return {
    container: 'aac',
    containerDetail: 'aac',
    durationInSeconds: undefined,
    videoStreams: [],
    audioStreams: [audioStream],
  };
}
