import type { MediaParserAudioCodec, MediaParserContainer, MediaParserVideoCodec } from '@remotion/media-parser';

export type AudioCodecType = MediaParserAudioCodec;
export type VideoCodecType = MediaParserVideoCodec;
export type ContainerType = MediaParserContainer;

export interface VideoStreamInfo {
  id: number;
  codec: VideoCodecType;
  /**
   * Parser-specific codec information
   */
  codecDetail?: string;
  width: number;
  height: number;
  bitrate?: number;
  durationInSeconds?: number;
  fps?: number;
}

export interface AudioStreamInfo {
  id: number;
  codec: AudioCodecType;
  /**
   * Parser-specific codec information
   */
  codecDetail?: string;
  channelCount?: number;
  sampleRate?: number;
  bitrate?: number;
  durationInSeconds?: number;
  profile?: string;
}

export interface MediaInfo {
  parser: 'mp4box' | 'remotion' | 'isoboxer' | 'inhouse' | 'auto';
  container: ContainerType;
  /**
   * Parser-specific container information
   */
  containerDetail?: string;
  durationInSeconds?: number;
  videoStreams: VideoStreamInfo[];
  audioStreams: AudioStreamInfo[];
  mimeType?: string;
}

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
