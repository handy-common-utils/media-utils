import type { ISOFile, Sample } from 'mp4box';

import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';

import { createADTSFrame } from './codec-utils';
import { AudioStreamInfo } from './media-info';
import { mp4boxInfoToMediaInfo } from './parsers/mp4box-adapter';
import { createReadableStreamFromFile } from './utils';

export interface ExtractAudioOptions {
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
}

/**
 * Extract raw audio data from the input
 * @param input The input data provided through a readable stream
 * @param output The output stream to write extracted audio to
 * @param options Options for the extraction process
 */
export async function extractAudio(
  input: ReadableStream<Uint8Array>,
  output: WritableStream<Uint8Array>,
  options?: ExtractAudioOptions,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module
  const mp4box = require('mp4box');

  return new Promise((resolve, reject) => {
    const writer = output.getWriter();

    function abort(error: Error) {
      writer.abort(error);
      reject(error);
    }

    const mp4file: ISOFile = mp4box.createFile();

    // CRITICAL: Set discardMdatData to false to prevent mp4box from discarding
    // mdat data before extraction is set up. This is essential for files where
    // mdat comes before moov (e.g., MOV files, some MP4s), because onReady fires
    // after mdat has been parsed, and without this flag the sample data would be gone.
    (mp4file as any).discardMdatData = false;

    // Queue to store extracted samples
    const sampleQueue: Array<Sample> = [];

    /**
     * The audio stream/track to be extracted
     */
    let stream: AudioStreamInfo;

    // Promise chain to ensure sequential processing
    let processingChain = Promise.resolve();

    /**
     * Wait for all previous samples to be processed,
     * then process all the samples currently in the queue.
     * @returns A Promise that resolves when all previous samples and current samples have been processed.
     */
    async function processSampleQueue(): Promise<void> {
      if (!stream?.codec) return processingChain;

      const task = async () => {
        while (sampleQueue.length > 0) {
          const sample = sampleQueue.shift();
          if (!sample?.data) continue;

          const sampleData = new Uint8Array(sample.data);

          try {
            if (stream.codec === 'aac') {
              // AAC codec - need to add ADTS headers
              const adtsFrame = createADTSFrame(sampleData, stream);
              await writer.write(adtsFrame);
            } else if (stream.codec === 'mp3') {
              // MP3 codec - samples should already have frame headers
              await writer.write(sampleData);
            } else {
              // For other codecs, just pass through the raw data
              await writer.write(sampleData);
            }
          } catch (error) {
            writer.abort(error);
            throw error;
          }
        }
      };

      // Chain the task
      processingChain = processingChain.then(task);
      return processingChain;
    }

    mp4file.onReady = (info: any) => {
      const mediaInfo = mp4boxInfoToMediaInfo(info);

      console.error('Got mediaInfo', mediaInfo);

      if (mediaInfo.audioStreams.length === 0) {
        const error = new Error('No audio streams/tracks found');
        abort(error);
        return;
      }

      if (options?.trackId) {
        // Use trackId if provided
        const streamFound = mediaInfo.audioStreams.find((t: any) => t.id === options.trackId);
        if (!streamFound) {
          const error = new Error(
            `Audio stream/track with ID ${options.trackId} not found. Available track IDs: ${mediaInfo.audioStreams.map((t: any) => t.id).join(', ')}`,
          );
          abort(error);
          return;
        }
        stream = streamFound;
      } else {
        // Use streamIndex (defaults to 0)
        const streamIndex = options?.streamIndex ?? 0;
        if (streamIndex >= mediaInfo.audioStreams.length) {
          const error = new Error(
            `Audio stream/track index ${streamIndex} not found. Available streams/tracks: 0 - ${mediaInfo.audioStreams.length - 1}`,
          );
          abort(error);
          return;
        }
        stream = mediaInfo.audioStreams[streamIndex];
      }

      // Set up extraction
      mp4file.setExtractionOptions(stream.id, null, {
        nbSamples: 1000, // size of a batch
      });

      mp4file.start();
      console.error('Called mp4file.start()', stream.id);
    };

    mp4file.onSamples = (trackId, _user, samples) => {
      if (trackId !== stream.id) return;

      console.error('Got samples', trackId, samples.length);

      // Store samples in queue
      for (const sample of samples) {
        sampleQueue.push(sample);
      }

      // Process the queue
      processSampleQueue().catch((error) => {
        abort(error);
      });
    };

    mp4file.onError = (e: string) => {
      const error = new Error(`MP4Box error: ${e}`);
      console.error(error);
      abort(error);
    };

    // Start reading the input stream
    const reader = input.getReader();
    let offset = 0;

    function readChunk() {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            mp4file.flush();
            console.error('done', offset);

            // Process any remaining samples and wait for chain to finish, then all done.
            processSampleQueue()
              .then(async () => {
                await writer.close();
                resolve();
              })
              .catch((error) => {
                // Ignore error if writer is already closed/aborted
                writer.abort(error).catch(() => {});
                reject(error);
              });
            return;
          }

          if (value) {
            const buffer = value.buffer as ArrayBuffer & {
              fileStart: number;
            };
            buffer.fileStart = offset;
            mp4file.appendBuffer(buffer);
            offset += value.length;
            console.error('Appended buffer', buffer.byteLength, offset);

            readChunk();
          }
        })
        .catch((error) => {
          reader.cancel();
          writer.abort(error).catch(() => {});
          reject(error);
        });
    }

    // Start reading the input stream immediately so mp4box can parse the file
    readChunk();
  });
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
  const dir = path.dirname(outputFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const fileWriteStream = fs.createWriteStream(outputFilePath);
  const webWritableStream = Writable.toWeb(fileWriteStream);

  await extractAudioFromFile(inputFilePath, webWritableStream, options);
}
