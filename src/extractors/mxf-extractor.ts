import { ExtractAudioOptions } from '../extract-audio';
import { isPCM, MediaInfo } from '../media-info';
import { parseMxf } from '../parsers/mxf';
import { setupGlobalLogger, UnsupportedFormatError } from '../utils';
import { findAudioStreamToBeExtracted } from './utils';
import { WavWriter } from './wav-writer';

/**
 * Extract audio from MXF containers.
 * @param input - The input stream.
 * @param output - The output stream.
 * @param mediaInfo - The media information.
 * @param optionsInput - Extraction options.
 */
export async function extractFromMxf(
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
  const logger = setupGlobalLogger(options);
  try {
    const audioStream = findAudioStreamToBeExtracted(mediaInfo, options);

    if (!isPCM(audioStream.codec)) {
      throw new UnsupportedFormatError(`Unsupported audio codec for MXF extraction: ${audioStream.codec}`);
    }

    if (logger.isDebug)
      logger.debug(
        `Extracting audio from MXF. Stream: ${audioStream.id}, Essence ID: ${audioStream.codecDetails?.essenceTrackNumber}, Codec: ${audioStream.codec}`,
      );

    // If essenceTrackNumber is not provided, we fallback to common OP1a sound essence key
    const targetEssenceTrackNumber = audioStream.codecDetails?.essenceTrackNumber || 0x1601;

    let totalDataWritten = 0;
    let estimatedTotalSize = 0;
    if (audioStream.durationInSeconds && audioStream.bitrate) {
      estimatedTotalSize = Math.floor((audioStream.durationInSeconds * audioStream.bitrate) / 8);
    }

    function reportProgress() {
      if (options.onProgress && estimatedTotalSize > 0) {
        const progress = Math.min(100, Math.floor((totalDataWritten / estimatedTotalSize) * 100));
        options.onProgress(progress);
      }
    }

    const wavWriter = new WavWriter(writer, audioStream);

    await parseMxf(input, {
      ...options,
      onSamples: async ({ streamInfo, data }) => {
        // streamInfo.id in onSamples is the essenceTrackNumber (e.g. 0x1601)
        if (streamInfo.id === targetEssenceTrackNumber) {
          wavWriter.appendData(data);
          totalDataWritten += data.length;
          reportProgress();
        }
      },
    });

    await wavWriter.writeAll();

    if (options.onProgress) {
      options.onProgress(100);
    }
  } catch (error) {
    logger.error(`MXF extraction failed: ${error}`);
    await writer.abort(error).catch(() => {});
    throw error;
  } finally {
    await writer.close().catch(() => {});
    writer.releaseLock();
  }
}
