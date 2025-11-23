import { Readable } from 'node:stream';

import { MediaInfo } from './media-info';

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
 * @param filePath The path to the file
 * @returns A (web) ReadableStream of Uint8Array chunks
 */
export async function createReadableStreamFromFile(filePath: string): Promise<ReadableStream<Uint8Array>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module
  const fs = require('node:fs');
  const nodeReadable = fs.createReadStream(filePath);
  const webReadableStream = Readable.toWeb(nodeReadable);
  return webReadableStream;
}
