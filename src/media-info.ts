import { UnsupportedFormatError } from './utils';

export class ContainerDetails<T extends string> {
  constructor(
    public readonly code: T,
    public readonly fileExtension: string,
    public readonly aliases: Array<string | RegExp>,
  ) {}
}

const containers = {
  mov: new ContainerDetails('mov', 'mov', ['mov', 'qt', 'qt ', 'qt  ']),
  mp4: new ContainerDetails('mp4', 'mp4', ['m4v', 'm4a', 'isom', 'iso2', 'mp41', 'mp42']),
  webm: new ContainerDetails('webm', 'webm', []),
  mkv: new ContainerDetails('mkv', 'mkv', ['matroska']),
  avi: new ContainerDetails('avi', 'avi', []),
  mpegts: new ContainerDetails('mpegts', 'ts', ['ts', 'transport-stream', 'm2ts']),

  /**
   * "wma" is only used as the default container format of audio codec "wmav1" and "wmav2"
   * for getting the correct file extension "wma".
   * When parsing a .wma file, the container name is "asf".
   */
  wma: new ContainerDetails('wma', 'wma', []),
  asf: new ContainerDetails('asf', 'wmv', []),

  ogg: new ContainerDetails('ogg', 'ogg', []),
  aac: new ContainerDetails('aac', 'aac', []),
  mp3: new ContainerDetails('mp3', 'mp3', []),
  flac: new ContainerDetails('flac', 'flac', []),
  wav: new ContainerDetails('wav', 'wav', []),
  ac3: new ContainerDetails('ac3', 'ac3', []),

  mp2: new ContainerDetails('mp2', 'mp2', []),
  mp1: new ContainerDetails('mp1', 'mp1', []),
  dts: new ContainerDetails('dts', 'dts', []),
  m4a: new ContainerDetails('m4a', 'm4a', []),
};

export type ContainerType = keyof typeof containers;

export class AudioCodecDetails<T extends string> {
  constructor(
    public readonly code: T,
    public readonly defaultContainer: ContainerType,
    public readonly aliases: Array<string | RegExp>,
  ) {}
}

const audioCodecs = {
  mp3: new AudioCodecDetails('mp3', 'mp3', ['mp4a.6b', '.mp3', 'A_MPEG/L3']),
  opus: new AudioCodecDetails('opus', 'ogg', ['opus', 'mp4a.ad', 'A_OPUS']),
  aac: new AudioCodecDetails('aac', 'aac', [/^mp4a\.40/, 'mp4a', 'A_AAC', /^A_AAC\/MPEG2\//, /^A_AAC\/MPEG4\//]),
  wmav1: new AudioCodecDetails('wmav1', 'wma', ['WMAv1']),
  wmav2: new AudioCodecDetails('wmav2', 'wma', ['WMAv2']),
  wmapro: new AudioCodecDetails('wmapro', 'wma', ['WMAPro', 'WMA Pro']),
  wmalossless: new AudioCodecDetails('wmalossless', 'wma', ['WMALossless', 'WMA Lossless']),
  vorbis: new AudioCodecDetails('vorbis', 'ogg', ['A_VORBIS']),
  ac3: new AudioCodecDetails('ac3', 'ac3', ['ac-3', 'A_AC3', 'A_EAC3', 'A_TRUEHD']),
  flac: new AudioCodecDetails('flac', 'flac', ['A_FLAC']),
  pcm_u8: new AudioCodecDetails('pcm_u8', 'wav', ['pcm-u8']),
  pcm_s16le: new AudioCodecDetails('pcm_s16le', 'wav', ['pcm-s16le', 'pcm-s16']),
  pcm_s24le: new AudioCodecDetails('pcm_s24le', 'wav', ['pcm-s24le', 'pcm-s24']),
  pcm_s32le: new AudioCodecDetails('pcm_s32le', 'wav', ['pcm-s32le', 'pcm-s32']),
  pcm_s16be: new AudioCodecDetails('pcm_s16be', 'wav', ['pcm-s16be']),
  pcm_s24be: new AudioCodecDetails('pcm_s24be', 'wav', ['pcm-s24be']),
  pcm_s32be: new AudioCodecDetails('pcm_s32be', 'wav', ['pcm-s32be']),
  pcm_f32le: new AudioCodecDetails('pcm_f32le', 'wav', ['pcm-f32le', 'pcm-f32', 'A_PCM/FLOAT/IEEE']),
  mp2: new AudioCodecDetails('mp2', 'mp2', ['A_MPEG/L2', 'A_MPEG/L1']),
  mp1: new AudioCodecDetails('mp1', 'mp1', ['A_MPEG/L1']),
  dts: new AudioCodecDetails('dts', 'dts', ['A_DTS']),
  alac: new AudioCodecDetails('alac', 'm4a', ['A_ALAC']),
};

export type AudioCodecType = keyof typeof audioCodecs;

export class VideoCodecDetails<T extends string> {
  constructor(
    public readonly code: T,
    public readonly aliases: Array<string | RegExp>,
  ) {}
}

const videoCodecs = {
  h264: new VideoCodecDetails('h264', ['avc', 'avc1', /^avc1\./, 'V_MPEG4/ISO/AVC']),
  hevc: new VideoCodecDetails('hevc', ['h265', 'hvc', 'hev', /^hevc_.*/, 'V_MPEGH/ISO/HEVC']),
  vp8: new VideoCodecDetails('vp8', ['vp08', /^vp08\./, 'V_VP8']),
  vp9: new VideoCodecDetails('vp9', ['vp09', /^vp09\./, 'V_VP9']),
  wmv2: new AudioCodecDetails('wmv2', 'asf', ['WMV2']),
  av1: new VideoCodecDetails('av1', ['av01', 'V_AV1']),
  prores: new VideoCodecDetails('prores', ['ap']),
  mpeg4: new VideoCodecDetails('mpeg4', ['V_MPEG4/ISO/SP', 'V_MPEG4/ISO/ASP', 'V_MPEG4/ISO/AP']),
  mpeg2: new VideoCodecDetails('mpeg2', ['V_MPEG2']),
  theora: new VideoCodecDetails('theora', ['V_THEORA']),
};

export type VideoCodecType = keyof typeof videoCodecs;

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
  bitsPerSample?: number;
  bitrate?: number;
  durationInSeconds?: number;
  profile?: string;
}

export interface MediaInfo {
  parser: 'mp4box' | 'remotion' | 'isoboxer' | 'media-utils' | 'auto';
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

/**
 * Get all containers with their details
 * @returns Array of container details
 */
export function allContainers(): ContainerDetails<ContainerType>[] {
  return Object.values(containers);
}

/**
 * Get all audio codecs with their details
 * @returns Array of audio codec details
 */
export function allAudioCodecs(): AudioCodecDetails<AudioCodecType>[] {
  return Object.values(audioCodecs);
}

/**
 * Get all video codecs with their details
 * @returns Array of video codec details
 */
export function allVideoCodecs(): VideoCodecDetails<VideoCodecType>[] {
  return Object.values(videoCodecs);
}

/**
 * Find the matching container for a given code
 * @param code - A code which could be a MP4 brand identifier (e.g., "isom", "iso2", "mp41") or anything else
 * @returns Details of the container found, or undefined if no matching container can be found.
 */
export function findContainer(code: string | string | undefined | null): ContainerDetails<ContainerType> | undefined {
  if (!code) {
    return undefined;
  }

  for (const container of allContainers()) {
    if (container.code === code) {
      return container;
    }
    for (const alias of container.aliases) {
      if (typeof alias === 'string' && alias === code) {
        return container;
      } else if (alias instanceof RegExp && alias.test(code)) {
        return container;
      }
    }
  }

  return undefined;
}

/**
 * Find the matching container for a given code
 * @param code - A code or an array of MP4 brand identifiers (e.g., ["isom", "iso2", "mp41"])
 * @returns Details of the container found, or throws an error if no matching container can be found.
 */
export function toContainer(code: string[] | string | undefined | null): ContainerDetails<ContainerType> {
  if (!code) {
    throw new UnsupportedFormatError(`Unknown container: ${JSON.stringify(code)}`);
  }

  if (Array.isArray(code)) {
    for (const c of code) {
      const container = findContainer(c);
      if (container) {
        return container;
      }
    }
    throw new UnsupportedFormatError(`Unknown container: ${JSON.stringify(code)}`);
  }

  const container = findContainer(code);
  if (!container) {
    throw new UnsupportedFormatError(`Unknown container: ${JSON.stringify(code)}`);
  }
  return container;
}

/**
 * Find the matching video codec for a given code
 * @param code - A code which could be a codec identifier (e.g., "avc", "hevc", "vp09") or anything else
 * @returns Details of the video codec found, or undefined if no matching codec can be found.
 */
export function findVideoCodec(code: string | string | undefined | null): VideoCodecDetails<VideoCodecType> | undefined {
  if (!code) {
    return undefined;
  }

  for (const codec of allVideoCodecs()) {
    if (codec.code === code) {
      return codec;
    }
    for (const alias of codec.aliases) {
      if (typeof alias === 'string' && alias === code) {
        return codec;
      } else if (alias instanceof RegExp && alias.test(code)) {
        return codec;
      }
    }
  }

  return undefined;
}

/**
 * Find the matching video codec for a given code
 * @param code - A code which could be a codec identifier (e.g., "avc", "hevc", "vp09") or anything else
 * @returns Details of the video codec found, or throws an error if no matching codec can be found.
 */
export function toVideoCodec(code: string | string | undefined | null): VideoCodecDetails<VideoCodecType> {
  const codec = findVideoCodec(code);
  if (!codec) {
    throw new UnsupportedFormatError(`Unknown video codec: ${JSON.stringify(code)}`);
  }
  return codec;
}

/**
 * Find the matching audio codec for a given code
 * @param code - A code which could be a codec identifier (e.g., "mp4a.40.2", "opus", "mp3") or anything else
 * @returns Details of the audio codec found, or undefined if no matching codec can be found.
 */
export function findAudioCodec(code: string | string | undefined | null): AudioCodecDetails<AudioCodecType> | undefined {
  if (!code) {
    return undefined;
  }

  for (const codec of allAudioCodecs()) {
    if (codec.code === code) {
      return codec;
    }
    for (const alias of codec.aliases) {
      if (typeof alias === 'string' && alias === code) {
        return codec;
      } else if (alias instanceof RegExp && alias.test(code)) {
        return codec;
      }
    }
  }

  return undefined;
}

/**
 * Find the matching audio codec for a given code
 * @param code - A code which could be a codec identifier (e.g., "mp4a.40.2", "opus", "mp3") or anything else
 * @returns Details of the audio codec found, or throws an error if no matching codec can be found.
 */
export function toAudioCodec(code: string | string | undefined | null): AudioCodecDetails<AudioCodecType> {
  const codec = findAudioCodec(code);
  if (!codec) {
    throw new UnsupportedFormatError(`Unknown audio codec: ${JSON.stringify(code)}`);
  }
  return codec;
}
