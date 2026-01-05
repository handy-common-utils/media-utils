/* eslint-disable @typescript-eslint/no-require-imports, unicorn/prefer-module */

import { ConsoleLineLogger, LineLogger } from '@handy-common-utils/misc-utils';

function env(): Record<string, string | undefined> {
  if (typeof process !== 'undefined') {
    return process.env;
  }
  return {};
}

/**
 * This is the global logger for the library.
 * It can be changed using the `setLogger` function.
 */
let logger: undefined | ConsoleLineLogger;

/**
 * Returns the global logger for the library.
 * If the logger has not been set, it will be initialized default settings which discards all logs.
 * Please note that environment variables MEDIA_UTILS_LOG_QUIET and MEDIA_UTILS_LOG_DEBUG can be used to override the logging behavior.
 * @returns The global logger for the library.
 */
export function getGlobalLogger(): ConsoleLineLogger {
  if (logger == null) {
    logger = LineLogger.console({
      quiet: (env().MEDIA_UTILS_LOG_QUIET?.toLowerCase() || 'true') === 'true',
      debug: (env().MEDIA_UTILS_LOG_DEBUG?.toLowerCase() || 'false') === 'true',
    });
  }
  return logger;
}

/**
 * Set the global logger for the library.
 * External facing modules could use this function to alter the global logger instance
 * based on the needs of the consumer of the library.
 * @param newLogger The new logger to use.
 */
// export function setGlobalLogger(newLogger: any) {
//   logger = newLogger;
// }

/**
 * Set the global logger for the library to a new console logger.
 * Please note that environment variables MEDIA_UTILS_LOG_QUIET and MEDIA_UTILS_LOG_DEBUG can be used to override the logging behavior.
 * @param flags The flags to pass to the console logger.
 * @param flags.quiet Whether to suppress console output.
 * @param flags.debug Whether to enable debug logging.
 * @returns The global logger for the library.
 */
export function setupGlobalLogger(flags: { quiet?: boolean; debug?: boolean } | undefined | null): ConsoleLineLogger {
  logger = LineLogger.console({
    ...flags,
    ...(env().MEDIA_UTILS_LOG_QUIET
      ? {
          quiet: env().MEDIA_UTILS_LOG_QUIET?.toLowerCase() === 'true',
        }
      : undefined),
    ...(env().MEDIA_UTILS_LOG_DEBUG
      ? {
          debug: env().MEDIA_UTILS_LOG_DEBUG?.toLowerCase() === 'true',
        }
      : undefined),
  });
  return logger;
}

export interface ParsingError {
  isUnsupportedFormatError?: boolean;
}

/**
 * Error thrown when a parser encounters an unsupported file format or invalid data.
 */
export class UnsupportedFormatError extends Error implements ParsingError {
  readonly isUnsupportedFormatError = true;

  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFormatError';
  }
}

export interface ParserRelatedOptions {
  /**
   * Which parser library/package to use
   * The default is 'auto', which will try to use mp4box first and fallback to remotion if mp4box fails.
   */
  useParser?: 'auto' | 'mp4box' | 'remotion' | 'isoboxer' | 'media-utils';
}

/**
 * Creates a Web ReadableStream from a Node.js file path.
 * This function works in Node.js environment but not in browser.
 *
 * **Important:** The caller is responsible for properly consuming or cancelling
 * the returned stream to ensure the underlying file handle is released.
 * If the stream is not fully consumed, call `stream.cancel()` to clean up resources.
 *
 * @param filePath The path to the file
 * @returns A (web) ReadableStream of Uint8Array chunks
 */
export async function createReadableStreamFromFile(filePath: string): Promise<ReadableStream<Uint8Array>> {
  const fs = require('node:fs');
  const { Readable } = require('node:stream');

  const nodeReadable = fs.createReadStream(filePath);
  const webReadableStream = Readable.toWeb(nodeReadable);
  return webReadableStream;
}

/**
 * Reads a Web ReadableStream and writes it to a file.
 * This function works in Node.js environment but not in browser.
 * @param stream The readable stream to read from
 * @param filePath The path to the file to write to
 */
export async function readFromStreamToFile(stream: ReadableStream<Uint8Array>, filePath: string): Promise<void> {
  const fs = require('node:fs');
  const path = require('node:path');

  // Ensure output directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const reader = stream.getReader();
  const writeStream = fs.createWriteStream(filePath);
  const writePromise = new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        writeStream.write(value);
      }
    }
  } catch (error) {
    // Cancel reader to release the stream lock
    reader.cancel().catch(() => {});
    throw error;
  } finally {
    writeStream.end();
    await writePromise;
  }
}

/**
 * Ensures that the buffer has enough data by reading from the stream if necessary.
 * This function manages buffer compaction and appending new data.
 *
 * @param reader The ReadableStreamDefaultReader to read from
 * @param buffer The current data buffer (optional, defaults to empty buffer)
 * @param bufferOffset The current offset in the buffer (optional, defaults to 0)
 * @param size The minimum required size of data available in the buffer (buffer.length - bufferOffset)
 * @returns An object containing the updated buffer, bufferOffset, and a boolean indicating if the stream has ended
 */
export async function ensureBufferData(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  buffer?: Uint8Array,
  bufferOffset?: number,
  size: number = 64 * 1024,
): Promise<{ buffer: Uint8Array; bufferOffset: number; done: boolean; bytesRead: number }> {
  let currentBuffer = buffer ?? new Uint8Array(0);
  let currentOffset = bufferOffset ?? 0;
  let bytesRead = 0;

  while (currentBuffer.length - currentOffset < size) {
    const { done, value } = await reader.read();
    if (value) {
      bytesRead += value.length;
      if (currentOffset > 0) {
        // Compact buffer
        currentBuffer = currentBuffer.subarray(currentOffset);
        currentOffset = 0;
      }
      const newBuffer = new Uint8Array(currentBuffer.length + value.length);
      newBuffer.set(currentBuffer);
      newBuffer.set(value, currentBuffer.length);
      currentBuffer = newBuffer;
    }
    if (done) {
      return { buffer: currentBuffer, bufferOffset: currentOffset, done: true, bytesRead };
    }
  }
  return { buffer: currentBuffer, bufferOffset: currentOffset, done: false, bytesRead };
}

/**
 * Reads the beginning of a stream up to a specified size.
 * This function handles reading, buffering, and closing the reader.
 *
 * @param reader The ReadableStreamDefaultReader to read from
 * @param size The amount of data to read (optional, defaults to 64KB)
 * @returns The read data as a Uint8Array
 */
export async function readBeginning(reader: ReadableStreamDefaultReader<Uint8Array>, size: number = 64 * 1024): Promise<Uint8Array> {
  try {
    const { buffer } = await ensureBufferData(reader, undefined, undefined, size);
    return buffer;
  } finally {
    reader.cancel().catch(() => {});
  }
}
