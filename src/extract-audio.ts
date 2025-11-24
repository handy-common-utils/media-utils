import type { ISOFile, Sample } from 'mp4box';

import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';

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
 * Create an ADTS frame for AAC audio data
 * ADTS (Audio Data Transport Stream) is a container format for AAC audio
 * @param aacData Raw AAC data
 * @param streamInfo Information about the original audio stream
 * @returns AAC data with ADTS header prepended
 */
function createADTSFrame(aacData: Uint8Array, streamInfo: AudioStreamInfo): Uint8Array {
  const { sampleRate = 44100, channelCount = 2 } = streamInfo;
  const profile = 2;

  // ADTS header is 7 bytes (without CRC)
  const adtsLength = 7;
  const frameLength = adtsLength + aacData.length;

  // Sampling frequency index lookup table
  const samplingFrequencies = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  const freqIndex = samplingFrequencies.indexOf(sampleRate);
  if (freqIndex === -1) {
    throw new Error(`Unsupported sample rate: ${sampleRate}`);
  }

  const adtsHeader = new Uint8Array(adtsLength);

  // Syncword (12 bits) - all 1s (0xFFF)
  adtsHeader[0] = 0xff;
  adtsHeader[1] = 0xf0;

  // MPEG version (1 bit) - 0 for MPEG-4
  // Layer (2 bits) - always 00
  // Protection absent (1 bit) - 1 (no CRC)
  adtsHeader[1] |= 0x01; // Protection absent = 1

  // Profile (2 bits) - AAC profile minus 1
  // Sampling frequency index (4 bits)
  // Private bit (1 bit) - 0
  // Channel configuration (3 bits) - starts here (2 bits)
  adtsHeader[2] = ((profile - 1) << 6) | (freqIndex << 2) | ((channelCount >> 2) & 0x01);

  // Channel configuration (1 bit continued)
  // Originality (1 bit) - 0
  // Home (1 bit) - 0
  // Copyright ID bit (1 bit) - 0
  // Copyright ID start (1 bit) - 0
  // Frame length (13 bits) - starts here (2 bits)
  adtsHeader[3] = ((channelCount & 0x03) << 6) | ((frameLength >> 11) & 0x03);

  // Frame length (11 bits continued)
  adtsHeader[4] = (frameLength >> 3) & 0xff;

  // Frame length (3 bits continued)
  // Buffer fullness (11 bits) - 0x7FF for VBR (starts here with 5 bits)
  adtsHeader[5] = ((frameLength & 0x07) << 5) | 0x1f;

  // Buffer fullness (6 bits continued)
  // Number of raw data blocks (2 bits) - 0 (meaning 1 block)
  adtsHeader[6] = 0xfc;

  // Combine ADTS header with AAC data
  const frame = new Uint8Array(frameLength);
  frame.set(adtsHeader, 0);
  frame.set(aacData, adtsLength);

  return frame;
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
