import { ExtractAudioOptions } from '../extract-audio';
import { isPCM, MediaInfo } from '../media-info';
import { parseAvi } from '../parsers/avi';
import { setupGlobalLogger, UnsupportedFormatError } from '../utils';
import { findAudioStreamToBeExtracted } from './utils';
import { WavWriter } from './wav-writer';

/**
 * Extract audio from AVI containers
 *
 * AVI Structure Overview:
 * ----------------------
 * AVI is built on RIFF (Resource Interchange File Format) with the following layout:
 *
 * RIFF ('AVI ')
 *   LIST 'hdrl'    ← headers (stream info, codec config)
 *   LIST 'movi'    ← media data (interleaved audio+video chunks)
 *   idx1           ← index of chunks (optional)
 *
 * Audio Chunks in 'movi' LIST:
 * ----------------------------
 * Each audio chunk has the format:
 *   xxwb <size> <payload>
 *
 * Where:
 *   xx   = stream number (00, 01, 02, ...) - 2 ASCII digits
 *   wb   = "wave bytes" - indicates audio chunk
 *   size = 32-bit little-endian size of payload
 *   payload = raw codec frames
 *
 * Example:
 *   01wb 00000300 [768 bytes of audio data]
 *
 * Audio Payload by Codec:
 * -----------------------
 * 1. PCM: Raw PCM samples (same as WAV)
 *    - 8-bit: unsigned
 *    - 16-bit: signed little-endian
 *    - Interleaved channels (L R L R ...)
 *
 * 2. MP3: Raw MPEG audio frames
 *    - Contains sync words (FF FB, FF F3, FF F2)
 *    - Multiple frames per chunk
 *
 * 3. AAC: Raw AAC frames WITHOUT ADTS headers
 *    - No sync words (FF F1, FF F9)
 *    - Relies on codec config in header
 *
 * 4. ADPCM: Compressed blocks
 *    - Microsoft ADPCM (0x0002)
 *    - IMA ADPCM (0x0011)
 *    - Each block has predictor + step index header
 *
 * 5. AC-3: AC-3 sync frames starting with 0B 77
 *
 * 6. DTS: DTS frames with sync words like 7F FE 80 01
 *
 * @param input The input stream
 * @param output The output stream
 * @param mediaInfo Media information about the file
 * @param optionsInput Extraction options
 * @returns Promise that resolves when extraction is complete
 */
export async function extractFromAvi(
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
  try {
    const audioStream = findAudioStreamToBeExtracted(mediaInfo, options);
    // Only PCM, ADPCM and MP3 are supported for now
    if (!isPCM(audioStream.codec) && audioStream.codec !== 'mp3') {
      throw new UnsupportedFormatError(`Unsupported audio codec for AVI extraction: ${audioStream.codec}`);
    }

    const logger = setupGlobalLogger(options);
    if (logger.isDebug) logger.debug(`Extracting audio from AVI. Stream: ${audioStream.id}, Codec: ${audioStream.codec}`);

    const videoStreamCount = mediaInfo.videoStreams.length;
    const audioStreamIndexInAudioArray = audioStream.id - videoStreamCount - 1; // 0-based index in audio streams
    const targetAviStreamNumber = videoStreamCount + audioStreamIndexInAudioArray; // AVI stream number (0-based)

    let totalDataWritten = 0;
    // Estimate total size for progress reporting only
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

    if (audioStream.codec === 'mp3') {
      // For MP3, just write the raw frames
      await parseAvi(input, {
        ...options,
        onSamples: async (streamNumber, samples) => {
          if (streamNumber === targetAviStreamNumber) {
            for (const sample of samples) {
              await writer.write(sample);
              totalDataWritten += sample.length;
            }
            reportProgress();
          }
        },
      });
    } else if (isPCM(audioStream.codec)) {
      // Initialize WAV writer for PCM/ADPCM
      const wavWriter = new WavWriter(writer, audioStream);

      // Use the AVI parser to stream chunks
      await parseAvi(input, {
        ...options,
        onSamples: async (streamNumber, samples) => {
          // Check if this is an audio chunk for our stream
          if (streamNumber === targetAviStreamNumber) {
            for (const sample of samples) {
              // Extract raw audio data from this chunk
              // For PCM: This is raw samples that will be written to WAV
              wavWriter.appendData(sample);
              totalDataWritten += sample.length;
            }
            reportProgress();
          }
        },
      });

      await wavWriter.writeAll();
    } else {
      throw new UnsupportedFormatError(`Unsupported audio codec for AVI extraction: ${audioStream.codec}`);
    }

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
