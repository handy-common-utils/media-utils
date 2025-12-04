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

// ============================================================================
// Hex Formatting
// ============================================================================

/**
 * Format a number as a hexadecimal string with 0x prefix
 *
 * @param value Number to format
 * @param minDigits Minimum number of hex digits (padded with zeros). Default: 4
 * @returns Hex string (e.g., "0x0001", "0x2000")
 *
 * @example
 * toHex(1) // "0x0001"
 * toHex(8192) // "0x2000"
 * toHex(255, 2) // "0xff"
 */
export function toHex(value: number, minDigits = 4): string {
  return `0x${value.toString(16).padStart(minDigits, '0')}`;
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
 */
export function toHexString(value: number, minDigits = 2): string {
  return value.toString(16).padStart(minDigits, '0');
}
