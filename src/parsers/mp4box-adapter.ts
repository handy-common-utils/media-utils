import { GetMediaInfoOptions } from "../get-media-info";
import { AudioStreamInfo, MediaInfo, VideoStreamInfo } from "../media-info";
import { MediaParserAdapter, ParsingError } from "./adapter";

export class Mp4BoxAdapter implements MediaParserAdapter {
  private mp4box: typeof import("mp4box");

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module
    this.mp4box = require("mp4box");
  }

  async parse(
    stream: ReadableStream<Uint8Array>,
    options?: GetMediaInfoOptions,
  ): Promise<MediaInfo> {
    try {
      return await this.parseWithoutErrorHandling(stream, options);
    } catch (error) {
      const msg = (error as Error)?.message;
      if (msg && /(Invalid box type:)|(: ISOFile$)/.test(msg)) {
        (error as ParsingError).isUnsupportedFormatError = true;
      }

      throw error;
    }
  }

  private async parseWithoutErrorHandling(
    stream: ReadableStream<Uint8Array>,
    options?: GetMediaInfoOptions,
  ): Promise<MediaInfo> {
    return new Promise((resolve, reject) => {
      const mp4file = this.mp4box.createFile();

      let infoFound = false;

      mp4file.onReady = (info) => {
        infoFound = true;
        const videoStreams: VideoStreamInfo[] = info.videoTracks.map(
          (track) => ({
            codec: track.codec as any,
            width: track.track_width,
            height: track.track_height,
            bitrate: track.bitrate,
            durationInSeconds: track.duration / track.timescale,
            fps: track.nb_samples / (track.duration / track.timescale),
          }),
        );

        const audioStreams: AudioStreamInfo[] = info.audioTracks.map(
          (track) => ({
            codec: track.codec as any,
            channelCount: track.audio!.channel_count,
            sampleRate: track.audio!.sample_rate,
            bitrate: track.bitrate,
            durationInSeconds: track.duration / track.timescale,
          }),
        );

        resolve({
          parser: "mp4box",
          container: "mp4",
          durationInSeconds: info.duration / info.timescale,
          videoStreams,
          audioStreams,
          mimeType: info.mime,
        });
        mp4file.flush();
      };

      mp4file.onError = (e: string) => {
        reject(new Error(`MP4Box error: ${e}`));
      };

      const reader = stream.getReader();
      let offset = 0;

      function readChunk() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              if (!infoFound) {
                reject(new Error("Stream ended before MP4 info was found"));
              }
              mp4file.flush();
              return;
            }

            if (value) {
              const buffer = value.buffer as ArrayBuffer & {
                fileStart: number;
              };
              buffer.fileStart = offset;
              mp4file.appendBuffer(buffer);
              offset += value.length;

              if (infoFound) {
                reader.cancel();
              } else {
                readChunk();
              }
            }
          })
          .catch(reject);
      }

      readChunk();
    });
  }
}
