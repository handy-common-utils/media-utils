import { AudioCodecType } from '../media-info';
import { UnsupportedFormatError } from '../utils';
import { readUInt16LE, readUInt32LE, writeUInt64LE } from './binary';

// ASF GUID Constants
// Note: GUIDs in ASF have mixed endianness - first 3 fields are little-endian

/**
 * ASF GUID definitions
 */
export const AsfGuid = {
  /** ASF Header Object GUID: 30 26 B2 75 8E 66 CF 11 A6 D9 00 AA 00 62 CE 6C */
  HEADER: [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c],

  /** ASF Data Object GUID: 36 26 B2 75 8E 66 CF 11 A6 D9 00 AA 00 62 CE 6C */
  DATA_OBJECT: [0x36, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c],

  /** Stream Properties Object GUID */
  STREAM_PROPERTIES: [0x91, 0x07, 0xdc, 0xb7, 0xb7, 0xa9, 0xcf, 0x11, 0x8e, 0xe6, 0x00, 0xc0, 0x0c, 0x20, 0x53, 0x65],

  /** Audio Stream GUID */
  AUDIO_STREAM: [0x40, 0x9e, 0x69, 0xf8, 0x4d, 0x5b, 0xcf, 0x11, 0xa8, 0xfd, 0x00, 0x80, 0x5f, 0x5c, 0x44, 0x2b],

  /** Video Stream GUID: BC19EFC0-5B4D-11CF-A8FD-00805F5C442B */
  VIDEO_STREAM: [0xc0, 0xef, 0x19, 0xbc, 0x4d, 0x5b, 0xcf, 0x11, 0xa8, 0xfd, 0x00, 0x80, 0x5f, 0x5c, 0x44, 0x2b],

  /** ASF File Properties Object GUID */
  FILE_PROPERTIES: [0xa1, 0xdc, 0xab, 0x8c, 0x47, 0xa9, 0xcf, 0x11, 0x8e, 0xe4, 0x00, 0xc0, 0x0c, 0x20, 0x53, 0x65],

  /** ASF No Error Correction GUID: 20FB5700-5B55-11CF-A8FD-00805F5C442B */
  NO_ERROR_CORRECTION: [0x20, 0xfb, 0x57, 0x00, 0x5b, 0x55, 0xcf, 0x11, 0xa8, 0xfd, 0x00, 0x80, 0x5f, 0x5c, 0x44, 0x2b],

  /** ASF Audio Spread Error Correction GUID: BFC3CD50-618F-11CF-8BB2-00AA00B4E220 */
  AUDIO_SPREAD: [0xbf, 0xc3, 0xcd, 0x50, 0x61, 0x8f, 0xcf, 0x11, 0x8b, 0xb2, 0x00, 0xaa, 0x00, 0xb4, 0xe2, 0x20],

  /** Header Extension Object GUID: B503BF5F-2EA9-CF11-8EE3-00C00C205365 */
  HEADER_EXTENSION: [0xb5, 0x03, 0xbf, 0x5f, 0x2e, 0xa9, 0xcf, 0x11, 0x8e, 0xe3, 0x00, 0xc0, 0x0c, 0x20, 0x53, 0x65],

  /** Extended Stream Properties Object GUID: 14E6A5CB-C672-4332-8399-A96952065B5A */
  EXTENDED_STREAM_PROPERTIES: [0xcb, 0xa5, 0xe6, 0x14, 0x72, 0xc6, 0x32, 0x43, 0x83, 0x99, 0xa9, 0x69, 0x52, 0x06, 0x5b, 0x5a],
} as const;

/**
 * Calculate the total number of bytes for variable-length fields
 * @param lengthTypes Variable number of length type values (0=none, 1=byte, 2=word, 3=dword)
 * @returns Total number of bytes
 */
export function calculateFieldSizes(...lengthTypes: number[]): number {
  let total = 0;
  for (const type of lengthTypes) {
    switch (type) {
      case 0: {
        total += 0;
        break;
      }
      case 1: {
        total += 1;
        break;
      }
      case 2: {
        total += 2;
        break;
      }
      case 3: {
        total += 4;
        break;
      }
      default: {
        throw new UnsupportedFormatError(`Invalid ASF Data Length Field Type: ${type}`);
      }
    }
  }
  return total;
}

/**
 * Read a variable-length field from buffer
 * @param buffer Buffer to read from
 * @param offset Offset to start reading
 * @param type Field type (0=none, 1=byte, 2=word, 3=dword)
 * @returns Object with value and size, or null if insufficient data
 */
export function readVarLengthField(buffer: Uint8Array, offset: number, type: number): { value: number; size: number } {
  switch (type) {
    case 0: {
      return { value: 0, size: 0 };
    }
    case 1: {
      if (offset + 1 > buffer.length) throw new UnsupportedFormatError('Not an ASF file: insufficient data for variable-length field');
      return { value: buffer[offset], size: 1 };
    }
    case 2: {
      if (offset + 2 > buffer.length) throw new UnsupportedFormatError('Not an ASF file: insufficient data for variable-length field');
      return { value: readUInt16LE(buffer, offset), size: 2 };
    }
    case 3: {
      if (offset + 4 > buffer.length) throw new UnsupportedFormatError('Not an ASF file: insufficient data for variable-length field');
      return { value: readUInt32LE(buffer, offset), size: 4 };
    }
    default: {
      throw new UnsupportedFormatError(`Invalid ASF Data Length Field Type: ${type}`);
    }
  }
}

/**
 * Writes a GUID (16 bytes) and Object Size (8 bytes) to a buffer.
 * @param buf Buffer to write to
 * @param offset Offset in buffer
 * @param guid GUID to write
 * @param size Object size (number or bigint)
 * @returns The size of the object header (24 bytes).
 */
export function writeObjectHeader(buf: Uint8Array, offset: number, guid: readonly number[], size: number | bigint): number {
  buf.set(guid, offset);
  writeUInt64LE(buf, offset + 16, size);
  return 24;
}

/**
 * Check if 16 bytes at the given offset match a GUID
 * @param buffer The buffer to check
 * @param offset Offset to start checking from
 * @param guid The GUID array (16 bytes) to match against
 * @returns True if all 16 bytes match, false otherwise
 */
export function matchesGuid(buffer: Uint8Array, offset: number, guid: readonly number[]): boolean {
  if (offset + 16 > buffer.length) return false;
  for (let i = 0; i < 16; i++) {
    if (buffer[offset + i] !== guid[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Interprete ASF format tag to codec names and details
 * @param formatTag ASF format tag
 * @returns Object with codec and codecDetail
 */
export function interpreteAudioFormatTag(formatTag: number): { codec: AudioCodecType; codecDetail: string } {
  let codec: AudioCodecType;
  let codecDetail: string;

  switch (formatTag) {
    case 0x0160: {
      codec = 'wmav1';
      codecDetail = 'WMAv1';
      break;
    }
    case 0x0161: {
      codec = 'wmav2';
      codecDetail = 'WMAv2';
      break;
    }
    case 0x0162: {
      codec = 'wmapro';
      codecDetail = 'WMA Pro';
      break;
    }
    case 0x0163: {
      codec = 'wmalossless';
      codecDetail = 'WMA Lossless';
      break;
    }
    case 0x0055: {
      codec = 'mp3';
      codecDetail = 'MP3';
      break;
    }
    default: {
      codec = `unknown-0x${formatTag.toString(16)}` as AudioCodecType;
      codecDetail = `Unknown (0x${formatTag.toString(16)})`;
      break;
    }
  }

  return { codec, codecDetail };
}
