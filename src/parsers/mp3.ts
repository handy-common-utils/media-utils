import { GetMediaInfoOptions } from '../get-media-info';
import { AudioStreamInfo, MediaInfo } from '../media-info';
import { UnsupportedFormatError } from './adapter';

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

// Helper to parse Xing/Info/LAME header and extract total frames
function parseXingHeader(data: Uint8Array): { totalFrames?: number } {
  // Scan the first 256 bytes for 'Xing', 'Info', or 'LAME' header
  const scanLimit = Math.min(data.length - 12, 256); // need at least 12 bytes for header+fields
  for (let offset = 0; offset < scanLimit; ++offset) {
    // eslint-disable-next-line unicorn/prefer-code-point
    const tag = String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    if (tag === 'Xing' || tag === 'Info' || tag === 'LAME') {
      // Flags at offset+4 (4 bytes)
      // const flags = (data[offset + 7] << 24) | (data[offset + 6] << 16) | (data[offset + 5] << 8) | data[offset + 4];
      // Total frames at offset+8 (big-endian)
      const totalFrames = (data[offset + 8] << 24) | (data[offset + 9] << 16) | (data[offset + 10] << 8) | data[offset + 11];
      if (totalFrames > 0) {
        return { totalFrames };
      }
    }
  }
  return {};
}

/**
 * Parses MP3 file from a stream and extracts media information.
 * Note: The returned MediaInfo does not include the 'parser' field,
 * which should be set by the adapter.
 *
 * @param stream The input media stream
 * @param _options Optional options for the parser
 * @returns Media information without the parser field
 * @throws UnsupportedFormatError if the stream is not a valid MP3 file
 */
export async function parseMp3(stream: ReadableStream<Uint8Array>, _options?: GetMediaInfoOptions): Promise<Omit<MediaInfo, 'parser'>> {
  // Read the first chunk to parse the MP3 frame header
  const reader = stream.getReader();
  const { done, value } = await reader.read();
  reader.cancel();

  if (done || !value) {
    throw new UnsupportedFormatError('Not an MP3 file: insufficient data');
  }

  // Skip ID3v2 tag if present
  let offset = 0;
  if (value.length >= 10 && value[0] === 0x49 && value[1] === 0x44 && value[2] === 0x33) {
    // ID3v2 tag found, calculate size and skip it
    // Size is stored in bytes 6-9 as synchsafe integer (7 bits per byte)
    const size = ((value[6] & 0x7f) << 21) | ((value[7] & 0x7f) << 14) | ((value[8] & 0x7f) << 7) | (value[9] & 0x7f);
    offset = 10 + size; // 10 byte header + tag size
  }

  if (offset >= value.length) {
    throw new UnsupportedFormatError('Not an MP3 file: no frame header found after ID3 tag');
  }

  // Parse MP3 frame header
  const audioStream = parseMP3Header(value.slice(offset));

  // Try to extract duration from Xing/Info/LAME header
  let durationInSeconds: number | undefined = undefined;
  const xing = parseXingHeader(value.slice(offset));
  if (xing.totalFrames && audioStream.sampleRate) {
    // Samples per frame depends on MPEG version and Layer
    // For Layer III:
    // MPEG1: 1152 samples/frame, MPEG2/2.5: 576 samples/frame
    let samplesPerFrame = 1152;
    // version: 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    // Layer: 1 = Layer III
    const header = value.slice(offset, offset + 4);
    const version = (header[1] >> 3) & 0x03;
    const layer = (header[1] >> 1) & 0x03;
    switch (layer) {
      case 1: {
        // Layer III
        // eslint-disable-next-line unicorn/prefer-ternary
        if (version === 3) {
          samplesPerFrame = 1152; // MPEG1
        } else {
          samplesPerFrame = 576; // MPEG2/2.5
        }
        break;
      }
      case 2: {
        // Layer II
        samplesPerFrame = 1152;
        break;
      }
      case 3: {
        // Layer I
        samplesPerFrame = 384;
        break;
      }
      // No default
    }
    const totalSamples = xing.totalFrames * samplesPerFrame;
    durationInSeconds = totalSamples / audioStream.sampleRate;
  }

  return {
    container: 'mp3',
    containerDetail: 'mp3',
    durationInSeconds,
    videoStreams: [],
    audioStreams: [
      {
        ...audioStream,
        durationInSeconds,
      },
    ],
  };
}
