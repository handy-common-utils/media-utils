import { createADTSFrame } from '../codecs/aac';
import { ExtractAudioOptions } from '../extract-audio';
import { Mp4MediaInfo } from '../parsers/mp4';
import { setupGlobalLogger, UnsupportedFormatError } from '../utils';
import { findAudioStreamToBeExtracted } from './utils';

/**
 * Extract audio from MP4/MOV containers using pre-parsed sample tables
 * @param input The input stream
 * @param output The output stream
 * @param mediaInfo Media information about the file (must include mp4SampleTables)
 * @param optionsInput Extraction options
 * @returns Promise that resolves when extraction is complete
 */
export async function extractFromMp4(
  input: ReadableStream<Uint8Array>,
  output: WritableStream<Uint8Array>,
  mediaInfo: Mp4MediaInfo,
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
    const stream = findAudioStreamToBeExtracted(mediaInfo, options);
    if (stream.codec !== 'aac' && stream.codec !== 'mp3') {
      throw new UnsupportedFormatError(`Unsupported codec for extracting from MP4/MOV: ${stream.codec}`);
    }
    // Require sample tables for extraction
    if (!stream.sampleTableInfo) {
      throw new Error('MP4 sample table information not found in media info.');
    }

    const logger = setupGlobalLogger(options);
    if (logger.isDebug) logger.debug(`Extracting audio from MP4. Stream: ${stream.id}, Codec: ${stream.codec}`);

    const { chunkOffsets, sampleSizes, sampleToChunk, mdatStart } = stream.sampleTableInfo;

    const reader = input.getReader();
    try {
      // Build complete sample-to-chunk map (expand the compressed format)
      const sampleToChunkMap: Array<{ chunkIndex: number; firstSampleIndex: number; samplesPerChunk: number }> = [];
      let currentSampleIndex = 0;

      for (let i = 0; i < sampleToChunk.length; i++) {
        const entry = sampleToChunk[i];
        const nextFirstChunk = i + 1 < sampleToChunk.length ? sampleToChunk[i + 1].firstChunk : chunkOffsets.length + 1;
        const chunksInThisRun = nextFirstChunk - entry.firstChunk;

        for (let chunkInRun = 0; chunkInRun < chunksInThisRun; chunkInRun++) {
          const chunkIndex = entry.firstChunk - 1 + chunkInRun; // Convert to 0-based
          sampleToChunkMap.push({
            chunkIndex,
            firstSampleIndex: currentSampleIndex,
            samplesPerChunk: entry.samplesPerChunk,
          });
          currentSampleIndex += entry.samplesPerChunk;
        }
      }

      // Read and discard data until we hit MDAT + 8 (skip atom header)
      let currentFileOffset = 0;
      const targetOffset = mdatStart + 8; // Skip MDAT atom header (size + type)
      let buffer: Uint8Array = new Uint8Array(0);

      while (currentFileOffset < targetOffset) {
        const { value, done } = await reader.read();
        if (done) {
          throw new UnsupportedFormatError('Unexpected EOF before MDAT data');
        }

        const skipAmount = Math.min(value!.length, targetOffset - currentFileOffset);
        currentFileOffset += skipAmount;

        // Save leftover data (this is the start of MDAT content)
        if (skipAmount < value!.length) {
          buffer = value!.slice(skipAmount);
        }
      }

      // Now we're at MDAT data start - process all chunks sequentially
      let mdatDataOffset = 0; // Offset within MDAT data (after header)
      let totalProcessedSamples = 0;
      const totalSamples = sampleSizes.length;

      // Process each chunk
      for (const chunkInfo of sampleToChunkMap) {
        const chunkOffsetInFile = chunkOffsets[chunkInfo.chunkIndex];
        const { firstSampleIndex, samplesPerChunk } = chunkInfo;

        // Convert absolute file offset to MDAT-relative offset
        const chunkOffset = chunkOffsetInFile - (mdatStart + 8);

        // Skip to this chunk's position within MDAT data
        while (mdatDataOffset < chunkOffset) {
          const needed = chunkOffset - mdatDataOffset;

          if (buffer.length >= needed) {
            // We have enough in buffer, just skip it
            buffer = buffer.slice(needed);
            mdatDataOffset += needed;
          } else {
            // Need more data
            mdatDataOffset += buffer.length;
            buffer = new Uint8Array(0);

            const { value, done } = await reader.read();
            if (done) {
              throw new UnsupportedFormatError(`Unexpected EOF while seeking to chunk at offset ${chunkOffset}`);
            }
            buffer = value!;
          }
        }

        // Read samples in this chunk
        for (let sampleInChunk = 0; sampleInChunk < samplesPerChunk; sampleInChunk++) {
          const sampleIndex = firstSampleIndex + sampleInChunk;
          if (sampleIndex >= sampleSizes.length) break;

          const sampleSize = sampleSizes[sampleIndex];

          // Ensure we have the full sample in buffer
          while (buffer.length < sampleSize) {
            const { value, done } = await reader.read();
            if (done) {
              throw new UnsupportedFormatError(`Unexpected EOF while reading sample ${sampleIndex}`);
            }

            const newBuffer = new Uint8Array(buffer.length + value!.length);
            newBuffer.set(buffer);
            newBuffer.set(value!, buffer.length);
            buffer = newBuffer;
          }

          // Extract sample
          const sampleData = buffer.slice(0, sampleSize);
          buffer = buffer.slice(sampleSize);
          mdatDataOffset += sampleSize;

          // Write sample (with ADTS header for AAC)
          if (stream.codec === 'aac') {
            const adtsFrame = createADTSFrame(sampleData, stream);
            await writer.write(adtsFrame);
          } else {
            await writer.write(sampleData);
          }

          totalProcessedSamples++;

          // Report progress
          if (options.onProgress && totalSamples > 0 && totalProcessedSamples % 100 === 0) {
            const progress = Math.min(100, Math.round((totalProcessedSamples / totalSamples) * 100));
            options.onProgress(progress);
          }
        }
      }
    } finally {
      reader.cancel().catch(() => {});
      reader.releaseLock();
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
