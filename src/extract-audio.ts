/* eslint-disable @typescript-eslint/no-require-imports, unicorn/prefer-module */

import { extractFromAsf } from './extractors/asf-extractor';
import { extractFromMp4 } from './extractors/mp4-extractor';
import { extractFromWebm } from './extractors/webm-extractor';
import { getMediaInfo } from './get-media-info';
import { AsfMediaInfo } from './parsers/asf';
import { createReadableStreamFromFile, ParserRelatedOptions, UnsupportedFormatError } from './utils';

export interface ExtractAudioOptions extends ParserRelatedOptions {
  /**
   * The ID of the track to extract audio from
   * If this option is provided, `streamIndex` is ignored.
   * If both `trackId` and `streamIndex` are not provided,
   * the first audio stream/track will be extracted.
   */
  trackId?: number;
  /**
   * The index of the stream/track to extract audio from.
   * If this option is provided, `trackId` is ignored.
   * If `trackId` is not provided and this option is not specified,
   * the first audio stream/track will be extracted.
   */
  streamIndex?: number;
  /**
   * Whether to suppress console output.
   * Default value is true.
   */
  quiet?: boolean;
}

/**
 * Extract raw audio data from the input
 * @param input The input data provided through a readable stream
 * @param output The output stream to write extracted audio to
 * @param optionsInput Options for the extraction process
 * @returns Promise that resolves when extraction is complete
 */
export async function extractAudio(
  input: ReadableStream<Uint8Array>,
  output: WritableStream<Uint8Array>,
  optionsInput?: ExtractAudioOptions,
): Promise<void> {
  const options = {
    quiet: true,
    ...optionsInput,
  };

  // Tee the stream: one for detection, one for extraction
  const [detectStream, extractStream] = input.tee();

  // Detect container type
  const mediaInfo = await getMediaInfo(detectStream, options);
  const container = mediaInfo.container;

  // Route to appropriate extractor
  switch (container) {
    case 'mp4':
    case 'mov': {
      return extractFromMp4(extractStream, output, mediaInfo, options);
    }
    case 'webm': {
      return extractFromWebm(extractStream, output, mediaInfo, options);
    }
    case 'wma':
    case 'asf': {
      return extractFromAsf(extractStream, output, mediaInfo as unknown as AsfMediaInfo, options);
    }
    default: {
      throw new UnsupportedFormatError(`Unsupported container format: ${container}. Supported formats: mp4, mov, webm, asf, wma`);
    }
  }
}

/**
 * Extract raw audio data from a file
 * This function works in Node.js environment but not in browser.
 * @param filePath The path to the media file
 * @param output The output stream to write extracted audio to
 * @param options Options for the extraction process
 */
export async function extractAudioFromFile(filePath: string, output: WritableStream<Uint8Array>, options?: ExtractAudioOptions): Promise<void> {
  const inputStream = await createReadableStreamFromFile(filePath);
  await extractAudio(inputStream, output, options);
}

/**
 * Extract raw audio data from a file and write to an output file
 * This function works in Node.js environment but not in browser.
 * @param inputFilePath The path to the input media file
 * @param outputFilePath The path to the output audio file
 * @param options Options for the extraction process
 */
export async function extractAudioFromFileToFile(inputFilePath: string, outputFilePath: string, options?: ExtractAudioOptions): Promise<void> {
  const fs = require('node:fs');
  const path = require('node:path');
  const { Writable } = require('node:stream');

  const dir = path.dirname(outputFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const fileWriteStream = fs.createWriteStream(outputFilePath);
  const webWritableStream = Writable.toWeb(fileWriteStream);

  await extractAudioFromFile(inputFilePath, webWritableStream, options);
}
