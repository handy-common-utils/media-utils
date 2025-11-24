import { MediaInfo, toAudioCodecType, toContainerType, toVideoCodecType } from '../media-info';
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
      if (
        msg &&
        /(^Unknown [a-zA-Z0-9]+ format:)|(^Only [a-zA-Z0-9]+ is supported)|(^No tracks yet)|(^IsAnUnsupportedFileTypeError:)|(Unknown file format)|(expected [a-zA-Z0-9 ]+, got)/.test(
          msg,
        )
      ) {
        (error as ParsingError).isUnsupportedFormatError = true;
      }

      throw error;
    }
  }

  private async parseWithoutErrorHandling(stream: ReadableStream<Uint8Array>): Promise<MediaInfo> {
    // The first 1MB of the file is read and then feed to the parser
    const MAX_PROBE_SIZE = 1 * 1024 * 1024; // 1MB
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    let bytesRead = 0;
    while (bytesRead < MAX_PROBE_SIZE) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        bytesRead += value.length;
      }
    }
    reader.cancel();

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
    const mimeType = result.mimeType || undefined;

    return {
      parser: 'remotion',
      containerDetail: result.container,
      container: toContainerType(result.container),
      durationInSeconds: durationInSeconds,
      videoStreams: result.tracks
        .filter((t) => t.type === 'video')
        .map((t) => ({
          id: t.trackId,
          codecDetail: t.codec,
          codec: toVideoCodecType(t.codec),
          width: t.width,
          height: t.height,
          durationInSeconds,
        })),
      audioStreams: result.tracks
        .filter((t) => t.type === 'audio')
        .map((t) => ({
          id: t.trackId,
          codecDetail: t.codec,
          codec: toAudioCodecType(t.codec),
          channelCount: t.numberOfChannels,
          sampleRate: t.sampleRate,
          durationInSeconds,
        })),
      mimeType,
    };
  }
}
