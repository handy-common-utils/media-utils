import { AudioStreamInfo } from '../media-info';
import { UnsupportedFormatError } from '../utils';
import { BitReader, toHexString } from './binary';

/**
 * Mapping table between AAC audio object types and profile names
 * Based on ISO/IEC 14496-3 (MPEG-4 Audio) specification
 */
const AAC_PROFILE_MAP: ReadonlyMap<number, string> = new Map([
  [1, 'Main'],
  [2, 'LC'],
  [3, 'SSR'],
  [4, 'LTP'],
  [5, 'HE-AAC'],
  [29, 'HE-AAC v2'],
]);

/**
 * Get the AAC profile name based on the audio object type
 * @param audioObjectType The audio object type
 * @returns The profile name or undefined if not found
 */
export function getAacProfileName(audioObjectType: number): string | undefined {
  return AAC_PROFILE_MAP.get(audioObjectType);
}

/**
 * Get the audio object type based on the AAC profile name
 * @param profile The AAC profile name
 * @returns The audio object type or undefined if not found
 */
export function getAudioObjectTypeFromAacProfileName(profile: string): number | undefined {
  for (const [audioObjectType, profileName] of AAC_PROFILE_MAP) {
    if (profileName === profile) {
      return audioObjectType;
    }
  }
  return undefined;
}

/**
 * Parses an ADTS (Audio Data Transport Stream) header from AAC data.
 * ADTS headers are 7 bytes (without CRC) or 9 bytes (with CRC).
 *
 * @param data The AAC data with ADTS header
 * @param offset The offset of the header in the buffer
 * @returns Audio stream information extracted from the ADTS header
 * @throws Error if the data is not a valid ADTS header
 */
export function parseADTSHeader(data: Uint8Array, offset: number = 0): Omit<AudioStreamInfo, 'id' | 'durationInSeconds'> {
  if (data.length - offset < 7) {
    throw new UnsupportedFormatError('Not an AAC file: insufficient data');
  }

  // Parse ADTS header (7 bytes minimum)
  const header = data.slice(offset, offset + 7);

  // Check syncword (12 bits) - should be 0xFFF
  const syncword = (header[0] << 4) | (header[1] >> 4);
  if (syncword !== 0xfff) {
    throw new UnsupportedFormatError('Invalid ADTS header: syncword mismatch');
  }

  // Extract MPEG version (1 bit) - bit 3 of byte 1
  // 0 = MPEG-4, 1 = MPEG-2
  const _mpegVersion = (header[1] >> 3) & 0x01;

  // Extract layer (2 bits) - bits 1-2 of byte 1
  // For AAC ADTS, this MUST be 0 (indicating no layer, as AAC doesn't use layers)
  // For MP3, this would be 1-3 (Layer III, II, or I)
  // This is the key difference that distinguishes AAC from MP3
  const layer = (header[1] >> 1) & 0x03;
  if (layer !== 0) {
    throw new UnsupportedFormatError('Invalid ADTS header: layer must be 0 for AAC (this might be MP3)');
  }

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
    throw new UnsupportedFormatError(
      `Invalid ADTS header: unsupported sampling frequency index ${samplingFreqIndex}: ${toHexString(data.subarray(offset - 10, offset + 200))} ...`,
    );
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
    codec: 'aac',
    codecDetail: `mp4a.40.${audioObjectType}`,
    channelCount,
    sampleRate,
    profile,
  };
}

/**
 * Create an ADTS frame for AAC audio data
 * ADTS (Audio Data Transport Stream) is a container format for AAC audio
 * @param aacData Raw AAC data
 * @param streamInfo Information about the original audio stream
 * @param streamInfo.sampleRate The sample rate of the audio stream
 * @param streamInfo.channelCount The number of channels in the audio stream
 * @param streamInfo.profile The profile (AudioObjectType) of the audio stream
 * @returns AAC data with ADTS header prepended
 */
export function createADTSFrame(
  aacData: Uint8Array,
  streamInfo: { sampleRate?: number; channelCount?: number; profile?: number | string },
): Uint8Array {
  const { sampleRate = 44100, channelCount = 2, profile = 2 } = streamInfo;
  const aot = typeof profile === 'string' ? (getAudioObjectTypeFromAacProfileName(profile) ?? 2) : profile;

  // ADTS header is 7 bytes (without CRC)
  const adtsLength = 7;
  const frameLength = adtsLength + aacData.length;

  // Sampling frequency index lookup table
  const samplingFrequencies = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  const freqIndex = samplingFrequencies.indexOf(sampleRate);
  if (freqIndex === -1) {
    throw new Error(`Unsupported sample rate: ${sampleRate}`);
  }

  const adtsHeader = new Uint8Array(adtsLength);

  // Syncword (12 bits) - all 1s (0xFFF)
  adtsHeader[0] = 0xff;
  adtsHeader[1] = 0xf0;

  // MPEG version (1 bit) - 0 for MPEG-4
  // Layer (2 bits) - always 00
  // Protection absent (1 bit) - 1 (no CRC)
  adtsHeader[1] |= 0x01; // Protection absent = 1

  // Profile (2 bits) - AAC profile minus 1
  // Sampling frequency index (4 bits)
  // Private bit (1 bit) - 0
  // Channel configuration (3 bits) - starts here (2 bits)
  adtsHeader[2] = ((aot - 1) << 6) | (freqIndex << 2) | ((channelCount >> 2) & 0x01);

  // Channel configuration (1 bit continued)
  // Originality (1 bit) - 0
  // Home (1 bit) - 0
  // Copyright ID bit (1 bit) - 0
  // Copyright ID start (1 bit) - 0
  // Frame length (13 bits) - starts here (2 bits)
  adtsHeader[3] = ((channelCount & 0x03) << 6) | ((frameLength >> 11) & 0x03);

  // Frame length (11 bits continued)
  adtsHeader[4] = (frameLength >> 3) & 0xff;

  // Frame length (3 bits continued)
  // Buffer fullness (11 bits) - 0x7FF for VBR (starts here with 5 bits)
  adtsHeader[5] = ((frameLength & 0x07) << 5) | 0x1f;

  // Buffer fullness (6 bits continued)
  // Number of raw data blocks (2 bits) - 0 (meaning 1 block)
  adtsHeader[6] = 0xfc;

  // Combine ADTS header with AAC data
  const frame = new Uint8Array(frameLength);
  frame.set(adtsHeader, 0);
  frame.set(aacData, adtsLength);

  return frame;
}

/**
 * Parses an AudioSpecificConfig (ASC) from a BitReader.
 * It works for AAC-LC, HE-AAC, HE-AACv2.
 * @param br The BitReader to read from
 * @returns An object containing the parsed AudioSpecificConfig
 */
export function parseAudioSpecificConfig(
  br: BitReader,
): Pick<AudioStreamInfo, 'sampleRate' | 'channelCount' | 'codecDetail'> & { audioObjectType: number } {
  let audioObjectType = br.readBits(5);

  if (audioObjectType === 31) {
    audioObjectType = 32 + br.readBits(6);
  }

  let samplingFreqIndex = br.readBits(4);
  let sampleRate: number;

  if (samplingFreqIndex === 0xf) {
    sampleRate = br.readBits(24);
  } else {
    const samplingFreqTable = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
    sampleRate = samplingFreqTable[samplingFreqIndex];
  }

  const channelConfig = br.readBits(4);

  // -----------------------------------------
  // AAC profile detection
  // -----------------------------------------
  let codecDetail = 'aac-latm';

  switch (audioObjectType) {
    case 2: {
      codecDetail = 'aac-lc';
      break;
    }
    case 5: {
      codecDetail = 'he-aac'; // SBR
      break;
    }
    case 29: {
      codecDetail = 'he-aacv2'; // SBR + PS
      break;
    }
    default: {
      codecDetail = `object type: ${audioObjectType}`; // throw new UnsupportedFormatError(`Unknown audio object type: ${audioObjectType}`);
    }
  }

  return {
    sampleRate,
    channelCount: CHANNEL_COUNT[channelConfig],
    codecDetail,
    audioObjectType,
  };
}

const CHANNEL_COUNT = [0, 1, 2, 3, 4, 5, 6, 8, undefined, undefined, undefined, 7, 8, 24, 8];
