import { isBlobInput, MaxBytesExceededError, MediaInput } from './utils';

// Internal helpers for reading the input with counting, limiting and random access.
// They are not exported from the package.

/**
 * Validates the `maxBytesToRead` option.
 * @param maxBytesToRead The value of the option
 * @returns The value if it is valid, or undefined if there is no limit
 */
export function validateMaxBytesToRead(maxBytesToRead: number | undefined | null): number | undefined {
  if (maxBytesToRead == null || maxBytesToRead === Infinity) return undefined;
  if (typeof maxBytesToRead !== 'number' || !Number.isSafeInteger(maxBytesToRead) || maxBytesToRead <= 0) {
    throw new RangeError(`maxBytesToRead must be a positive integer, but it is ${maxBytesToRead}`);
  }
  return maxBytesToRead;
}

/**
 * Shared byte counter used by {@link createLimitedStream}.
 * @internal
 */
export interface ReadCounter {
  /** Number of bytes passed through so far */
  bytesRead: number;
  /** Maximum number of bytes allowed to pass through, undefined means no limit */
  maxBytesToRead?: number;
}

/**
 * A stream that counts and limits the bytes read from an underlying stream.
 * @internal
 */
export interface LimitedStream {
  /** The stream to be read */
  stream: ReadableStream<Uint8Array>;
  /**
   * Stops reading from the underlying stream and cancels it immediately, without waiting for the cancellation to complete.
   * (Cancelling a branch of a teed stream doesn't complete until the other branch is cancelled too.)
   * The limited stream closes, as if the underlying stream had ended.
   */
  cancelSource(): void;
}

/**
 * Wraps a stream so that the bytes read are counted, and the stream errors with {@link MaxBytesExceededError}
 * when more than `counter.maxBytesToRead` bytes would be needed.
 *
 * Bytes are pulled from the underlying stream only when the returned stream is read (high water mark 0),
 * so that nothing is read ahead.
 * Several limited streams can share the same counter, the limit then applies to the total.
 *
 * @param source The underlying stream
 * @param counter The counter, possibly shared
 * @returns The limited stream and a function for cancelling the underlying stream
 * @internal
 */
export function createLimitedStream(source: ReadableStream<Uint8Array>, counter: ReadCounter): LimitedStream {
  const reader = source.getReader();
  let limitReached = false;
  let sourceCancelled = false;
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;

  // Never wait for the cancellation, because cancelling a branch of a teed stream
  // doesn't complete until the other branch is cancelled too.
  const cancelSource = (reason?: unknown) => {
    if (sourceCancelled) return;
    sourceCancelled = true;
    reader.cancel(reason).catch(() => {});
  };

  const stream = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        streamController = controller;
      },
      async pull(controller) {
        if (sourceCancelled) {
          controller.close();
          return;
        }
        if (limitReached) {
          // There is more data in the underlying stream, but we are not allowed to read it.
          controller.error(new MaxBytesExceededError(counter.maxBytesToRead!));
          cancelSource();
          return;
        }
        let result: ReadableStreamReadResult<Uint8Array>;
        try {
          result = await reader.read();
        } catch (error) {
          if (sourceCancelled) return;
          throw error;
        }
        // cancelSource() may have been called (and this stream closed) while waiting for the read
        if (sourceCancelled) return;
        if (result.done) {
          controller.close();
          return;
        }
        const chunk = result.value;
        const max = counter.maxBytesToRead;
        if (max !== undefined && counter.bytesRead + chunk.length > max) {
          const remaining = max - counter.bytesRead;
          limitReached = true;
          if (remaining > 0) {
            counter.bytesRead += remaining;
            // A copy rather than a view, because some consumers use chunk.buffer directly.
            // (Buffer.prototype.slice would return a view, so Uint8Array.prototype.slice is used explicitly.)
            controller.enqueue(Uint8Array.prototype.slice.call(chunk, 0, remaining));
          } else {
            controller.error(new MaxBytesExceededError(max));
            cancelSource();
          }
          return;
        }
        counter.bytesRead += chunk.length;
        controller.enqueue(chunk);
      },
      cancel(reason) {
        cancelSource(reason);
      },
    },
    { highWaterMark: 0 },
  );

  return {
    stream,
    cancelSource: () => {
      cancelSource();
      try {
        streamController?.close();
      } catch {
        // already closed or errored
      }
    },
  };
}

/**
 * Random access to the input, available when the input is a Blob.
 * @internal
 */
export interface RandomAccessInput {
  /** Total size of the input in bytes */
  size: number;
  /**
   * Opens a new stream that starts at the given offset
   * @param offset The offset from the beginning of the input
   * @returns The stream
   */
  streamFrom(offset: number): ReadableStream<Uint8Array>;
  /**
   * Cancels all the streams opened by `streamFrom()`, whether or not their readers have been released.
   */
  close(): void;
}

/**
 * Creates the random access helper for a Blob, with all the streams sharing the same counter.
 * @param blob The Blob
 * @param counter The counter, which also carries the limit
 * @returns The random access helper
 * @internal
 */
export function createRandomAccessInput(blob: Blob, counter: ReadCounter): RandomAccessInput {
  const opened: LimitedStream[] = [];
  return {
    size: blob.size,
    streamFrom(offset: number) {
      const source = (offset > 0 ? blob.slice(offset) : blob).stream() as ReadableStream<Uint8Array>;
      const limited = createLimitedStream(source, counter);
      opened.push(limited);
      return limited.stream;
    },
    close() {
      for (const limited of opened.splice(0)) {
        limited.cancelSource();
      }
    },
  };
}

/**
 * Opens a stream from the beginning of the input.
 * If the input is a Blob, a new stream is created from it and the limit is applied to it.
 * If the input is a stream, it is returned as is (the limit, if any, is applied by the caller).
 * @param input The input
 * @param maxBytesToRead Optional limit, only applied when the input is a Blob
 * @returns The stream, and a function to be called when done, which cancels the stream if it was opened from a Blob
 * @internal
 */
export function openInputStream(input: MediaInput, maxBytesToRead?: number): { stream: ReadableStream<Uint8Array>; close: () => void } {
  if (isBlobInput(input)) {
    const randomAccess = createRandomAccessInput(input, { bytesRead: 0, maxBytesToRead });
    return { stream: randomAccess.streamFrom(0), close: () => randomAccess.close() };
  }
  return { stream: input, close: () => {} };
}
