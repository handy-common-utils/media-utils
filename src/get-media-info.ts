import { MediaInfo } from './media-info';
import { FallbackChainParserAdapter, MediaParserAdapter } from './parsers/adapter';
import { IsoBoxerAdapter } from './parsers/isoboxer-adapter';
import { Mp4BoxAdapter } from './parsers/mp4box-adapter';
import { RemotionAdapter } from './parsers/remotion-adapter';
import { createReadableStreamFromFile, ParserRelatedOptions } from './utils';

export type GetMediaInfoOptions = ParserRelatedOptions;

/**
 * Get media information from a stream
 * @param stream The input Web ReadableStream (not Node Readable).
 *               To convert a Node Readable to Web ReadableStream, use `Readable.toWeb(nodeReadable)`.
 * @param options Options for the parser
 * @returns The media information
 */
export async function getMediaInfo(
  stream: ReadableStream<Uint8Array>,
  options?: GetMediaInfoOptions,
): Promise<MediaInfo & { parser: Exclude<GetMediaInfoOptions['useParser'], undefined> }> {
  const useParser = options?.useParser ?? 'auto';

  let parser: MediaParserAdapter;

  switch (useParser) {
    case 'mp4box': {
      try {
        parser = new Mp4BoxAdapter();
      } catch (error) {
        throw new Error(`Very likely NPM package mp4box is not installed: ${error}`);
      }
      break;
    }
    case 'remotion': {
      try {
        parser = new RemotionAdapter();
      } catch (error) {
        throw new Error(`Very likely NPM package @remotion/media-parser is not installed: ${error}`);
      }
      break;
    }
    case 'isoboxer': {
      try {
        parser = new IsoBoxerAdapter();
      } catch (error) {
        throw new Error(`Very likely NPM package codem-isoboxer is not installed: ${error}`);
      }
      break;
    }
    case 'auto': {
      const adapters = new Array<MediaParserAdapter>();
      try {
        adapters.push(new Mp4BoxAdapter());
      } catch {
        // Ignore
      }
      try {
        adapters.push(new IsoBoxerAdapter());
      } catch {
        // Ignore
      }
      try {
        adapters.push(new RemotionAdapter());
      } catch {
        // Ignore
      }
      if (adapters.length === 0) {
        throw new Error('Very likely none of the required NPM packages (such like mp4box, codem-isoboxer, or @remotion/media-parser) is installed');
      }
      parser = new FallbackChainParserAdapter(adapters);
      break;
    }
    default: {
      throw new Error(`Unknown parser specified: ${useParser}`);
    }
  }

  const info = await parser.parse(stream, options);
  return info;
}

/**
 * Get media information from a file path.
 * This function works in Node.js environment but not in browser.
 * @param filePath The path to the media file
 * @param options Options for the parser
 * @returns The media information
 */
export async function getMediaInfoFromFile(filePath: string, options?: GetMediaInfoOptions): Promise<MediaInfo> {
  const webStream = await createReadableStreamFromFile(filePath);
  return getMediaInfo(webStream, options);
}
