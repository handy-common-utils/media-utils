/* eslint-disable @typescript-eslint/no-require-imports, unicorn/prefer-module */

import type { ISOFile, Sample } from 'mp4box';

import { createADTSFrame } from '../codecs/aac';
import { ExtractAudioOptions } from '../extract-audio';
import { AudioStreamInfo, MediaInfo } from '../media-info';
import { makeMp4BoxQuiet } from '../parsers/mp4box-adapter';
import { UnsupportedFormatError } from '../utils';
import { findAudioStreamToBeExtracted } from './utils';

/**
 * Extract audio from MP4/MOV containers using mp4box
 * @param input The input stream
 * @param output The output stream
 * @param mediaInfo Media information about the file
 * @param optionsInput Extraction options
 * @returns Promise that resolves when extraction is complete
 */
export async function extractFromMp4(
  input: ReadableStream<Uint8Array>,
  output: WritableStream<Uint8Array>,
  mediaInfo: MediaInfo,
  optionsInput?: ExtractAudioOptions,
): Promise<void> {
  const options = {
    quiet: true,
    ...optionsInput,
  };

  if (options.onProgress) {
    options.onProgress(0);
  }

  const mp4box: typeof import('mp4box') = require('mp4box');
  makeMp4BoxQuiet(mp4box, options?.quiet);

  return new Promise((resolve, reject) => {
    const writer = output.getWriter();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    function abort(error: Error) {
      if (reader) {
        reader.cancel().catch(() => {});
      }
      writer.abort(error).catch(() => {});
      reject(error);
    }

    const mp4file: ISOFile = mp4box.createFile(true);
    const sampleQueue: Array<Sample> = [];
    let stream: AudioStreamInfo;
    let processingChain = Promise.resolve();

    async function processSampleQueue(): Promise<void> {
      if (!stream?.codec) return processingChain;

      const task = async () => {
        while (sampleQueue.length > 0) {
          const sample = sampleQueue.shift();
          if (!sample?.data) continue;

          const sampleData = new Uint8Array(sample.data);

          if (options.onProgress && mediaInfo.durationInSeconds) {
            const currentSeconds = sample.cts / sample.timescale;
            const progress = Math.min(100, Math.round((currentSeconds / mediaInfo.durationInSeconds) * 100));
            options.onProgress(progress);
          }

          try {
            if (stream.codec === 'aac') {
              const adtsFrame = createADTSFrame(sampleData, stream);
              await writer.write(adtsFrame);
            } else if (stream.codec === 'mp3') {
              await writer.write(sampleData);
            } else {
              throw new UnsupportedFormatError(`Unsupported codec for extracting from MP4/MOV: ${stream?.codec}`);
            }
          } catch (error) {
            writer.abort(error);
            throw error;
          }
        }
      };

      processingChain = processingChain.then(task);
      return processingChain;
    }

    mp4file.onReady = (_info: any) => {
      try {
        stream = findAudioStreamToBeExtracted(mediaInfo, options);
      } catch (error: any) {
        abort(error);
        return;
      }

      mp4file.setExtractionOptions(stream.id, null, { nbSamples: 1000 });
      mp4file.start();
    };

    mp4file.onSamples = (trackId, _user, samples) => {
      if (trackId !== stream.id) return;

      for (const sample of samples) {
        sampleQueue.push(sample);
      }

      processSampleQueue().catch((error) => {
        abort(error);
      });
    };

    mp4file.onError = (e: string) => {
      abort(new Error(`MP4Box error: ${e}`));
    };

    reader = input.getReader();
    let offset = 0;

    function readChunk() {
      if (!reader) return;

      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            mp4file.flush();

            processSampleQueue()
              .then(async () => {
                await writer.close();
                if (options.onProgress) {
                  options.onProgress(100);
                }
                resolve();
              })
              .catch((error) => {
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

            readChunk();
          }
        })
        .catch((error) => {
          if (reader) {
            reader.cancel();
          }
          writer.abort(error).catch(() => {});
          reject(error);
        });
    }

    readChunk();
  });
}
