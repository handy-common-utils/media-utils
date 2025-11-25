/**
 * @internal
 * @module
 */

import { AudioCodecType, ContainerType, VideoCodecType } from './media-info';

const standardContainerValues = new Set<ContainerType>(['aac', 'avi', 'flac', 'm3u8', 'mp3', 'mp4', 'transport-stream', 'wav', 'webm']);

const standardVideoCodecValues = new Set<VideoCodecType>(['av1', 'h264', 'h265', 'prores', 'vp8', 'vp9']);

const standardAudioCodecValues = new Set<AudioCodecType>([
  'aac',
  'ac3',
  'aiff',
  'flac',
  'mp3',
  'opus',
  'pcm-f32',
  'pcm-s16',
  'pcm-s24',
  'pcm-s32',
  'pcm-u8',
  'vorbis',
]);

/**
 * Converts video codec string to VideoCodecType
 * @param codecDetail - codec string (e.g., "avc1.64001f", "hvc1", "vp09")
 * @returns Standardized video codec identifier
 */
export function toVideoCodecType(codecDetail: string | undefined | null): VideoCodecType {
  if (!codecDetail) {
    throw new Error(`Unknown video codec: "${codecDetail}"`);
  }

  const codec = codecDetail.toLocaleLowerCase();

  if (standardVideoCodecValues.has(codec as any)) {
    return codec as VideoCodecType;
  }

  for (const standardType of standardVideoCodecValues) {
    if (codec.startsWith(standardType)) {
      return standardType;
    }
  }

  // H.264/AVC codecs (avc1, avc3)
  if (codec.startsWith('avc')) {
    return 'h264';
  }

  // H.265/HEVC codecs (hvc1, hev1)
  if (codec.startsWith('hevc') || codec.startsWith('hvc') || codec.startsWith('hev')) {
    return 'h265';
  }

  // VP8
  if (codec.startsWith('vp08')) {
    return 'vp8';
  }

  // VP9
  if (codec.startsWith('vp09')) {
    return 'vp9';
  }

  // AV1
  if (codec.startsWith('av01')) {
    return 'av1';
  }

  // ProRes (various variants: apch, apcn, apcs, apco, ap4h, ap4x)
  if (codec.startsWith('ap')) {
    return 'prores';
  }

  throw new Error(`Unknown video codec: ${codecDetail}`);
}

/**
 * Converts audio codec string to AudioCodecType
 * @param codecDetail - codec string (e.g., "mp4a.40.2", "opus", "mp3")
 * @returns Standardized audio codec identifier
 */
export function toAudioCodecType(codecDetail: string | undefined | null): AudioCodecType {
  if (!codecDetail) {
    throw new Error(`Unknown video codec: "${codecDetail}"`);
  }

  const codec = codecDetail.toLocaleLowerCase();

  if (standardAudioCodecValues.has(codec as any)) {
    return codec as AudioCodecType;
  }

  for (const standardType of standardAudioCodecValues) {
    if (codec.startsWith(standardType)) {
      return standardType;
    }
  }

  // MP3 (mp4a.6b/mp4a.69 variants)
  if (codec === '.mp3' || codec.startsWith('mp4a.6') || codec.startsWith('mp4a.34')) {
    return 'mp3';
  }

  // Opus (opus variants)
  if (codec.startsWith('mp4a.ad')) {
    return 'opus';
  }

  // AAC (mp4a.40.x variants)
  if (codec.startsWith('mp4a')) {
    return 'aac';
  }

  // AC-3
  if (codec.startsWith('ac-3')) {
    return 'ac3';
  }

  // PCM variants (various raw audio formats)
  if (codec.startsWith('pcm')) {
    // Try to detect bit depth from codec string
    if (codec.includes('16')) {
      return 'pcm-s16';
    }
    if (codec.includes('24')) {
      return 'pcm-s24';
    }
    if (codec.includes('32')) {
      return 'pcm-s32';
    }
    if (codec.includes('f32') || codec.includes('float')) {
      return 'pcm-f32';
    }
    if (codec.includes('u8')) {
      return 'pcm-u8';
    }
    throw new Error(`Unknown PCM audio codec: ${codecDetail}`);
  }

  throw new Error(`Unknown audio codec: ${codecDetail}`);
}

/**
 * Converts brand array or container stringto ContainerType
 * @param brands - Array of MP4 brand identifiers (e.g., ["isom", "iso2", "mp41"]) or a single string
 * @returns Standardized container format identifier
 */
export function toContainerType(brands: string[] | string | undefined | null): ContainerType {
  if (!brands) {
    throw new Error(`Unknown container: ${JSON.stringify(brands)}`);
  }

  const brandSet = new Set(Array.isArray(brands) ? brands.map((b) => b.toLowerCase()) : [brands.toLowerCase()]);

  for (const standardType of standardContainerValues) {
    if (brandSet.has(standardType)) {
      return standardType;
    }
  }

  // Check for AVI
  if (brandSet.has('avi ')) {
    return 'avi';
  }

  // Check for transport stream
  if (brandSet.has('ts') || brandSet.has('m2ts')) {
    return 'transport-stream';
  }

  // Check for audio-only formats
  if (brandSet.has('mp3 ')) {
    return 'mp3';
  }

  if (brandSet.has('wave')) {
    return 'wav';
  }

  // mp4 for ISO BMFF brands (isom, iso2, mp41, mp42, etc.)
  if (
    brandSet.has('isom') ||
    brandSet.has('iso2') ||
    brandSet.has('qt  ') ||
    brandSet.has('qt') ||
    brandSet.has('mp4 ') ||
    brandSet.has('mp41') ||
    brandSet.has('mp42')
  ) {
    return 'mp4';
  }

  throw new Error(`Unknown container: ${JSON.stringify(brands)}`);
}

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
