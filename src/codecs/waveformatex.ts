import { AudioCodecType } from '../media-info';
import { readUInt16LE, readUInt32LE, writeInt16LE, writeUInt16LE, writeUInt32LE } from './binary';

/**
 * WAVEFORMATEX structure
 *
 * This is a standard Windows multimedia structure used in:
 * - WAV files (fmt chunk)
 * - AVI files (audio stream format chunk)
 * - MKV files (A_MS/ACM CodecPrivate)
 * - ASF/WMV files (audio stream properties)
 */
export interface WaveFormatEx {
  /** Format tag (wFormatTag) — identifies the codec type */
  formatTag: number;
  /** Number of audio channels */
  channels: number;
  /** Sample rate in Hz */
  samplesPerSec: number;
  /** Average bytes per second (for constant bitrate) */
  avgBytesPerSec: number;
  /** Block alignment in bytes */
  blockAlign: number;
  /** Bits per sample (for PCM) */
  bitsPerSample: number;
  /** ADPCM-specific details (for MS ADPCM) */
  adpcmDetails?: {
    samplesPerBlock: number;
  };
}

/**
 * The 7 standard MS ADPCM predictor coefficient pairs
 * These are FIXED and STANDARDIZED — they never change between streams or files.
 *
 * Each ADPCM block header contains a predictor index (0-6) that selects
 * which coefficient pair to use for decoding that specific block.
 */
export const MS_ADPCM_COEFFICIENTS = [
  { coeff1: 256, coeff2: 0 }, // Predictor 0
  { coeff1: 512, coeff2: -256 }, // Predictor 1
  { coeff1: 0, coeff2: 0 }, // Predictor 2
  { coeff1: 192, coeff2: 64 }, // Predictor 3
  { coeff1: 240, coeff2: 0 }, // Predictor 4
  { coeff1: 460, coeff2: -208 }, // Predictor 5
  { coeff1: 392, coeff2: -232 }, // Predictor 6
] as const;

/**
 * Parse WAVEFORMATEX structure from a buffer
 *
 * Reads the standard 16-byte WAVEFORMATEX structure and optionally
 * parses extended data (cbSize + extra bytes) for non-PCM formats.
 *
 * @param buffer Buffer containing WAVEFORMATEX data
 * @param offset Starting offset in buffer
 * @param maxSize Maximum number of bytes available (for bounds checking)
 * @returns Parsed WAVEFORMATEX structure and bytes consumed
 */
export function parseWaveFormatEx(buffer: Uint8Array, offset: number, maxSize?: number): { format: WaveFormatEx; bytesRead: number } {
  const availableSize = maxSize ?? buffer.length - offset;

  if (availableSize < 16) {
    throw new Error('Insufficient data for WAVEFORMATEX structure (need at least 16 bytes)');
  }

  // Read the standard 16-byte WAVEFORMATEX fields (little-endian)
  const formatTag = readUInt16LE(buffer, offset);
  const channels = readUInt16LE(buffer, offset + 2);
  const samplesPerSec = readUInt32LE(buffer, offset + 4);
  const avgBytesPerSec = readUInt32LE(buffer, offset + 8);
  const blockAlign = readUInt16LE(buffer, offset + 12);
  const bitsPerSample = readUInt16LE(buffer, offset + 14);

  let bytesRead = 16;
  const format: WaveFormatEx = { formatTag, channels, samplesPerSec, avgBytesPerSec, blockAlign, bitsPerSample };

  // Check for extra data (cbSize + extra bytes)
  // For non-PCM formats, WAVEFORMATEX is extended with codec-specific data
  if (availableSize > 16) {
    const cbSize = readUInt16LE(buffer, offset + 16);
    bytesRead += 2; // cbSize field itself

    // Parse MS ADPCM specific data (formatTag 0x0002)
    // MS ADPCM extra data structure:
    // - samplesPerBlock (2 bytes) — STREAM LEVEL: constant for entire stream
    // - numCoef (2 bytes) — always 7 for MS ADPCM
    // - coefficients (numCoef * 4 bytes) — the 7 standard predictor coefficient pairs
    //
    // Note: The coefficient values are standardized and don't need to be stored.
    // Each ADPCM block header contains a predictor index (0-6) that selects
    // which coefficient pair to use for that block.
    if (formatTag === 0x0002 && cbSize >= 4 && availableSize >= 16 + 2 + 2) {
      // samplesPerBlock: How many PCM samples each ADPCM block will decode to
      // This is STREAM LEVEL — constant for the entire audio stream
      const samplesPerBlock = readUInt16LE(buffer, offset + 18);
      format.adpcmDetails = { samplesPerBlock };
      bytesRead += 2; // samplesPerBlock

      // Skip the rest (numCoef + coefficients)
      // MS ADPCM coefficients are standardized (always the same 7 pairs)
      // and don't need to be stored per-stream
      const remainingExtraData = cbSize - 2;
      bytesRead += remainingExtraData;
    } else if (cbSize > 0) {
      // Skip other extra data
      bytesRead += cbSize;
    }
  }

  return { format, bytesRead };
}

/**
 * Build WAVEFORMATEX structure as Uint8Array
 *
 * Serializes a WAVEFORMATEX structure into bytes, including extended
 * data for MS ADPCM if present.
 *
 * @param format WaveFormatEx structure
 * @returns Serialized WAVEFORMATEX bytes
 */
export function buildWaveFormatEx(format: WaveFormatEx): Uint8Array {
  let extraData = new Uint8Array(0);

  // Build extra data for MS ADPCM
  if (format.formatTag === 0x0002 && format.adpcmDetails?.samplesPerBlock) {
    const { samplesPerBlock } = format.adpcmDetails;
    const numCoef = 7;

    // cbSize (2) + samplesPerBlock (2) + numCoef (2) + coefficients (7 * 4 = 28)
    const extraDataSize = 2 + 2 + 2 + numCoef * 4;
    extraData = new Uint8Array(extraDataSize);
    // cbSize: size of the extra data following this field
    writeUInt16LE(extraData, 0, extraDataSize - 2);

    // samplesPerBlock: STREAM LEVEL — constant for entire stream
    writeUInt16LE(extraData, 2, samplesPerBlock);

    // numCoef: always 7 for MS ADPCM
    writeUInt16LE(extraData, 4, numCoef);

    // Write the 7 standard coefficient pairs
    // These are required by the WAV/AVI format specification,
    // even though they're always the same values
    for (let i = 0; i < numCoef; i++) {
      writeInt16LE(extraData, 6 + i * 4, MS_ADPCM_COEFFICIENTS[i].coeff1);
      writeInt16LE(extraData, 8 + i * 4, MS_ADPCM_COEFFICIENTS[i].coeff2);
    }
  } else if (format.formatTag !== 0x0001) {
    // For non-PCM formats, we need a cbSize of 0 at least
    extraData = new Uint8Array(2);
    // cbSize = 0 (already initialized to 0)
  }

  // Allocate buffer for base WAVEFORMATEX (16 bytes) + extra data
  const totalSize = 16 + extraData.length;
  const buffer = new Uint8Array(totalSize);
  // Write the standard 16-byte WAVEFORMATEX fields (little-endian)
  writeUInt16LE(buffer, 0, format.formatTag);
  writeUInt16LE(buffer, 2, format.channels);
  writeUInt32LE(buffer, 4, format.samplesPerSec);
  writeUInt32LE(buffer, 8, format.avgBytesPerSec);
  writeUInt16LE(buffer, 12, format.blockAlign);
  writeUInt16LE(buffer, 14, format.bitsPerSample);

  // Append extra data if present
  if (extraData.length > 0) {
    buffer.set(extraData, 16);
  }

  return buffer;
}

/**
 * Map WAVE format tag to codec information
 *
 * Converts a WAVEFORMATEX formatTag value to our internal codec type
 * and a human-readable codec detail string.
 *
 * @param formatTag WAVE format tag (e.g., 0x0001 = PCM, 0x0002 = MS ADPCM)
 * @param bitsPerSample Bits per sample (for PCM variants)
 * @returns Codec type and detail string
 */
export function mapWaveFormatTagToCodec(formatTag: number, bitsPerSample?: number): { codec: AudioCodecType; codecDetail: string } {
  let codec: AudioCodecType;
  let codecDetail: string;

  switch (formatTag) {
    case 0x0001: {
      // PCM - codec variant depends on bits per sample
      switch (bitsPerSample) {
        case 8: {
          codec = 'pcm_u8';
          codecDetail = 'pcm_u8';
          break;
        }
        case 16: {
          codec = 'pcm_s16le';
          codecDetail = 'pcm_s16le';
          break;
        }
        case 24: {
          codec = 'pcm_s24le';
          codecDetail = 'pcm_s24le';
          break;
        }
        case 32: {
          codec = 'pcm_s32le';
          codecDetail = 'pcm_s32le';
          break;
        }
        default: {
          codec = 'pcm_s16le';
          codecDetail = bitsPerSample ? `pcm_s${bitsPerSample}le` : 'pcm_s16le';
        }
      }
      break;
    }
    case 0x0002: {
      // MS ADPCM
      codec = 'adpcm_ms';
      codecDetail = 'adpcm_ms';
      break;
    }
    case 0x0003: {
      // IEEE Float
      codec = 'pcm_f32le';
      codecDetail = 'pcm_f32le';
      break;
    }
    case 0x0006: {
      // ALAW
      codec = 'pcm_alaw';
      codecDetail = 'pcm_alaw';
      break;
    }
    case 0x0007: {
      // MULAW
      codec = 'pcm_mulaw';
      codecDetail = 'pcm_mulaw';
      break;
    }
    case 0x0011: {
      // IMA ADPCM (DVI ADPCM)
      codec = 'adpcm_ima_wav';
      codecDetail = 'adpcm_ima_wav';
      break;
    }
    case 0x0050:
    case 0x0055: {
      // MPEG Layer 3
      codec = 'mp3';
      codecDetail = 'mp3';
      break;
    }
    case 0x0069: {
      // IMA ADPCM (alternative tag)
      codec = 'adpcm_ms';
      codecDetail = 'adpcm_ms';
      break;
    }
    case 0x0160: {
      // Windows Media Audio v1
      codec = 'wmav1';
      codecDetail = 'WMAv1';
      break;
    }
    case 0x0161: {
      // Windows Media Audio v2
      codec = 'wmav2';
      codecDetail = 'WMAv2';
      break;
    }
    case 0x0162: {
      // Windows Media Audio Pro
      codec = 'wmapro';
      codecDetail = 'WMA Pro';
      break;
    }
    case 0x0163: {
      // Windows Media Audio Lossless
      codec = 'wmalossless';
      codecDetail = 'WMA Lossless';
      break;
    }
    case 0x2000:
    case 0x0002000: {
      // AC-3
      codec = 'ac3';
      codecDetail = 'AC-3';
      break;
    }
    case 0x2001: {
      // DTS
      codec = 'dts';
      codecDetail = 'DTS';
      break;
    }
    case 0xfffe: {
      // WAVE_FORMAT_EXTENSIBLE - tricky, depends on SubFormat GUID
      codec = 'pcm_s16le'; // Fallback
      codecDetail = 'WAVE_FORMAT_EXTENSIBLE';
      break;
    }
    default: {
      codec = 'unknown' as AudioCodecType;
      codecDetail = `Unknown (0x${formatTag.toString(16).padStart(4, '0')})`;
    }
  }

  return { codec, codecDetail };
}
