/**
 * ASF/WMV Audio Extractor
 * Extracts audio from ASF (Advanced Systems Format) containers (WMA/WMV files)
 * by extracting payloads from the target audio stream and re-muxing into a new ASF container.
 */

import { readUInt16, readUInt32 } from '../codecs/asf';
import { AudioStreamInfo, MediaInfo } from '../media-info';
import { parseAsf, PayloadMetadata } from '../parsers/asf';
import { findAudioStreamToBeExtracted } from './utils';
import { WmaWriter } from './wma-writer';

export interface AsfExtractorOptions {
  trackId?: number;
  streamIndex?: number;
  quiet?: boolean;
}

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
  mediaInfo: MediaInfo,
  optionsInput?: AsfExtractorOptions,
): Promise<void> {
  const options = {
    quiet: true,
    ...optionsInput,
  };

  // Find the audio stream to extract
  const stream: AudioStreamInfo = findAudioStreamToBeExtracted(mediaInfo, options);

  // Collect payloads from the target stream
  interface PayloadData {
    metadata: PayloadMetadata & { payload: Uint8Array };
    sequenceNumber: number;
  }
  const payloads: PayloadData[] = [];
  let sequenceNumber = 0;
  let codecPrivate: Uint8Array | undefined;
  let sourceMetadata: {
    playDuration?: number;
    sendDuration?: number;
    preroll?: number;
    packetSize?: number;
    maxBitrate?: number;
    bitsPerSample?: number;
    extendedStreamPropertiesObject?: Uint8Array;
  } = {};

  // Create a new stream that captures the first chunk for header parsing
  // while also passing all data through to parseAsf
  const reader = input.getReader();
  const streamForParsing = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Read first chunk
        const { done: firstDone, value: firstValue } = await reader.read();

        if (!firstDone && firstValue) {
          // Parse header from first chunk
          if (firstValue.length >= 30) {
            const result = parseAsfHeader(firstValue, stream.id);
            codecPrivate = result.codecPrivate;
            sourceMetadata = {
              playDuration: result.playDuration,
              sendDuration: result.sendDuration,
              preroll: result.preroll,
              packetSize: result.packetSize,
              maxBitrate: result.maxBitrate,
              bitsPerSample: result.bitsPerSample,
              extendedStreamPropertiesObject: result.extendedStreamPropertiesObject,
            };
          }
          // Enqueue first chunk
          controller.enqueue(firstValue);
        }

        if (firstDone) {
          controller.close();
          return;
        }

        // Continue reading remaining chunks
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  // Extract payloads using parseAsf
  await parseAsf(streamForParsing, {
    extractStreams: [stream.id],
    onPayload: (streamNumber: number, payloadData: Uint8Array, metadata: PayloadMetadata) => {
      payloads.push({
        metadata: { ...metadata, payload: payloadData },
        sequenceNumber: sequenceNumber++,
      });
    },
  });

  // Create output ASF container
  const writer = output.getWriter();

  try {
    if (payloads.length === 0) {
      throw new Error('No audio data found in the target stream');
    }

    if (!codecPrivate) {
      throw new Error('Could not find codec private data');
    }

    // Parse WAVEFORMATEX from codecPrivate
    const codecId = readUInt16(codecPrivate, 0) ?? 0;
    const channels = readUInt16(codecPrivate, 2) ?? 0;
    const sampleRate = readUInt32(codecPrivate, 4);
    const avgBytesPerSec = readUInt32(codecPrivate, 8);
    const bitrate = avgBytesPerSec * 8;
    const blockSize = readUInt16(codecPrivate, 12) ?? 0;
    const bitsPerSample = readUInt16(codecPrivate, 14) ?? 16; // Bits per sample from WAVEFORMATEX
    const cbSize = readUInt16(codecPrivate, 16) ?? 0; // Size of extra format information
    const encoderSpecificData = codecPrivate.slice(18, 18 + cbSize);

    // Use duration from the first payload as object duration
    // Convert ms to 100-nanosecond units (hns)
    const objectDuration = (payloads[0].metadata.packetDuration ?? 0) * 10000;

    // Calculate Send Duration based on extracted payloads
    // Find the last payload's send time and duration
    const lastPayloadIndex = payloads.length - 1;
    const lastPayload = payloads[lastPayloadIndex];
    const firstPayload = payloads[0];

    const minSendTime = firstPayload.metadata.packetSendTime;
    const maxSendTime = lastPayload.metadata.packetSendTime;
    const lastDuration = lastPayload.metadata.packetDuration ?? 0;

    // Keep preroll from source (in milliseconds)
    const preroll = sourceMetadata.preroll!;

    // Send Duration = actual media duration without preroll offset
    // Since packet send times include the preroll offset, we subtract the first packet's send time
    // Convert from milliseconds to 100-nanosecond units (hns)
    const sendDuration = (maxSendTime + lastDuration - minSendTime) * 10000;

    // Play Duration = Send Duration + Preroll (both in 100-nanosecond units)
    // Preroll is in milliseconds, so multiply by 10000 to convert to hns
    const playDuration = sendDuration + preroll * 10000;

    // Calculate max bitrate for the extracted stream
    // Use bitrate from WAVEFORMATEX as the max bitrate (avgBytesPerSec * 8)
    const calculatedMaxBitrate = bitrate;

    // Calculate optimal packet size based on actual payload sizes
    // Find the maximum payload content size and maximum payload data size across all payloads
    let maxContentSize = 0;
    let maxPayloadSize = 0;
    for (const p of payloads) {
      // Packet structure:
      // - Fixed header: 13 bytes (Length Type Flags, Property Flags, Packet Length, Padding Length, Send Time, Duration)
      // - Payload metadata: 10 bytes + replicated data size
      // - Payload data: variable
      const replicatedDataSize = p.metadata.replicatedData.length;
      const contentSize = 13 + 10 + replicatedDataSize + p.metadata.payload.length;
      if (contentSize > maxContentSize) {
        maxContentSize = contentSize;
      }
      // Track maximum payload data size (for error correction)
      if (p.metadata.payload.length > maxPayloadSize) {
        maxPayloadSize = p.metadata.payload.length;
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

    // Initialize WmaWriter
    // We need to release the writer lock first because WmaWriter takes the stream
    writer.releaseLock();

    const wmaWriter = new WmaWriter(output, {
      codecId,
      channels,
      sampleRate,
      bitrate,
      blockSize,
      encoderSpecificData,
      objectDuration,
      bitsPerSample: sourceMetadata.bitsPerSample ?? bitsPerSample,
      avgBytesPerSec,
      playDuration,
      sendDuration,
      preroll,
      packetSize: calculatedPacketSize,
      maxBitrate: calculatedMaxBitrate,
      extendedStreamPropertiesObject: sourceMetadata.extendedStreamPropertiesObject!,
      streamNumber: stream.id,
      maxPayloadSize,
    });

    // Feed payloads
    for (const p of payloads) {
      wmaWriter.onPayload(stream.id, p.metadata.payload, p.metadata);
    }

    // Finish writing
    await wmaWriter.finish();
  } catch (error) {
    // If we still hold the lock (error before WmaWriter), abort
    if (output.locked) {
      // Stream is locked, probably by WmaWriter or our initial writer.
      // If we released lock, we can't abort directly unless we get a new writer,
      // but we can't get a new writer if it's locked.
      // If WmaWriter has it, we rely on it or the stream state.
      // For now, just rethrow.
    } else {
      // If WmaWriter was created, it handles the stream.
      // But if we are here, we might need to handle it?
      // WmaWriter.finish() closes the stream.
      // If error occurred, we might want to abort.
      // But we can't easily access the writer if WmaWriter has it.
      // Assuming WmaWriter doesn't expose abort.
      // If we haven't created WmaWriter yet:
      const w = output.getWriter();
      await w.abort(error as Error);
    }
    throw error;
  }
}

/**
 * Parse ASF header to extract codec private data and metadata
 * @param data The ASF header data to parse
 * @param streamId The stream ID to extract codec private data for
 * @returns Object containing codec private data and metadata
 */
function parseAsfHeader(
  data: Uint8Array,
  streamId: number,
): {
  codecPrivate?: Uint8Array;
  packetSize: number;
  playDuration?: number;
  sendDuration?: number;
  preroll?: number;
  maxBitrate?: number;
  bitsPerSample?: number;
  extendedStreamPropertiesObject?: Uint8Array;
} {
  const HEADER_OBJECT_GUID = [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c];
  const FILE_PROPERTIES_OBJECT_GUID = [0xa1, 0xdc, 0xab, 0x8c, 0x47, 0xa9, 0xcf, 0x11, 0x8e, 0xe4, 0x00, 0xc0, 0x0c, 0x20, 0x53, 0x65];
  const STREAM_PROPERTIES_OBJECT_GUID = [0x91, 0x07, 0xdc, 0xb7, 0xb7, 0xa9, 0xcf, 0x11, 0x8e, 0xe6, 0x00, 0xc0, 0x0c, 0x20, 0x53, 0x65];
  const AUDIO_STREAM_GUID = [0x40, 0x9e, 0x69, 0xf8, 0x4d, 0x5b, 0xcf, 0x11, 0xa8, 0xfd, 0x00, 0x80, 0x5f, 0x5c, 0x44, 0x2b];
  const HEADER_EXTENSION_OBJECT_GUID = [0xb5, 0x03, 0xbf, 0x5f, 0x2e, 0xa9, 0xcf, 0x11, 0x8e, 0xe3, 0x00, 0xc0, 0x0c, 0x20, 0x53, 0x65];
  const EXTENDED_STREAM_PROPERTIES_OBJECT_GUID = [0xcb, 0xa5, 0xe6, 0x14, 0x72, 0xc6, 0x32, 0x43, 0x83, 0x99, 0xa9, 0x69, 0x52, 0x06, 0x5b, 0x5a];

  function compareGuid(offset: number, guid: number[]): boolean {
    if (offset + 16 > data.length) return false;
    for (let i = 0; i < 16; i++) {
      if (data[offset + i] !== guid[i]) return false;
    }
    return true;
  }

  function readUInt16LE(offset: number): number {
    return data[offset] | (data[offset + 1] << 8);
  }

  function readUInt32LE(offset: number): number {
    return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
  }

  function readUInt64LE(offset: number): number {
    const low = readUInt32LE(offset);
    const high = readUInt32LE(offset + 4);
    return low + high * 4294967296;
  }

  let codecPrivate: Uint8Array | undefined;
  let packetSize = 3200;
  let playDuration: number | undefined;
  let sendDuration: number | undefined;
  let preroll: number | undefined;
  let maxBitrate: number | undefined;
  let bitsPerSample: number | undefined;
  let extendedStreamPropertiesObject: Uint8Array | undefined;

  if (!compareGuid(0, HEADER_OBJECT_GUID)) {
    return { codecPrivate, packetSize, playDuration, sendDuration, preroll, maxBitrate, bitsPerSample, extendedStreamPropertiesObject };
  }

  const headerSize = readUInt64LE(16);
  if (data.length < headerSize) {
    return { codecPrivate, packetSize, playDuration, sendDuration, preroll, maxBitrate, bitsPerSample, extendedStreamPropertiesObject };
  }

  const numObjects = readUInt32LE(24);
  let offset = 30;

  for (let i = 0; i < numObjects && offset + 24 <= data.length && offset < headerSize; i++) {
    const objSize = readUInt64LE(offset + 16);

    if (compareGuid(offset, FILE_PROPERTIES_OBJECT_GUID) && offset + 100 <= data.length) {
      // Extract File Properties metadata
      playDuration = readUInt64LE(offset + 64); // Play Duration in 100-nanosecond units
      sendDuration = readUInt64LE(offset + 72); // Send Duration in 100-nanosecond units
      preroll = readUInt64LE(offset + 80); // Preroll in milliseconds
      const minPacketSize = readUInt32LE(offset + 92);
      const maxPacketSize = readUInt32LE(offset + 96);
      // Verify min and max packet sizes are equal (ASF spec requirement)
      if (minPacketSize !== maxPacketSize) {
        throw new Error(`ASF min packet size (${minPacketSize}) and max packet size (${maxPacketSize}) must be equal`);
      }
      if (minPacketSize > 0) packetSize = minPacketSize;
      maxBitrate = readUInt32LE(offset + 100);
    } else if (compareGuid(offset, STREAM_PROPERTIES_OBJECT_GUID) && offset + 78 <= data.length) {
      const streamTypeGuid = compareGuid(offset + 24, AUDIO_STREAM_GUID);
      if (streamTypeGuid) {
        const typeSpecificDataLength = readUInt32LE(offset + 64); // Correct offset after Time Offset field
        const flags = readUInt32LE(offset + 72);
        const streamNum = flags & 0x7f;

        if (streamNum === streamId && offset + 78 + typeSpecificDataLength <= data.length) {
          codecPrivate = data.slice(offset + 78, offset + 78 + typeSpecificDataLength);
          // Extract bits per sample from WAVEFORMATEX (offset 14 within Type-Specific Data)
          if (typeSpecificDataLength >= 16) {
            bitsPerSample = data[offset + 78 + 14] | (data[offset + 78 + 15] << 8);
          }
        }
      }
    } else if (compareGuid(offset, HEADER_EXTENSION_OBJECT_GUID) && offset + 46 <= data.length) {
      // Header Extension Object
      // GUID (16) + Size (8) + Reserved1 (16) + Reserved2 (2) + Data Size (4)
      const extensionDataSize = readUInt32LE(offset + 42);
      if (offset + 46 + extensionDataSize <= data.length) {
        let extOffset = offset + 46;
        const extEnd = extOffset + extensionDataSize;

        while (extOffset + 24 <= extEnd) {
          const extObjSize = readUInt64LE(extOffset + 16);
          if (compareGuid(extOffset, EXTENDED_STREAM_PROPERTIES_OBJECT_GUID) && extOffset + 74 <= extEnd) {
            // Found Extended Stream Properties Object
            // Verify it belongs to the target stream
            // Stream Number is at offset 72
            const streamNum = readUInt16LE(extOffset + 72);
            if (streamNum === streamId) {
              extendedStreamPropertiesObject = data.slice(extOffset, extOffset + Number(extObjSize));
            }
          }
          extOffset += Number(extObjSize);
        }
      }
    }

    offset += Number(objSize);
  }

  return { codecPrivate, packetSize, playDuration, sendDuration, preroll, maxBitrate, bitsPerSample, extendedStreamPropertiesObject };
}
