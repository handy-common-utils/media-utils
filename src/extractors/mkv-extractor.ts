import { createADTSFrame } from '../codecs/aac';
import { OggMuxer } from '../codecs/ogg';
import { ExtractAudioOptions } from '../extract-audio';
import { MediaInfo } from '../media-info';
import { MkvParser } from '../parsers/mkv';
import { setupGlobalLogger, UnsupportedFormatError } from '../utils';
import { findAudioStreamToBeExtracted } from './utils';

/**
 * Extract audio from MKV/WebM containers (Opus, Vorbis, etc.)
 * @param input The input stream
 * @param output The output stream
 * @param mediaInfo Media information about the file
 * @param optionsInput Extraction options
 * @returns Promise that resolves when extraction is complete
 */
export async function extractFromMkv(
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

  const writer = output.getWriter();
  let processingChain = Promise.resolve();

  try {
    const stream = findAudioStreamToBeExtracted(mediaInfo, options);

    const logger = setupGlobalLogger(options);
    if (logger.isDebug) logger.debug(`Extracting audio from MKV/WebM. Stream: ${stream.id}, Codec: ${stream.codec}`);

    let oggMuxer: OggMuxer | undefined;
    let headersWritten = false;

    const parser = new MkvParser(input, options, (trackId, samples) => {
      if (trackId !== stream.id) return;

      // Initialize OGG muxer on first sample if needed
      if (!oggMuxer && (stream.codec === 'opus' || stream.codec === 'vorbis')) {
        const trackInfo = parser.getTrackInfo(stream.id);
        oggMuxer = new OggMuxer({
          codec: stream.codec,
          codecPrivate: trackInfo?.codecPrivate,
          sampleRate: stream.sampleRate,
          channelCount: stream.channelCount,
        });
      }

      // Queue processing
      processingChain = processingChain.then(async () => {
        for (const sample of samples) {
          if (!sample.data) continue;

          if (options.onProgress && mediaInfo.durationInSeconds) {
            const progress = Math.min(100, Math.round((sample.time / mediaInfo.durationInSeconds) * 100));
            options.onProgress(progress);
          }

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
          } else if (stream?.codec === 'aac') {
            const adtsFrame = createADTSFrame(sample.data, stream);
            await writer.write(adtsFrame);
          } else if (stream?.codec === 'mp3') {
            await writer.write(sample.data);
          } else {
            throw new UnsupportedFormatError(`Unsupported codec for extracting from MKV/WebM: ${stream?.codec}`);
          }
        }
      });
    });

    await parser.parse();
    // Wait for all samples to be written
    await processingChain;

    if (options.onProgress) {
      options.onProgress(100);
    }
  } catch (error) {
    await writer.abort(error).catch(() => {});
    throw error;
  } finally {
    await writer.close().catch(() => {});
    writer.releaseLock();
  }
}
