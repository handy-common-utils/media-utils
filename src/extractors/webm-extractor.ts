import { OggMuxer } from '../codecs/ogg';
import { AudioStreamInfo, MediaInfo } from '../media-info';
import { WebmParser, WebmSample } from '../parsers/webm';
import { findAudioStreamToBeExtracted } from './utils';

export interface WebmExtractorOptions {
  trackId?: number;
  streamIndex?: number;
  quiet?: boolean;
}

/**
 * Extract audio from WebM containers (Opus, Vorbis)
 * @param input The input stream
 * @param output The output stream
 * @param mediaInfo Media information about the file
 * @param optionsInput Extraction options
 * @returns Promise that resolves when extraction is complete
 */
export async function extractFromWebm(
  input: ReadableStream<Uint8Array>,
  output: WritableStream<Uint8Array>,
  mediaInfo: MediaInfo,
  optionsInput?: WebmExtractorOptions,
): Promise<void> {
  const options = {
    quiet: true,
    ...optionsInput,
  };

  return new Promise((resolve, reject) => {
    const parser = new WebmParser();
    const writer = output.getWriter();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    function abort(error: Error) {
      if (reader) {
        reader.cancel().catch(() => {});
      }
      writer.abort(error).catch(() => {});
      reject(error);
    }

    const sampleQueue: Array<WebmSample> = [];
    let stream: AudioStreamInfo | undefined;
    let processingChain = Promise.resolve();
    let oggMuxer: OggMuxer | undefined;
    let headersWritten = false;

    const processTask = async (writer: WritableStreamDefaultWriter<Uint8Array>) => {
      while (sampleQueue.length > 0) {
        const sample = sampleQueue.shift();
        if (!sample?.data) continue;

        try {
          if (oggMuxer) {
            // Write OGG headers on first sample
            if (!headersWritten) {
              const headers = oggMuxer.createHeaders();
              for (const header of headers) {
                await writer.write(header);
              }
              headersWritten = true;
            }

            // Wrap frame in OGG page
            const oggPage = oggMuxer.muxFrame(sample.data, false, sample.time);
            await writer.write(oggPage);
          } else {
            // For non-OGG codecs, write raw frame data
            await writer.write(sample.data);
          }
        } catch (error) {
          writer.abort(error);
          throw error;
        }
      }
    };

    async function processSampleQueue(): Promise<void> {
      if (!stream) return processingChain;
      processingChain = processingChain.then(() => processTask(writer));
      return processingChain;
    }

    try {
      stream = findAudioStreamToBeExtracted(mediaInfo, options);
    } catch (error: any) {
      abort(error);
      return;
    }

    parser.onReady = (_info) => {
      // Initialize OGG muxer for Opus/Vorbis
      if (stream && (stream.codec === 'opus' || stream.codec === 'vorbis')) {
        // Find the track info to get codec private data
        const trackInfo = parser.getTrackInfo(stream.id);
        oggMuxer = new OggMuxer({
          codec: stream.codec,
          codecPrivate: trackInfo?.codecPrivate,
          sampleRate: stream.sampleRate,
          channelCount: stream.channelCount,
        });
      }
    };

    parser.onSamples = (trackId, _user, samples) => {
      if (!stream || trackId !== stream.id) return;

      for (const sample of samples) {
        sampleQueue.push(sample);
      }

      processSampleQueue().catch((error) => {
        abort(error);
      });
    };

    parser.onError = (error) => {
      abort(new Error(`WebM parser error: ${error}`));
    };

    reader = input.getReader();

    function readChunk() {
      if (!reader) return;

      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            parser.flush();

            processSampleQueue()
              .then(async () => {
                await writer.close();
                resolve();
              })
              .catch((error) => {
                writer.abort(error).catch(() => {});
                reject(error);
              });
            return;
          }

          if (value) {
            parser.appendBuffer(value.buffer as ArrayBuffer);
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
