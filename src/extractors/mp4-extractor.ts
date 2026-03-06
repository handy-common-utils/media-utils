import { createADTSFrame } from '../codecs/aac';
import { writeUInt32LE } from '../codecs/binary';
import { buildWaveFormatEx } from '../codecs/waveformatex';
import { ExtractAudioOptions } from '../extract-audio';
import { AudioStreamInfo, isPCM } from '../media-info';
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
    if (stream.codec !== 'aac' && stream.codec !== 'mp3' && !isPCM(stream.codec)) {
      throw new UnsupportedFormatError(`Unsupported codec for extracting from MP4/MOV: ${stream.codec}`);
    }
    // Require sample tables for extraction
    if (!stream.sampleTableInfo) {
      throw new Error('MP4 sample table information not found in media info.');
    }

    const logger = setupGlobalLogger(options);
    if (logger.isDebug) logger.debug(`Extracting audio from MP4. Stream: ${stream.id}, Codec: ${stream.codec}`);

    const { chunkOffsets, sampleSizes, sampleToChunk, mdatStart } = stream.sampleTableInfo;

    // For PCM, we need to write a WAV header first.
    // We calculate total data size from all samples.
    if (isPCM(stream.codec)) {
      const totalDataSize = sampleSizes.reduce((sum, size) => sum + size, 0);
      const wavHeader = buildWavHeader(stream, totalDataSize);
      await writer.write(wavHeader);
    }

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
          // Write sample
          if (stream.codec === 'aac') {
            const adtsFrame = createADTSFrame(sampleData, stream);
            await writer.write(adtsFrame);
          } else if (isPCM(stream.codec)) {
            // PCM in MP4/MOV (like 'lpcm') is often Big Endian.
            // Standard WAV requires Little Endian, so we may need to swap bytes.
            const pcmData = preparePcmData(sampleData, stream);
            await writer.write(pcmData);
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

/**
 * Build the WAV header for PCM data
 * @param stream The audio stream info
 * @param dataSize Total size of PCM data in bytes
 * @returns The WAV header as a Uint8Array
 */
function buildWavHeader(stream: AudioStreamInfo, dataSize: number): Uint8Array {
  const sampleRate = stream.sampleRate ?? 44100;
  const channels = stream.channelCount ?? 2;

  // Infer bits per sample if not provided
  let bitsPerSample = stream.bitsPerSample;
  if (!bitsPerSample && stream.codec) {
    if (stream.codec === 'pcm_alaw' || stream.codec === 'pcm_mulaw' || stream.codec === 'pcm_u8') {
      bitsPerSample = 8;
    } else if (stream.codec.includes('s16')) {
      bitsPerSample = 16;
    } else if (stream.codec.includes('s24')) {
      bitsPerSample = 24;
    } else if (stream.codec.includes('s32') || stream.codec.includes('f32')) {
      bitsPerSample = 32;
    }
  }
  if (!bitsPerSample) bitsPerSample = 16;

  // Determine format tag
  let formatTag = stream.codecDetails?.formatTag;
  if (!formatTag) {
    switch (stream.codec) {
      case 'pcm_f32le': {
        formatTag = 3; // IEEE Float
        break;
      }
      case 'pcm_alaw': {
        formatTag = 6; // ALAW
        break;
      }
      case 'pcm_mulaw': {
        formatTag = 7; // MULAW
        break;
      }
      default: {
        formatTag = 1; // PCM
      }
    }
  }

  // Calculate blockAlign and byteRate
  let blockAlign = stream.codecDetails?.blockAlign;
  if (!blockAlign) {
    blockAlign = (channels * bitsPerSample) / 8;
  }

  const byteRate = stream.bitrate ? Math.floor(stream.bitrate / 8) : sampleRate * blockAlign;

  const waveFormatEx = buildWaveFormatEx({
    formatTag,
    channels,
    samplesPerSec: sampleRate,
    avgBytesPerSec: byteRate,
    blockAlign,
    bitsPerSample,
  });

  // Calculate total header size: RIFF (12) + fmt (8 + fmtSize) + data header (8)
  const headerSize = 12 + (8 + waveFormatEx.length) + 8;
  const header = new Uint8Array(headerSize);
  const fileSize = headerSize + dataSize - 8;

  // RIFF header
  header.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  writeUInt32LE(header, 4, fileSize); // File size
  header.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

  // fmt chunk
  header.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  writeUInt32LE(header, 16, waveFormatEx.length); // fmt chunk size
  header.set(waveFormatEx, 20); // WAVEFORMATEX data

  // data chunk header
  const dataChunkOffset = 20 + waveFormatEx.length;
  header.set([0x64, 0x61, 0x74, 0x61], dataChunkOffset); // "data"
  writeUInt32LE(header, dataChunkOffset + 4, dataSize); // Data size

  return header;
}

/**
 * Prepare PCM data for writing to WAV
 * Handles byte swapping if the input is Big Endian
 * @param data The raw PCM data
 * @param stream The audio stream info
 * @returns The (potentially modified) PCM data
 */
function preparePcmData(data: Uint8Array, stream: AudioStreamInfo): Uint8Array {
  // Check if it's a Big Endian format
  const isBigEndian = stream.codec === 'pcm_s16be' || stream.codec === 'pcm_s24be' || stream.codec === 'pcm_s32be';

  if (!isBigEndian) {
    return data;
  }

  // We need to swap bytes for 16, 24, or 32 bit PCM
  // For lpcm, it's typically 16-bit.
  let bitsPerSample = stream.bitsPerSample;
  if (!bitsPerSample) {
    if (stream.codec.includes('s16')) bitsPerSample = 16;
    else if (stream.codec.includes('s24')) bitsPerSample = 24;
    else if (stream.codec.includes('s32')) bitsPerSample = 32;
  }

  switch (bitsPerSample) {
    case 16: {
      return swapBytes(data, 2);
    }
    case 24: {
      return swapBytes(data, 3);
    }
    case 32: {
      return swapBytes(data, 4);
    }
    default: {
      return data;
    }
  }
}

/**
 * Swap bytes in a buffer for multi-byte samples
 * @param data The buffer to swap
 * @param bytesPerSample Bytes per sample (2, 3, or 4)
 * @returns A new Uint8Array with swapped bytes
 */
function swapBytes(data: Uint8Array, bytesPerSample: number): Uint8Array {
  const swapped = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += bytesPerSample) {
    for (let b = 0; b < bytesPerSample; b++) {
      if (i + b < data.length) {
        swapped[i + (bytesPerSample - 1 - b)] = data[i + b];
      }
    }
  }
  return swapped;
}
