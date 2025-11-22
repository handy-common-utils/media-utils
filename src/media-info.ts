import type {
  MediaParserAudioCodec,
  MediaParserContainer,
  MediaParserVideoCodec,
} from "@remotion/media-parser";

export interface VideoStreamInfo {
  codec: MediaParserVideoCodec;
  width: number;
  height: number;
  bitrate?: number;
  durationInSeconds?: number;
  fps?: number;
}

export interface AudioStreamInfo {
  codec: MediaParserAudioCodec;
  channelCount: number;
  sampleRate: number;
  bitrate?: number;
  durationInSeconds?: number;
}

export interface MediaInfo {
  parser: "mp4box" | "remotion" | "auto";
  container: MediaParserContainer;
  durationInSeconds?: number;
  videoStreams: VideoStreamInfo[];
  audioStreams: AudioStreamInfo[];
  mimeType?: string;
}
