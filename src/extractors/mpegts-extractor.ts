import { ExtractAudioOptions } from '../extract-audio';
import { AudioStreamInfo, MediaInfo } from '../media-info';
import { parseMpegTs } from '../parsers/mpegts';
import { UnsupportedFormatError } from '../utils';
import { findAudioStreamToBeExtracted } from './utils';

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
    ...optionsInput,
  };

  if (options.onProgress) {
    options.onProgress(0);
  }

  const writer = output.getWriter();
  let processingChain = Promise.resolve();
  let stream: AudioStreamInfo | undefined;

  try {
    stream = findAudioStreamToBeExtracted(mediaInfo, options);
  } catch (error: any) {
    writer.abort(error).catch(() => {});
    throw error;
  }

  // Validate codec support
  if (stream.codec !== 'aac' && stream.codec !== 'mp3' && stream.codec !== 'mp2') {
    const error = new UnsupportedFormatError(`Unsupported codec for extracting from MPEG-TS: ${stream.codec}`);
    writer.abort(error).catch(() => {});
    throw error;
  }

  try {
    await parseMpegTs(input, options, async (streamId, samples) => {
      if (!stream || streamId !== stream.id) return;

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
    await writer.close();
    if (options.onProgress) {
      options.onProgress(100);
    }
  } catch (error) {
    writer.abort(error).catch(() => {});
    throw error;
  }
}
