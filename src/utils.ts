/* eslint-disable @typescript-eslint/no-require-imports, unicorn/prefer-module */

import { MediaInfo } from './media-info';

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
  useParser?: MediaInfo['parser'];
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
