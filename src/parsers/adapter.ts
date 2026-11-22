import { delayedResolve, withRetry } from '@handy-common-utils/promise-utils';

import { GetMediaInfoOptions, GetMediaInfoResult } from '../get-media-info';
import { isBlobInput, MediaInput, ParsingError } from '../utils';

/**
 * Interface for media parser adapters.
 * Adapters bridge the gap between the generic media info extraction logic
 * and specific parser implementations (like mp4box or `@remotion/media-parser`).
 */
export interface MediaParserAdapter {
  /**
   * Parses the input and extracts media information.
   * @param input The input media stream or Blob.
   *              If it is a Blob, the adapter opens streams from it by itself,
   *              and applies `options.maxBytesToRead` (if any) to them.
   * @param options Optional options for the parser.
   * @returns A promise that resolves to the extracted media information.
   * @throws The Error thrown could implement the ParsingError interface to provide more information about the error.
   */
  parse(input: MediaInput, options?: GetMediaInfoOptions): Promise<GetMediaInfoResult>;
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
   * Tries to parse the input using the first adapter that supports it.
   * @param input The input media stream or Blob.
   * @param options Optional options for the parser.
   * @returns The extracted media information.
   * @throws Error from the last paseing attempt.
   */
  async parse(input: MediaInput, options?: GetMediaInfoOptions): Promise<GetMediaInfoResult> {
    let i = 0;
    if (isBlobInput(input)) {
      // A Blob can be read again from the beginning, so there's no need to tee.
      return withRetry(
        () => this.adapters[i++].parse(input, options),
        () => 0,
        (error) => i < this.adapters.length && (error as ParsingError)?.isUnsupportedFormatError === true,
      );
    }
    let stream = input;
    try {
      // Must be awaited here, otherwise the finally block would run (and schedule the cancellation of the stream)
      // while parsing is still going on, and a rejection would be unhandled while the finally block was waiting.
      return await withRetry(
        () => {
          const [s1, s2] = stream.tee();
          stream = s1;
          return this.adapters[i++].parse(s2, options);
        },
        () => 0,
        (error) => i < this.adapters.length && (error as ParsingError)?.isUnsupportedFormatError === true,
      );
    } finally {
      // Node.js could keep pumping data to the stream for a very short period after the reader has been cancelled.
      // Let's wait for a while to ensure that data pumping has actually stopped.
      // (Not awaited, so that the result is returned without waiting.)
      delayedResolve(100, () => stream.cancel().catch(() => {}));
    }
  }
}
