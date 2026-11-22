/* eslint-disable @typescript-eslint/no-require-imports, unicorn/prefer-module */

import { delayedResolve } from '@handy-common-utils/promise-utils';

import { extractFromAsf } from './extractors/asf-extractor';
import { extractFromAvi } from './extractors/avi-extractor';
import { extractFromMkv } from './extractors/mkv-extractor';
import { extractFromMp4 } from './extractors/mp4-extractor';
import { extractFromMpegTs } from './extractors/mpegts-extractor';
import { extractFromMxf } from './extractors/mxf-extractor';
import { findAudioStreamToBeExtracted } from './extractors/utils';
import { getMediaInfo, GetMediaInfoOptions, GetMediaInfoResult } from './get-media-info';
import { createLimitedStream, LimitedStream, validateMaxBytesToRead } from './input-streams';
import { AsfMediaInfo } from './parsers/asf';
import { Mp4AudioStreamInfo, Mp4MediaInfo } from './parsers/mp4';
import { isBlobInput, MediaInput, ParserRelatedOptions, setupGlobalLogger, UnsupportedFormatError } from './utils';

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
  /**
   * Whether to enable debug logging.
   * Default value is false.
   */
  debug?: boolean;
  /**
   * Optional callback to receive progress updates (0-100).
   */
  onProgress?: (progress: number) => void;
  /**
   * Media information of the input, obtained earlier from the same input by
   * `getMediaInfo(input, { useParser: 'media-utils', sampleTableInfo: true })`.
   *
   * When provided, the input is not parsed again for detecting its format.
   * The input is then read only once, from the beginning to the end, and nothing read from it is kept in memory
   * apart from the data being processed.
   *
   * It must be the result for exactly the same input. `sampleTableInfo: true` is required for MP4/MOV inputs.
   * A result for a different input can't be detected, and gives a corrupted output or an error.
   */
  mediaInfo?: GetMediaInfoResult;
  /**
   * The maximum number of bytes that can be read from the input for detecting its format,
   * see `GetMediaInfoOptions.maxBytesToRead`.
   * It does not limit the reading for extracting the audio, and it is ignored when `mediaInfo` is provided.
   *
   * When the input is a stream, the bytes read for detecting the format are kept in memory until the extraction
   * has processed them, so this option also limits the memory used.
   *
   * Default: no limit.
   */
  maxBytesToReadForMediaInfo?: number;
}

/**
 * Checks that the media information provided through the `mediaInfo` option can be used for extraction.
 * @param mediaInfo The media information
 * @param options Extraction options for identifying the audio stream
 */
function validateProvidedMediaInfo(mediaInfo: GetMediaInfoResult, options?: ExtractAudioOptions): void {
  if (mediaInfo.parser !== 'media-utils') {
    throw new Error(
      `The mediaInfo option must be the result of getMediaInfo() with useParser 'media-utils', but it came from parser '${mediaInfo.parser}'`,
    );
  }

  if (mediaInfo.container !== 'mp4' && mediaInfo.container !== 'mov') {
    return;
  }

  const stream = findAudioStreamToBeExtracted(mediaInfo, options ?? {});
  if (!(stream as Mp4AudioStreamInfo).sampleTableInfo) {
    throw new Error('The mediaInfo option for an MP4/MOV input must be the result of getMediaInfo() with sampleTableInfo: true');
  }
}

/**
 * Extract raw audio data from the input
 *
 * How the input is read:
 * - If the `mediaInfo` option is provided, the input is read only once, for extracting the audio.
 * - Otherwise, if the input is a Blob, it is read once for detecting the format (large parts can be skipped
 *   without being read, see {@link MediaInput}), and then once more for extracting the audio.
 * - Otherwise (the input is a stream without `mediaInfo`), the stream is teed: one branch for detecting the format and
 *   the other for extracting the audio. Everything read for detecting the format is kept in memory until the extraction
 *   has processed it. For an MP4/MOV file with the `moov` box after the `mdat` box, that is the whole file.
 *   Use the `maxBytesToReadForMediaInfo` option to limit it.
 *
 * @param input The input data provided through a readable stream or a Blob (a File in the browser is also a Blob)
 * @param output The output stream to write extracted audio to
 * @param optionsInput Options for the extraction process
 * @returns Promise that resolves when extraction is complete
 */
export async function extractAudio(input: MediaInput, output: WritableStream<Uint8Array>, optionsInput?: ExtractAudioOptions): Promise<void> {
  const { mediaInfo: providedMediaInfo, maxBytesToReadForMediaInfo: maxBytesToReadInput, ...restOptions } = optionsInput ?? {};
  const options: ExtractAudioOptions = {
    quiet: true,
    debug: false,
    ...restOptions,
  };
  const logger = setupGlobalLogger(options);

  if (options.onProgress) {
    options.onProgress(0);
  }

  const detectionOptions: GetMediaInfoOptions = {
    ...options,
    useParser: 'media-utils',
    sampleTableInfo: true, // Always enable for MP4/MOV (will be ignored for other formats)
  };

  let extractStream: ReadableStream<Uint8Array> | undefined;
  // Only used when a stream input needs to be teed
  let limitedDetectStream: LimitedStream | undefined;

  try {
    if (options.onProgress) {
      options.onProgress(2);
    }

    // Detect container type
    let mediaInfo: GetMediaInfoResult;
    if (providedMediaInfo) {
      validateProvidedMediaInfo(providedMediaInfo, options);
      mediaInfo = providedMediaInfo;
      extractStream = isBlobInput(input) ? (input.stream() as ReadableStream<Uint8Array>) : input;
    } else {
      const maxBytesToRead = validateMaxBytesToRead(maxBytesToReadInput);
      if (isBlobInput(input)) {
        mediaInfo = await getMediaInfo(input, { ...detectionOptions, maxBytesToRead });
        // Opened only after detection, so that nothing is read from it in the meantime
        extractStream = input.stream() as ReadableStream<Uint8Array>;
      } else {
        // Tee the stream: one for detection, one for extraction
        const [detectStream, extractBranch] = input.tee();
        extractStream = extractBranch;
        // The wrapper counts and limits what detection reads, and allows the detection branch to be cancelled
        // as soon as detection has finished. Otherwise the detection branch would keep receiving (and holding in memory)
        // everything that the extraction reads.
        limitedDetectStream = createLimitedStream(detectStream, { bytesRead: 0, maxBytesToRead });
        try {
          // The limit (if any) has already been applied to the detection stream
          mediaInfo = await getMediaInfo(limitedDetectStream.stream, detectionOptions);
        } finally {
          // Stop the detection branch from receiving (and holding in memory) what the extraction reads
          limitedDetectStream.cancelSource();
        }
      }
    }
    if (options.onProgress) {
      options.onProgress(8);
      const originalOnProgress = options.onProgress;
      options.onProgress = (progress) => {
        originalOnProgress(8 + Math.round(progress * 0.92));
      };
    }
    if (logger.isDebug)
      logger.debug(
        `Detected input media info by ${mediaInfo.parser}: ${mediaInfo.container}[${mediaInfo.videoStreams.map((s) => s.codec).join(',')}][${mediaInfo.audioStreams.map((s) => s.codec).join(',')}]`,
      );

    const container = mediaInfo.container;

    // Route to appropriate extractor
    switch (container) {
      case 'mp4':
      case 'mov': {
        return await extractFromMp4(extractStream, output, mediaInfo as unknown as Mp4MediaInfo, options);
      }
      case 'mkv':
      case 'webm': {
        return await extractFromMkv(extractStream, output, mediaInfo, options);
      }
      case 'wma':
      case 'asf': {
        return await extractFromAsf(extractStream, output, mediaInfo as unknown as AsfMediaInfo, options);
      }
      case 'avi': {
        return await extractFromAvi(extractStream, output, mediaInfo, options);
      }
      case 'mpegts': {
        return await extractFromMpegTs(extractStream, output, mediaInfo, options);
      }
      case 'mxf': {
        return await extractFromMxf(extractStream, output, mediaInfo, options);
      }
      default: {
        throw new UnsupportedFormatError(
          `Unsupported container format: ${container}. Supported formats: mp4, mov, mkv/webm, asf, wma, avi, mpegts, mxf`,
        );
      }
    }
  } finally {
    // Node.js could keep pumping data to the stream for a very short period after the reader has been cancelled.
    // Let's wait for a while to ensure that data pumping has actually stopped.
    delayedResolve(800, () => {
      // Make sure that all the streams are closed
      limitedDetectStream?.cancelSource();
      // If the input stream had not been used yet (invalid options), it is cancelled too
      (extractStream ?? (isBlobInput(input) ? undefined : input))?.cancel().catch(() => {});
      output.close().catch(() => {});
    });
  }
}

/**
 * Extract raw audio data from a file
 * The file is read as a Blob (using Node.js `fs.openAsBlob()`), which avoids buffering large amounts of data in memory.
 * This function works in Node.js environment but not in browser.
 * @param filePath The path to the media file
 * @param output The output stream to write extracted audio to
 * @param options Options for the extraction process
 */
export async function extractAudioFromFile(filePath: string, output: WritableStream<Uint8Array>, options?: ExtractAudioOptions): Promise<void> {
  const fs = require('node:fs');
  const blob = await fs.openAsBlob(filePath);
  await extractAudio(blob, output, options);
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
