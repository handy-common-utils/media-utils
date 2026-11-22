/* eslint-disable @typescript-eslint/no-require-imports, unicorn/prefer-module */

import { createLimitedStream, validateMaxBytesToRead } from './input-streams';
import { MediaInfo } from './media-info';
import { FallbackChainParserAdapter, MediaParserAdapter } from './parsers/adapter';
import { InhouseParserAdapter } from './parsers/inhouse-parsers-adapter';
import { IsoBoxerAdapter } from './parsers/isoboxer-adapter';
import { Mp4BoxAdapter } from './parsers/mp4box-adapter';
import { RemotionAdapter } from './parsers/remotion-adapter';
import { isBlobInput, MediaInput, ParserRelatedOptions, setupGlobalLogger } from './utils';

export type GetMediaInfoOptions = ParserRelatedOptions & {
  /**
   * Whether to suppress console output.
   * Default value is true.
   */
  quiet?: boolean;
  /**
   * Whether to enable debug logging.
   * Default value is false.
   */
  debug?: boolean;
  /**
   * The maximum number of bytes (a positive integer) that can be read from the input for determining the media information.
   * If a parser needs to read more than this, a {@link MaxBytesExceededError} is thrown
   * (its `isMaxBytesExceededError` is true, and no other parser is tried after it).
   *
   * When the input is a stream, the limit applies to the total number of bytes read from the stream.
   * Because the data read from a stream is kept in memory while parsing
   * (so that another parser can be tried from the beginning of the stream),
   * this option also limits the memory used for a stream input.
   *
   * When the input is a Blob, nothing is kept in memory, and the limit applies to each parsing attempt.
   * Bytes skipped without being read (see {@link MediaInput}) are not counted.
   *
   * Parsers read in blocks (usually 64 KB, and 1 MB for the third-party parsers), and some formats are read to the end
   * (for example MXF, and MP3 without a VBR header), or for some megabytes (MPEG-TS).
   * MP4/MOV files with the `moov` box after the `mdat` box are read to the end too, unless the input is a Blob.
   * So a limit of a few megabytes is recommended, and such files fail with it.
   *
   * Default: no limit.
   */
  maxBytesToRead?: number;
  /**
   * Whether to keep and return the sample table information (`sampleTableInfo`) of MP4/MOV audio streams.
   * It is needed when the result is passed to `extractAudio()` as the `mediaInfo` option for an MP4/MOV input.
   * Only the 'media-utils' parser supports it; other parsers ignore it. Ignored for other formats.
   *
   * Default: false (sample tables are not returned to save memory)
   */
  sampleTableInfo?: boolean;
};

export type GetMediaInfoResult = MediaInfo & {
  parser: Exclude<GetMediaInfoOptions['useParser'], undefined>;
  /**
   * Number of bytes read from the stream.
   * In most cases, the parser does not need to read the whole stream.
   */
  bytesRead?: number;
};

/**
 * Get media information from a stream or a Blob
 * @param input The input, either a Web ReadableStream (not Node Readable) or a Blob (a File in the browser is also a Blob).
 *              To convert a Node Readable to Web ReadableStream, use `Readable.toWeb(nodeReadable)`.
 *              To open a file as a Blob in Node.js, use `fs.openAsBlob(path)`.
 *              A Blob is read without keeping much data in memory, see {@link MediaInput}.
 * @param optionsInput Options for the parser
 * @returns The media information
 */
export async function getMediaInfo(input: MediaInput, optionsInput?: GetMediaInfoOptions): Promise<GetMediaInfoResult> {
  const options = {
    useParser: 'auto' as GetMediaInfoOptions['useParser'],
    quiet: true,
    debug: false,
    ...optionsInput,
  };
  options.maxBytesToRead = validateMaxBytesToRead(options.maxBytesToRead);
  const logger = setupGlobalLogger(options);

  const { useParser } = options;

  let parser: MediaParserAdapter;

  switch (useParser) {
    case 'mp4box': {
      try {
        parser = await Mp4BoxAdapter.newInstance();
      } catch (error) {
        throw new Error(`Very likely NPM package mp4box is not installed: ${error}`, { cause: error });
      }
      break;
    }
    case 'remotion': {
      try {
        parser = await RemotionAdapter.newInstance();
      } catch (error) {
        throw new Error(`Very likely NPM package @remotion/media-parser is not installed: ${error}`, { cause: error });
      }
      break;
    }
    case 'isoboxer': {
      try {
        parser = await IsoBoxerAdapter.newInstance();
      } catch (error) {
        throw new Error(`Very likely NPM package codem-isoboxer is not installed: ${error}`, { cause: error });
      }
      break;
    }
    case 'media-utils': {
      parser = new InhouseParserAdapter();
      break;
    }
    case 'auto': {
      const adapters = new Array<MediaParserAdapter>();
      adapters.push(new InhouseParserAdapter());
      try {
        adapters.push(await Mp4BoxAdapter.newInstance());
      } catch {
        // Ignore
      }
      try {
        adapters.push(await RemotionAdapter.newInstance());
      } catch {
        // Ignore
      }
      if (adapters.length === 0) {
        throw new Error('Very likely none of the required NPM packages (such like mp4box, codem-isoboxer, or @remotion/media-parser) is installed');
      }
      if (logger.isDebug) logger.debug(`Using fallback parser chain for 'auto': ${adapters.map((a) => a.constructor.name).join(', ')}`);
      parser = new FallbackChainParserAdapter(adapters);
      break;
    }
    default: {
      throw new Error(`Unknown parser specified: ${useParser}`);
    }
  }

  if (isBlobInput(input) || options.maxBytesToRead === undefined) {
    // For a Blob, the limit is applied by the parser adapters to every stream they open from it.
    return parser.parse(input, options);
  }

  // For a stream, the limit is applied to everything read from it.
  // Cancelling is propagated from the limited stream to the input stream by the parser adapters.
  const limited = createLimitedStream(input, { bytesRead: 0, maxBytesToRead: options.maxBytesToRead });
  return parser.parse(limited.stream, options);
}

/**
 * Get media information from a file path.
 * The file is read as a Blob (using Node.js `fs.openAsBlob()`), which allows random access
 * without keeping much data in memory.
 * This function works in Node.js environment but not in browser.
 * @param filePath The path to the media file
 * @param options Options for the parser
 * @returns The media information
 */
export async function getMediaInfoFromFile(filePath: string, options?: GetMediaInfoOptions): Promise<GetMediaInfoResult> {
  const fs = require('node:fs');
  const blob = await fs.openAsBlob(filePath);
  return getMediaInfo(blob, options);
}
