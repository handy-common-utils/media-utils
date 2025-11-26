import type { MediaParserAudioCodec, MediaParserContainer, MediaParserVideoCodec } from '@remotion/media-parser';

export type AudioCodecType = MediaParserAudioCodec | 'wmav2';
export type VideoCodecType = MediaParserVideoCodec;
export type ContainerType = MediaParserContainer | 'asf' | 'mov' | 'ogg';

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
