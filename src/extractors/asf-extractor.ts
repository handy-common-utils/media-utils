/**
 * ASF/WMV Audio Extractor
 * Extracts audio from ASF (Advanced Systems Format) containers (WMA/WMV files)
 * by extracting payloads from the target audio stream and re-muxing into a new ASF container.
 */

import { readUInt16LE, readUInt32LE } from '../codecs/binary';
import { ExtractAudioOptions } from '../extract-audio';
import { AudioStreamInfo } from '../media-info';
import { AsfMediaInfo, parseAsf } from '../parsers/asf';
import { UnsupportedFormatError } from '../utils';
import { findAudioStreamToBeExtracted } from './utils';
import { PayloadDetails, writeWma } from './wma-writer';

/**
 * Extract audio from ASF/WMV containers
 *
 * @param input The input stream
 * @param output The output stream
 * @param mediaInfo Media information about the file
 * @param optionsInput Extraction options
 * @returns Promise that resolves when extraction is complete
 */
export async function extractFromAsf(
  input: ReadableStream<Uint8Array>,
  output: WritableStream<Uint8Array>,
  mediaInfo: AsfMediaInfo,
  optionsInput?: ExtractAudioOptions,
): Promise<void> {
  const options = {
    quiet: true,
    ...optionsInput,
  };

  if (options.onProgress) {
    options.onProgress(0);
  }
  // Find the audio stream to extract
  const stream: AudioStreamInfo = findAudioStreamToBeExtracted(mediaInfo, options);

  const { fileProperties, additionalStreamInfo: extractedStreamInfo } = mediaInfo;
  const additionalStreamInfo = extractedStreamInfo!.get(stream.id)!;
  const { codecPrivate } = additionalStreamInfo;

  // Parse WAVEFORMATEX from codecPrivate
  const codecId = readUInt16LE(codecPrivate, 0) ?? 0;
  const channels = readUInt16LE(codecPrivate, 2) ?? 0;
  const sampleRate = readUInt32LE(codecPrivate, 4);
  const avgBytesPerSec = readUInt32LE(codecPrivate, 8);
  const bitrate = avgBytesPerSec * 8;
  const blockSize = readUInt16LE(codecPrivate, 12) ?? 0;
  const _bitsPerSample = readUInt16LE(codecPrivate, 14) ?? 16; // Bits per sample from WAVEFORMATEX
  const cbSize = readUInt16LE(codecPrivate, 16) ?? 0; // Size of extra format information
  const encoderSpecificData = codecPrivate.slice(18, 18 + cbSize);

  // ASF container structure requires all payloads to be available before writing the header.
  const allPayloads = new Array<PayloadDetails>();

  // Extract payloads using parseAsf
  await parseAsf(input, {
    extractStreams: [stream.id],
    onPayload: (streamNumber, payloadData, metadata, replicatedData) => {
      if (options.onProgress && mediaInfo.durationInSeconds && metadata.packetSendTime !== undefined) {
        // Scale extraction progress to 0-50%
        const extractionProgress = Math.min(100, Math.round((metadata.packetSendTime / 1000 / mediaInfo.durationInSeconds) * 100));
        options.onProgress(Math.round(extractionProgress * 0.5));
      }
      allPayloads.push({
        streamNumber,
        payloadData,
        metadata,
        replicatedData,
      });
    },
  });

  if (allPayloads.length === 0) {
    throw new UnsupportedFormatError('No audio found in the source');
  }

  // Use duration from the first payload as object duration
  // Convert ms to 100-nanosecond units (hns)
  const objectDuration = (allPayloads[0].metadata.packetDuration ?? 0) * 10000;

  // Calculate max bitrate for the extracted stream
  // Use bitrate from WAVEFORMATEX as the max bitrate (avgBytesPerSec * 8)
  const calculatedMaxBitrate = bitrate;

  // Calculate optimal packet size based on actual payload sizes
  // Find the maximum payload content size and maximum payload data size across all payloads
  let maxContentSize = 0;
  let maxPayloadSize = 0;
  for (const p of allPayloads) {
    // Packet structure:
    // - Fixed header: 13 bytes (Length Type Flags, Property Flags, Packet Length, Padding Length, Send Time, Duration)
    // - Payload metadata: 10 bytes + replicated data size
    // - Payload data: variable
    const replicatedDataSize = p.replicatedData.length;
    const contentSize = 13 + 10 + replicatedDataSize + p.payloadData.length;
    if (contentSize > maxContentSize) {
      maxContentSize = contentSize;
    }
    // Track maximum payload data size (for error correction)
    if (p.payloadData.length > maxPayloadSize) {
      maxPayloadSize = p.payloadData.length;
    }
  }

  // Add some room (20% or at least 256 bytes) for safety
  const roomSize = Math.max(256, Math.ceil(maxContentSize * 0.2));
  const optimalSize = maxContentSize + roomSize;

  // Round up to nearest multiple of 256 for alignment (common ASF practice)
  const calculatedPacketSize = Math.ceil(optimalSize / 256) * 256;

  if (!options.quiet) {
    console.log(`Calculated optimal packet size: ${calculatedPacketSize} bytes (max content: ${maxContentSize} bytes)`);
  }

  await writeWma(
    output,
    {
      codecId,
      channels,
      sampleRate,
      bitrate,
      blockSize,
      encoderSpecificData,
      objectDuration,
      bitsPerSample: stream.bitsPerSample!,
      avgBytesPerSec,
      playDuration: fileProperties.playDuration,
      sendDuration: fileProperties.sendDuration,
      preroll: fileProperties.preroll,
      packetSize: calculatedPacketSize,
      maxBitrate: calculatedMaxBitrate,
      extendedStreamPropertiesObject: additionalStreamInfo.extendedStreamPropertiesObject!,
      streamNumber: stream.id,
      maxPayloadSize,
      allPayloads,
    },
    options.onProgress
      ? (progress: number) => {
          // Scale writing progress (0-100) to 50-100%
          const overallProgress = 50 + Math.round(progress * 0.5);
          options.onProgress!(overallProgress);
        }
      : undefined,
  );

  if (options.onProgress) {
    options.onProgress(100);
  }
}
