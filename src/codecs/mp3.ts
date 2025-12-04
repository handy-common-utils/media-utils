import { AudioStreamInfo } from '../media-info';
import { UnsupportedFormatError } from '../utils';

/**
 * MP3 bitrate table (in kbps) indexed by [version][layer][bitrate_index]
 * Version: 0 = MPEG 2.5, 1 = reserved, 2 = MPEG 2, 3 = MPEG 1
 * Layer: 0 = reserved, 1 = Layer III, 2 = Layer II, 3 = Layer I
 */
const BITRATE_TABLE: number[][][] = [
  // MPEG 2.5
  [
    [], // reserved
    [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1], // Layer III
    [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1], // Layer II
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, -1], // Layer I
  ],
  [], // reserved
  // MPEG 2
  [
    [], // reserved
    [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1], // Layer III
    [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1], // Layer II
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, -1], // Layer I
  ],
  // MPEG 1
  [
    [], // reserved
    [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1], // Layer III
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, -1], // Layer II
    [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, -1], // Layer I
  ],
];

/**
 * MP3 sample rate table (in Hz) indexed by [version][sample_rate_index]
 */
const SAMPLE_RATE_TABLE: number[][] = [
  [11025, 12000, 8000, -1], // MPEG 2.5
  [-1, -1, -1, -1], // reserved
  [22050, 24000, 16000, -1], // MPEG 2
  [44100, 48000, 32000, -1], // MPEG 1
];

/**
 * Parses an MP3 frame header and extracts audio stream information.
 *
 * @param data The MP3 data with frame header
 * @returns Audio stream information extracted from the MP3 frame header
 * @throws UnsupportedFormatError if the data is not a valid MP3 frame header
 */
export function parseMP3Header(data: Uint8Array): AudioStreamInfo {
  if (data.length < 4) {
    throw new UnsupportedFormatError('Not an MP3 file: insufficient data');
  }

  // Frame Sync Patterns
  // 11 bits set to 1 → 0xFFE or 0xFFF (when including next bit)
  // Byte 1 must be: 0xFF
  // (binary: 1111 1111)
  // Byte 2 must be: 111xxxxx
  // (where xxxxx are valid MPEG header fields)

  // Parse MP3 frame header (4 bytes)
  const header = data.slice(0, 4);

  // Check sync word (11 bits) - should be 0x7FF (all 1s)
  const syncword = (header[0] << 3) | (header[1] >> 5);
  if (syncword !== 0x7ff) {
    throw new UnsupportedFormatError('Invalid MP3 header: syncword mismatch');
  }

  // Extract MPEG version (2 bits)
  const version = (header[1] >> 3) & 0x03;
  if (version === 1) {
    throw new UnsupportedFormatError('Invalid MP3 header: reserved version');
  }

  // Extract layer (2 bits)
  const layer = (header[1] >> 1) & 0x03;
  if (layer === 0) {
    throw new UnsupportedFormatError('Invalid MP3 header: reserved layer');
  }

  // Extract protection bit (1 bit) - 0 = protected by CRC, 1 = not protected
  const _protectionBit = header[1] & 0x01;

  // Extract bitrate index (4 bits)
  const bitrateIndex = (header[2] >> 4) & 0x0f;
  if (bitrateIndex === 0x0f) {
    throw new UnsupportedFormatError('Invalid MP3 header: invalid bitrate index');
  }

  // Extract sample rate index (2 bits)
  const sampleRateIndex = (header[2] >> 2) & 0x03;

  // Extract padding bit (1 bit)
  const _paddingBit = (header[2] >> 1) & 0x01;

  // Extract private bit (1 bit)
  const _privateBit = header[2] & 0x01;

  // Extract channel mode (2 bits)
  const channelMode = (header[3] >> 6) & 0x03;
  // 0 = Stereo, 1 = Joint stereo, 2 = Dual channel, 3 = Mono
  const channelCount = channelMode === 3 ? 1 : 2;

  // Get bitrate from table
  const bitrate = BITRATE_TABLE[version]?.[layer]?.[bitrateIndex];
  if (!bitrate || bitrate === -1) {
    throw new UnsupportedFormatError(`Invalid MP3 header: unsupported bitrate (version=${version}, layer=${layer}, index=${bitrateIndex})`);
  }

  // Get sample rate from table
  const sampleRate = SAMPLE_RATE_TABLE[version]?.[sampleRateIndex];
  if (!sampleRate || sampleRate === -1) {
    throw new UnsupportedFormatError(`Invalid MP3 header: unsupported sample rate (version=${version}, index=${sampleRateIndex})`);
  }

  return {
    id: 1,
    codec: 'mp3',
    codecDetail: 'mp3',
    channelCount,
    sampleRate,
    bitrate: bitrate * 1000, // Convert kbps to bps
    durationInSeconds: undefined,
  };
}

/**
 * VBR header information extracted from Xing/LAME or VBRI headers
 */
export interface VBRHeaderInfo {
  /** Total number of frames in the file */
  totalFrames?: number;
  /** Total file size in bytes (excluding ID3 tags) */
  fileSize?: number;
  /** Average bitrate in bps (calculated or from header) */
  bitrate?: number;
  /** Header type found */
  headerType?: 'Xing' | 'Info' | 'LAME' | 'VBRI';
}

/**
 * Parse VBR headers (Xing/Info/LAME or VBRI) from MP3 data
 *
 * Xing/Info/LAME header (used by LAME encoder):
 * - Located after the first MP3 frame header
 * - Contains: total frames, file size, quality indicator
 * - "Xing" = VBR, "Info" = CBR with header, "LAME" = LAME encoder
 *
 * VBRI header (used by Fraunhofer encoder):
 * - Located at fixed offset 36 bytes after frame header
 * - Contains: total frames, file size, quality
 *
 * @param data The MP3 data starting from frame header
 * @returns VBR header information
 */
export function parseVBRHeader(data: Uint8Array): VBRHeaderInfo {
  const result: VBRHeaderInfo = {};

  // Try Xing/Info/LAME header first (more common)
  // Scan the first 256 bytes for 'Xing', 'Info', or 'LAME' header
  const scanLimit = Math.min(data.length - 12, 256); // need at least 12 bytes for header+fields
  for (let offset = 0; offset < scanLimit; ++offset) {
    // eslint-disable-next-line unicorn/prefer-code-point
    const tag = String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);

    if (tag === 'Xing' || tag === 'Info' || tag === 'LAME') {
      result.headerType = tag as 'Xing' | 'Info' | 'LAME';

      // Flags at offset+4 (4 bytes, big-endian)
      // Bit 0: Frames field is present
      // Bit 1: Bytes field is present
      // Bit 2: TOC field is present
      // Bit 3: Quality field is present
      const flags = (data[offset + 4] << 24) | (data[offset + 5] << 16) | (data[offset + 6] << 8) | data[offset + 7];

      let fieldOffset = offset + 8;

      // Frames field (4 bytes, big-endian) - if flag bit 0 is set
      if (flags & 0x0001 && fieldOffset + 4 <= data.length) {
        const totalFrames = (data[fieldOffset] << 24) | (data[fieldOffset + 1] << 16) | (data[fieldOffset + 2] << 8) | data[fieldOffset + 3];
        if (totalFrames > 0) {
          result.totalFrames = totalFrames;
        }
        fieldOffset += 4;
      }

      // Bytes field (4 bytes, big-endian) - if flag bit 1 is set
      if (flags & 0x0002 && fieldOffset + 4 <= data.length) {
        const fileSize = (data[fieldOffset] << 24) | (data[fieldOffset + 1] << 16) | (data[fieldOffset + 2] << 8) | data[fieldOffset + 3];
        if (fileSize > 0) {
          result.fileSize = fileSize;
        }
        fieldOffset += 4;
      }

      // TOC field (100 bytes) - if flag bit 2 is set
      if (flags & 0x0004) {
        fieldOffset += 100;
      }

      // Quality field (4 bytes) - if flag bit 3 is set
      // We don't use this currently

      return result;
    }
  }

  // Try VBRI header (Fraunhofer encoder)
  // VBRI header is located at a fixed offset of 36 bytes after the frame header
  const vbriOffset = 36;
  if (data.length >= vbriOffset + 26) {
    // eslint-disable-next-line unicorn/prefer-code-point
    const vbriTag = String.fromCharCode(data[vbriOffset], data[vbriOffset + 1], data[vbriOffset + 2], data[vbriOffset + 3]);

    if (vbriTag === 'VBRI') {
      result.headerType = 'VBRI';

      // VBRI header structure:
      // 0-3: "VBRI" (4 bytes)
      // 4-5: Version (2 bytes, big-endian)
      // 6-7: Delay (2 bytes, big-endian)
      // 8-9: Quality indicator (2 bytes, big-endian)
      // 10-13: Bytes (4 bytes, big-endian) - total file size
      // 14-17: Frames (4 bytes, big-endian) - total number of frames
      // 18-19: TOC entries (2 bytes, big-endian)
      // 20-21: TOC scale (2 bytes, big-endian)
      // 22-23: TOC entry size (2 bytes, big-endian)
      // 24-25: TOC frames per entry (2 bytes, big-endian)

      // File size (bytes 10-13, big-endian)
      const fileSize = (data[vbriOffset + 10] << 24) | (data[vbriOffset + 11] << 16) | (data[vbriOffset + 12] << 8) | data[vbriOffset + 13];
      if (fileSize > 0) {
        result.fileSize = fileSize;
      }

      // Total frames (bytes 14-17, big-endian)
      const totalFrames = (data[vbriOffset + 14] << 24) | (data[vbriOffset + 15] << 16) | (data[vbriOffset + 16] << 8) | data[vbriOffset + 17];
      if (totalFrames > 0) {
        result.totalFrames = totalFrames;
      }

      return result;
    }
  }

  return result;
}

/**
 * Helper to parse Xing/Info/LAME header and get total number of frames
 * @deprecated Use parseVBRHeader instead
 * @param data The MP3 data with frame header
 * @returns Total number of frames got from the Xing/Info/LAME header
 */
export function parseXingHeader(data: Uint8Array): { totalFrames?: number } {
  const vbrInfo = parseVBRHeader(data);
  return { totalFrames: vbrInfo.totalFrames };
}
