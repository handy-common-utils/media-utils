/**
 * ASF/WMV Audio Extractor
 * Extracts WMAv2 audio from ASF (Advanced Systems Format) containers
 */

import { AudioStreamInfo, MediaInfo } from '../media-info';
import { findAudioStreamToBeExtracted } from './utils';

export interface AsfExtractorOptions {
  trackId?: number;
  streamIndex?: number;
  quiet?: boolean;
}

// GUIDs
const HEADER_OBJECT_GUID = [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c];
const DATA_OBJECT_GUID = [0x36, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c];
const FILE_PROPERTIES_OBJECT_GUID = [0xa1, 0xdc, 0xab, 0x8c, 0x47, 0xa9, 0xcf, 0x11, 0x8e, 0xe4, 0x00, 0xc0, 0x0c, 0x20, 0x53, 0x65];

// Helper functions
function _readVarLength(buf: Uint8Array, offset: number, type: number): { value: number; size: number } {
  if (type === 0) return { value: 0, size: 0 };
  if (type === 1) return { value: buf[offset], size: 1 };
  if (type === 2) return { value: buf[offset] | (buf[offset + 1] << 8), size: 2 };
  if (type === 3) return { value: buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24), size: 4 };
  return { value: 0, size: 0 };
}

function readGuid(buf: Uint8Array, offset: number): number[] {
  const guid = [];
  for (let i = 0; i < 16; i++) {
    guid.push(buf[offset + i]);
  }
  return guid;
}

function compareGuid(g1: number[], g2: number[]): boolean {
  for (let i = 0; i < 16; i++) {
    if (g1[i] !== g2[i]) return false;
  }
  return true;
}

function readUInt32LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24);
}

function readUInt64LE(buf: Uint8Array, offset: number): number {
  // Approximate for JS numbers (safe up to 2^53)
  const low = readUInt32LE(buf, offset);
  const high = readUInt32LE(buf, offset + 4);
  return low + high * 4294967296;
}

/**
 * Extract audio from ASF/WMV containers (WMAv2)
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

  let stream: AudioStreamInfo;

  try {
    stream = findAudioStreamToBeExtracted(mediaInfo, options);
  } catch {
    return;
  }

  return new Promise((resolve, reject) => {
    const writer = output.getWriter();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    function abort(error: Error) {
      if (reader) {
        reader.cancel().catch(() => {});
      }
      writer.abort(error).catch(() => {});
      reject(error);
    }

    let buffer = new Uint8Array(0);
    let headerWritten = false;
    let headerSize = 0;
    let packetSize = 3200; // Default fallback
    let dataObjectStart = 0;

    async function processBuffer() {
      try {
        // 1. Write ASF Header if not yet written
        if (!headerWritten && buffer.length >= 30) {
          const guid = readGuid(buffer, 0);
          if (compareGuid(guid, HEADER_OBJECT_GUID)) {
            headerSize = readUInt64LE(buffer, 16);

            if (buffer.length >= headerSize) {
              // Parse header to get packet size
              const numObjects = readUInt32LE(buffer, 24);
              let currentOffset = 30;

              for (let i = 0; i < numObjects; i++) {
                if (currentOffset + 24 > headerSize) break;

                const objGuid = readGuid(buffer, currentOffset);
                const objSize = readUInt64LE(buffer, currentOffset + 16);

                if (compareGuid(objGuid, FILE_PROPERTIES_OBJECT_GUID) && currentOffset + 96 <= headerSize) {
                  const minPacketSize = readUInt32LE(buffer, currentOffset + 92);
                  if (minPacketSize > 0) packetSize = minPacketSize;
                }

                currentOffset += Number(objSize);
              }

              // Write the entire header
              await writer.write(buffer.slice(0, headerSize));
              headerWritten = true;
              buffer = buffer.slice(headerSize);
            } else {
              return; // Wait for more data
            }
          } else {
            abort(new Error('Invalid ASF file: missing header'));
            return;
          }
        }

        if (!headerWritten) return;

        // 2. Find and write Data Object header
        if (dataObjectStart === 0) {
          for (let i = 0; i < buffer.length - 16; i++) {
            if (compareGuid(readGuid(buffer, i), DATA_OBJECT_GUID)) {
              dataObjectStart = i;

              // Write Data Object header (50 bytes)
              if (buffer.length >= i + 50) {
                await writer.write(buffer.slice(i, i + 50));
                buffer = buffer.slice(i + 50);
                dataObjectStart = 50; // Mark as written
              }
              break;
            }
          }

          if (dataObjectStart === 0) return; // Need more data
        }

        // 3. Process and write complete data packets for the target stream
        let offset = 0;

        while (offset + packetSize <= buffer.length) {
          const packetStart = offset;
          let packetOffset = offset;

          // Parse packet to check if it contains our stream
          let containsTargetStream = false;

          // Skip error correction if present
          const ecFlags = buffer[packetOffset];
          packetOffset++;

          if ((ecFlags & 0x80) !== 0) {
            const ecDataLengthType = ecFlags & 0x0f;
            if (ecDataLengthType === 1 && packetOffset < buffer.length) {
              const ecDataLength = buffer[packetOffset];
              packetOffset++;
              packetOffset += ecDataLength;
            }
          }

          if (packetOffset >= buffer.length) break;

          // Parse payload parsing information
          const propertyFlags = buffer[packetOffset];
          packetOffset++;

          const multiplePayloads = (propertyFlags & 0x01) !== 0;

          // Skip variable-length fields (simplified parsing)
          packetOffset += 6; // Skip packet length, sequence, padding length fields (max)
          packetOffset += 6; // Skip send time and duration

          if (packetOffset >= buffer.length) break;

          // Check payloads
          if (multiplePayloads) {
            const payloadFlags = buffer[packetOffset];
            packetOffset++;
            const numPayloads = payloadFlags & 0x3f;

            for (let p = 0; p < numPayloads && packetOffset < buffer.length; p++) {
              const streamNum = buffer[packetOffset] & 0x7f;
              if (streamNum === stream.id) {
                containsTargetStream = true;
                break;
              }
              packetOffset++;
              // Skip rest of payload header (simplified)
              packetOffset += 10;
            }
          } else {
            if (packetOffset < buffer.length) {
              const streamNum = buffer[packetOffset] & 0x7f;
              if (streamNum === stream.id) {
                containsTargetStream = true;
              }
            }
          }

          // Write the entire packet if it contains our stream
          if (containsTargetStream) {
            await writer.write(buffer.slice(packetStart, packetStart + packetSize));
          }

          offset += packetSize;
        }

        // Remove processed data
        if (offset > 0) {
          buffer = buffer.slice(offset);
        }
      } catch (error) {
        abort(error as Error);
      }
    }

    reader = input.getReader();

    function readChunk() {
      if (!reader) return;

      reader
        .read()
        .then(async ({ done, value }) => {
          if (done) {
            await processBuffer();
            await writer.close();
            resolve();
            return;
          }

          if (value) {
            const newBuffer = new Uint8Array(buffer.length + value.length);
            newBuffer.set(buffer);
            newBuffer.set(value, buffer.length);
            buffer = newBuffer;

            await processBuffer();
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
