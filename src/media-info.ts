import { UnsupportedFormatError } from './utils';

export class ContainerDetails<T extends string> {
  constructor(
    public readonly code: T,
    public readonly fileExtension: string,
    public readonly aliases: Array<string | RegExp>,
  ) {}
}

const containers = {
  unknown: new ContainerDetails('unknown', 'mp4', []),
  mov: new ContainerDetails('mov', 'mov', ['mov', 'qt', 'qt ', 'qt  ']),
  mp4: new ContainerDetails('mp4', 'mp4', ['m4v', 'm4a', 'isom', 'iso2', 'mp41', 'mp42']),
  webm: new ContainerDetails('webm', 'webm', []),
  mkv: new ContainerDetails('mkv', 'mkv', ['matroska']),
  avi: new ContainerDetails('avi', 'avi', []),
  mpegts: new ContainerDetails('mpegts', 'ts', ['ts', 'transport-stream', 'm2ts']),
  mxf: new ContainerDetails('mxf', 'mxf', []),

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
  unknown: new AudioCodecDetails('unknown', 'wav', []),
  mp3: new AudioCodecDetails('mp3', 'mp3', ['mp4a.6b', '.mp3', 'A_MPEG/L3', 'MPEG-2.5 Layer III', 'MPEG-2 Layer III', 'MPEG-1 Layer III']),
  opus: new AudioCodecDetails('opus', 'ogg', ['opus', 'mp4a.ad', 'A_OPUS']),
  aac: new AudioCodecDetails('aac', 'aac', [/^mp4a\.40/, 'mp4a', 'A_AAC', /^A_AAC\/MPEG2\//, /^A_AAC\/MPEG4\//]),
  /**
   * AAC LATM (Advanced Audio Coding LATM syntax)
   */
  aac_latm: new AudioCodecDetails('aac_latm', 'aac', []),
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
  pcm_alaw: new AudioCodecDetails('pcm_alaw', 'wav', ['pcm-alaw']),
  pcm_mulaw: new AudioCodecDetails('pcm_mulaw', 'wav', ['pcm-mulaw']),
  mp2: new AudioCodecDetails('mp2', 'mp2', [
    'A_MPEG/L2',
    'A_MPEG/L1',
    'MPEG-2.5 Layer II',
    'MPEG-2 Layer II',
    'MPEG-2 Layer I',
    'MPEG-1 Layer II',
    'MPEG-1 Layer I',
  ]),
  mp1: new AudioCodecDetails('mp1', 'mp1', ['A_MPEG/L1']),
  dts: new AudioCodecDetails('dts', 'dts', ['A_DTS']),
  alac: new AudioCodecDetails('alac', 'm4a', ['A_ALAC']),
  adpcm_ms: new AudioCodecDetails('adpcm_ms', 'wav', ['A_ADPCM']),
  adpcm_ima_wav: new AudioCodecDetails('adpcm_ima_wav', 'wav', ['adpcm-ima-wav']),
  /**
   * ATSC A/52B (AC-3, E-AC-3)
   */
  eac3: new AudioCodecDetails('eac3', 'ac3', ['E-AC-3']),
};

export type AudioCodecType = keyof typeof audioCodecs;

/**
 * Check if the audio codec is a PCM (including ADPCM) codec
 * @param audioCodec The audio codec to check
 * @returns True if the audio codec is a PCM codec, false otherwise
 */
export function isPCM(audioCodec: AudioCodecType | string | undefined | null): boolean {
  return (audioCodec?.startsWith('adpcm') ?? false) || (audioCodec?.startsWith('pcm') ?? false);
}

/**
 * Check if the audio codec is a WMA codec
 * @param audioCodec The audio codec to check
 * @returns True if the audio codec is a WMA codec, false otherwise
 */
export function isWMA(audioCodec: AudioCodecType | string | undefined | null): boolean {
  return audioCodec?.startsWith('wma') ?? false;
}

export class VideoCodecDetails<T extends string> {
  constructor(
    public readonly code: T,
    public readonly aliases: Array<string | RegExp>,
  ) {}
}

const videoCodecs = {
  unknown: new VideoCodecDetails('unknown', []),
  h264: new VideoCodecDetails('h264', ['H264', 'avc', 'avc1', 'X264', 'AVC1', /^avc1\./, 'V_MPEG4/ISO/AVC']),
  hevc: new VideoCodecDetails('hevc', ['h265', 'H265', 'hvc', 'hev', /^hevc_.*/, 'V_MPEGH/ISO/HEVC']),
  vp8: new VideoCodecDetails('vp8', ['vp08', /^vp08\./, 'V_VP8']),
  vp9: new VideoCodecDetails('vp9', ['vp09', /^vp09\./, 'V_VP9']),
  wmv2: new AudioCodecDetails('wmv2', 'asf', ['WMV2']),
  av1: new VideoCodecDetails('av1', ['av01', 'V_AV1']),
  prores: new VideoCodecDetails('prores', ['ap']),
  /**
   * MPEG-4 part 2 (decoders: mpeg4 mpeg4_v4l2m2m mpeg4_cuvid ) (encoders: mpeg4 libxvid mpeg4_omx mpeg4_v4l2m2m )
   */
  mpeg4: new VideoCodecDetails('mpeg4', ['FMP4', 'V_MPEG4/ISO/SP', 'V_MPEG4/ISO/ASP', 'V_MPEG4/ISO/AP']),
  /**
   * MPEG-2 video (decoders: mpeg2video mpegvideo mpeg2_v4l2m2m mpeg2_qsv mpeg2_cuvid ) (encoders: mpeg2video mpeg2_qsv mpeg2_vaapi )
   */
  mpeg2video: new VideoCodecDetails('mpeg2video', ['V_MPEG2']),
  theora: new VideoCodecDetails('theora', ['V_THEORA']),
  mjpeg: new VideoCodecDetails('mjpeg', ['mjpg', 'MJPG', 'V_MJPEG']),
  /**
   * MPEG-4 part 2 Microsoft variant version 2
   */
  msmpeg4v2: new VideoCodecDetails('msmpeg4v2', ['MP42']),
  /**
   * MPEG-1 video (decoders: mpeg1video mpeg1_v4l2m2m mpeg1_cuvid )
   */
  mpeg1video: new VideoCodecDetails('mpeg1video', []),
};

export type VideoCodecType = keyof typeof videoCodecs;

export interface VideoStreamInfo {
  id: number;
  codec: VideoCodecType;
  /**
   * Parser-specific codec information
   */
  codecDetail?: string;
  width?: number;
  height?: number;
  bitrate?: number;
  durationInSeconds?: number;
  fps?: number;
  profile?: string;
  level?: string;
  codecDetails?: {
    /**
     * In an MXF file, the video and audio data (the "essence") are stored in packets called KLVs. Every essence KLV starts with a 16-byte Universal Label (UL) that acts as a header.
     * The essenceTrackNumber is a 4-byte value (e.g., 0x15010000 or 0x16010000) that is embedded inside those 16-byte headers to identify which stream the data belongs to.
     * - Prefix 0x15: Usually indicates Video essence.
     * - Prefix 0x16: Usually indicates Sound essence.
     * - The suffix: Differentiates between multiple tracks of the same type (e.g., 0x1601 for the first audio track, 0x1602 for the second).
     */
    essenceTrackNumber?: number;
  };
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
  level?: string;
  /**
   * Usually it is ISO-639 string
   */
  language?: string;
  /**
   * Such like Music, Effects, Visual impaired / Audio description, Hearing impaired
   */
  audioType?: string;
  /**
   * DTS surround mode
   */
  surroundMode?: string;

  /**
   * Codec-specific details (stream-level properties)
   *
   * For ADPCM codecs (MS ADPCM, IMA ADPCM, etc.), these properties are constant
   * for the entire audio stream and stored once in the container's format header:
   * - WAV: in the fmt chunk
   * - AVI: in the stream format chunk (strf)
   * - MKV (A_MS/ACM): inside the CodecPrivate WAVEFORMATEX
   *
   * These values do NOT change per block/frame.
   */
  codecDetails?: {
    /**
     * In an MXF file, the video and audio data (the "essence") are stored in packets called KLVs. Every essence KLV starts with a 16-byte Universal Label (UL) that acts as a header.
     * The essenceTrackNumber is a 4-byte value (e.g., 0x15010000 or 0x16010000) that is embedded inside those 16-byte headers to identify which stream the data belongs to.
     * - Prefix 0x15: Usually indicates Video essence.
     * - Prefix 0x16: Usually indicates Sound essence.
     * - The suffix: Differentiates between multiple tracks of the same type (e.g., 0x1601 for the first audio track, 0x1602 for the second).
     */
    essenceTrackNumber?: number;
    /**
     * Format tag (wFormatTag) — STREAM LEVEL
     *
     * Identifies the codec type:
     * - 0x0001 = PCM
     * - 0x0002 = MS ADPCM
     * - 0x0011 = IMA ADPCM
     * - etc.
     *
     * Stored once in the container's format header, not in each block.
     */
    formatTag?: number;

    /**
     * Block align (nBlockAlign) — STREAM LEVEL
     *
     * The size (in bytes) of each encoded ADPCM block.
     * Must remain constant for the whole stream.
     *
     * - Containers expect every read operation to start on a block boundary
     * - ADPCM decoding requires knowing block size ahead of time
     * - Every ADPCM block in the stream must be exactly blockAlign bytes
     *
     * Not stored per block — the block itself does not announce its own length.
     */
    blockAlign?: number;

    /**
     * Samples per block — STREAM LEVEL
     *
     * Tells the decoder how many PCM samples will come out of each compressed block.
     * Derived from the codec and blockAlign.
     *
     * Needed because ADPCM uses:
     * - Warm-up samples
     * - 4-bit deltas
     *
     * Also constant for the entire stream. Not stored per block.
     *
     * The block itself contains:
     * - Predictor index
     * - Delta (step size)
     * - Warm-up samples
     * - 4-bit deltas
     *
     * ...but NOT samples-per-block (that's known from the stream header).
     */
    samplesPerBlock?: number;
    /**
     * Something like layer I, II, III
     */
    layer?: number;
    padding?: number;

    // AC-3 / E-AC-3
    componentType?: number;
    bsmod?: number;
    mainId?: number;
    asvc?: number;
  };
}

export interface MediaInfo {
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
