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
