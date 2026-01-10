import { ExtractAudioOptions } from '../extract-audio';
import { AudioCodecType, MediaInfo } from '../media-info';
import { parseMpegTs } from '../parsers/mpegts';
import { setupGlobalLogger, UnsupportedFormatError } from '../utils';
import { findAudioStreamToBeExtracted } from './utils';

const supportedAudioCodecs = new Set<AudioCodecType>(['aac', 'aac_latm', 'mp2', 'mp3']);

/**
 * Extract audio from MPEG-TS containers (AAC, MP3, MP2)
 * @param input The input stream
 * @param output The output stream
 * @param mediaInfo Media information about the file
 * @param optionsInput Extraction options
 * @returns Promise that resolves when extraction is complete
 */
export async function extractFromMpegTs(
  input: ReadableStream<Uint8Array>,
  output: WritableStream<Uint8Array>,
  mediaInfo: MediaInfo,
  optionsInput?: ExtractAudioOptions,
): Promise<void> {
  const options = {
    quiet: true,
    debug: false,
    ...optionsInput,
  };

  if (options.onProgress) {
    options.onProgress(0);
  }

  const writer = output.getWriter();
  let processingChain = Promise.resolve();

  try {
    const stream = findAudioStreamToBeExtracted(mediaInfo, options);
    if (!supportedAudioCodecs.has(stream.codec)) {
      throw new UnsupportedFormatError(`Unsupported codec for extracting from MPEG-TS: ${stream.codec}`);
    }

    const logger = setupGlobalLogger(options);
    if (logger.isDebug) logger.debug(`Extracting audio from MPEG-TS. Stream: ${stream.id}, Codec: ${stream.codec}`);

    await parseMpegTs(input, options, async (streamId, samples) => {
      if (streamId !== stream.id) return;

      // Queue processing to maintain order
      processingChain = processingChain.then(async () => {
        for (const sample of samples) {
          if (!sample || sample.length === 0) continue;

          if (stream.codec === 'aac') {
            // AAC in MPEG-TS is already in ADTS frames
            await writer.write(sample);
          } else if (stream.codec === 'mp3' || stream.codec === 'mp2') {
            // MP3/MP2 frames can be written directly
            await writer.write(sample);
          }
        }
      });
    });

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
