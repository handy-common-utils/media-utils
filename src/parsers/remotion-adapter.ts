import { MediaInfo } from '../media-info';
import { MediaParserAdapter, ParsingError } from './adapter';

export class RemotionAdapter implements MediaParserAdapter {
  private mediaParser: typeof import('@remotion/media-parser');

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module
    this.mediaParser = require('@remotion/media-parser');
  }

  async parse(stream: ReadableStream<Uint8Array>): Promise<MediaInfo> {
    try {
      return await this.parseWithoutErrorHandling(stream);
    } catch (error) {
      const msg = (error as Error)?.message;
      if (msg && /(^Unknown [a-zA-Z0-9]+ format:)|(^Only [a-zA-Z0-9]+ is supported)|(^No tracks yet)|(^IsAnUnsupportedFileTypeError:)/.test(msg)) {
        (error as ParsingError).isUnsupportedFormatError = true;
      }

      throw error;
    }
  }

  private async parseWithoutErrorHandling(stream: ReadableStream<Uint8Array>): Promise<MediaInfo> {
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    let bytesRead = 0;
    const MAX_PROBE_SIZE = 10 * 1024 * 1024; // 10MB

    while (bytesRead < MAX_PROBE_SIZE) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        bytesRead += value.length;
      }
    }

    const blob = new Blob(chunks);
    const file = new File([blob], 'input.media');

    const result = await this.mediaParser.parseMedia({
      src: file,
      fields: {
        audioCodec: true,
        videoCodec: true,
        durationInSeconds: true,
        container: true,
        tracks: true,
        mimeType: true,
      },
    });

    const durationInSeconds = result.durationInSeconds ?? undefined;
    const mimeType = result.mimeType ?? undefined;
    return {
      parser: 'remotion',
      container: result.container,
      durationInSeconds: durationInSeconds,
      videoStreams: result.tracks
        .filter((t) => t.type === 'video')
        .map((t) => ({
          codec: t.codec as any,
          width: t.width,
          height: t.height,
          bitrate: undefined,
          durationInSeconds,
        })),
      audioStreams: result.tracks
        .filter((t) => t.type === 'audio')
        .map((t) => ({
          codec: t.codec as any,
          channelCount: t.numberOfChannels,
          sampleRate: t.sampleRate,
          durationInSeconds,
        })),
      mimeType,
    };
  }
}
