/**
 * Binary data reading and writing utilities
 *
 * This module provides reusable functions for reading and writing binary data
 * in little-endian and big-endian formats, as well as hex formatting utilities.
 */

import { UnsupportedFormatError } from '../utils';

// ============================================================================
// Little-Endian Reading
// ============================================================================

/**
 * Read a 16-bit unsigned integer (little-endian) from buffer
 * @param buffer The buffer to read from
 * @param offset Offset to read from
 * @returns The uint16 value
 */
export function readUInt16LE(buffer: Uint8Array, offset: number): number {
  if (offset + 2 > buffer.length) {
    throw new UnsupportedFormatError(`Insufficient data for reading uint16 at offset ${offset} from a buffer of size ${buffer.length}`);
  }
  return buffer[offset] | (buffer[offset + 1] << 8);
}

/**
 * Read a 32-bit unsigned integer (little-endian) from buffer
 * @param buffer The buffer to read from
 * @param offset Offset to read from
 * @returns The uint32 value
 */
export function readUInt32LE(buffer: Uint8Array, offset: number): number {
  if (offset + 4 > buffer.length) {
    throw new UnsupportedFormatError(`Insufficient data for reading uint32 at offset ${offset} from a buffer of size ${buffer.length}`);
  }
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
}

/**
 * Read a 64-bit unsigned integer (little-endian) from buffer
 * @param buffer The buffer to read from
 * @param offset Offset to read from
 * @returns The uint64 value as bigint
 */
export function readUInt64LE(buffer: Uint8Array, offset: number): bigint {
  if (offset + 8 > buffer.length) {
    throw new UnsupportedFormatError(`Insufficient data for reading uint64 at offset ${offset} from a buffer of size ${buffer.length}`);
  }
  const low = readUInt32LE(buffer, offset);
  const high = readUInt32LE(buffer, offset + 4);
  return (BigInt(high) << 32n) + BigInt(low);
}

// ============================================================================
// Little-Endian Writing
// ============================================================================

/**
 * Write a 16-bit unsigned integer (little-endian) to buffer
 * @param buffer Buffer to write to
 * @param offset Offset in buffer
 * @param value Value to write
 * @returns Number of bytes written (2)
 */
export function writeUInt16LE(buffer: Uint8Array, offset: number, value: number): number {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
  return 2;
}

/**
 * Write a 32-bit unsigned integer (little-endian) to buffer
 * @param buffer Buffer to write to
 * @param offset Offset in buffer
 * @param value Value to write
 * @returns Number of bytes written (4)
 */
export function writeUInt32LE(buffer: Uint8Array, offset: number, value: number): number {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
  buffer[offset + 2] = (value >> 16) & 0xff;
  buffer[offset + 3] = (value >> 24) & 0xff;
  return 4;
}

/**
 * Write a 64-bit unsigned integer (little-endian) to buffer
 * @param buffer Buffer to write to
 * @param offset Offset in buffer
 * @param value Value to write (number or bigint)
 * @returns Number of bytes written (8)
 */
export function writeUInt64LE(buffer: Uint8Array, offset: number, value: bigint | number): number {
  const low = BigInt(value) & 0xffffffffn;
  const high = BigInt(value) >> 32n;
  writeUInt32LE(buffer, offset, Number(low));
  writeUInt32LE(buffer, offset + 4, Number(high));
  return 8;
}

// ============================================================================
// Big-Endian Reading
// ============================================================================

/**
 * Read a 16-bit unsigned integer (big-endian) from buffer
 * @param buffer The buffer to read from
 * @param offset Offset to read from
 * @returns The uint16 value
 */
export function readUInt16BE(buffer: Uint8Array, offset: number): number {
  if (offset + 2 > buffer.length) {
    throw new UnsupportedFormatError(`Insufficient data for reading uint16 at offset ${offset} from a buffer of size ${buffer.length}`);
  }
  return (buffer[offset] << 8) | buffer[offset + 1];
}

/**
 * Read a 32-bit unsigned integer (big-endian) from buffer
 * @param buffer The buffer to read from
 * @param offset Offset to read from
 * @returns The uint32 value
 */
export function readUInt32BE(buffer: Uint8Array, offset: number): number {
  if (offset + 4 > buffer.length) {
    throw new UnsupportedFormatError(`Insufficient data for reading uint32 at offset ${offset} from a buffer of size ${buffer.length}`);
  }
  return (buffer[offset] << 24) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];
}

/**
 * Format a number as a hexadecimal string without 0x prefix
 *
 * @param value Number to format
 * @param minDigits Minimum number of hex digits (padded with zeros). Default: 2
 * @returns Hex string (e.g., "01", "ff")
 *
 * @example
 * toHexString(1) // "01"
 * toHexString(255) // "ff"
 * toHexString(4096, 4) // "1000"
 * toHexString(new Uint8Array([1, 2, 3])) // "01 02 03"
 */
export function toHexString(value: number | Uint8Array | ArrayBufferLike, minDigits = 2): string {
  if (value == null) {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    return value.toString(16).padStart(minDigits, '0');
  }

  // Convert ArrayBufferLike to Uint8Array if needed
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

/**
 * Read an ASCII string from a Uint8Array
 * @param u8 The Uint8Array to read from
 * @param offset The offset to start reading from
 * @param length The number of bytes to read
 * @returns The ASCII string
 */
export function readAscii(u8: Uint8Array, offset = 0, length = u8.length): string {
  let result = '';
  for (let i = offset; i < length; i++) {
    // eslint-disable-next-line unicorn/prefer-code-point
    result += String.fromCharCode(u8[i]);
  }
  return result;
}

export class BitReader {
  private buffer: Uint8Array;
  private byteOffset: number = 0;
  private bitOffset: number = 0;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
  }

  readBit(): number {
    if (this.byteOffset >= this.buffer.length) {
      throw new Error('End of stream');
    }
    const bit = (this.buffer[this.byteOffset] >> (7 - this.bitOffset)) & 1;
    this.bitOffset++;
    if (this.bitOffset === 8) {
      this.byteOffset++;
      this.bitOffset = 0;
    }
    return bit;
  }

  readBits(n: number): number {
    let res = 0;
    for (let i = 0; i < n; i++) {
      res = (res << 1) | this.readBit();
    }
    return res;
  }

  readUE(): number {
    let leadingZeros = 0;
    while (this.readBit() === 0 && leadingZeros < 32) {
      leadingZeros++;
    }
    return (1 << leadingZeros) - 1 + this.readBits(leadingZeros);
  }

  readSE(): number {
    const val = this.readUE();
    const sign = val & 1 ? 1 : -1;
    return sign * ((val + 1) >> 1);
  }
}
