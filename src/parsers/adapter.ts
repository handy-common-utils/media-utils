import { withRetry } from '@handy-common-utils/promise-utils';
import { MediaInfo } from '../media-info';
import { GetMediaInfoOptions } from '../get-media-info';

export interface ParsingError {
  isUnsupportedFormatError?: boolean;
}

/**
 * Interface for media parser adapters.
 * Adapters bridge the gap between the generic media info extraction logic
 * and specific parser implementations (like mp4box or @remotion/media-parser).
 */
export interface MediaParserAdapter {
  /**
   * Parses the stream and extracts media information.
   * @param stream The input media stream.
   * @param options Optional options for the parser.
   * @returns A promise that resolves to the extracted media information.
   * @throws The Error thrown could implement the ParsingError interface to provide more information about the error.
   */
  parse(stream: ReadableStream<Uint8Array>, options?: GetMediaInfoOptions): Promise<MediaInfo>;
}

/**
 * A composite parser adapter that tries multiple adapters in sequence.
 * It implements the Chain of Responsibility pattern.
 */
export class FallbackChainParserAdapter implements MediaParserAdapter {
  private readonly adapters: MediaParserAdapter[];

  /**
   * Creates a new FallbackChainParserAdapter.
   * @param adapters The list of adapters to try, in order.
   */
  constructor(adapters: MediaParserAdapter[]) {
    this.adapters = adapters;
  }

  /**
   * Tries to parse the stream using the first adapter that supports it.
   * @param stream The input media stream.
   * @param options Optional options for the parser.
   * @returns The extracted media information.
   * @throws Error from the last paseing attempt.
   */
  async parse(stream: ReadableStream<Uint8Array>, options?: GetMediaInfoOptions): Promise<MediaInfo> {
    let i = 0;
    return withRetry(
      () => {
        const [s1, s2] = stream.tee();
        stream = s1;
        return this.adapters[i++].parse(s2, options);
      },
      () => 0,
      (error) => i < this.adapters.length && (error as ParsingError)?.isUnsupportedFormatError === true,
    );
  }
}
