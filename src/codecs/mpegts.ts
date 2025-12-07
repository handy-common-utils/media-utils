/* eslint-disable unicorn/explicit-length-check */
import { AudioStreamInfo, VideoStreamInfo } from '../media-info';
import { UnsupportedFormatError } from '../utils';
import { parseADTSHeader } from './aac';
import { BitReader, readAscii } from './binary';
import { h264LevelString, h264ProfileName, parseSPS } from './h264';
import { h265LevelString, h265ProfileName } from './h265';
import { parseAudioMuxElement, parseLOAS } from './loas';
import { parseMP3Header } from './mp3';

/**
 * Parses ES Descriptors
 * @param descriptors ES Descriptors
 * @param info The AudioStreamInfo or VideoStreamInfo object that will be updated with parsed data
 */
export function parseEsDescriptors(descriptors: Uint8Array, info: Omit<Partial<AudioStreamInfo | VideoStreamInfo>, 'codec' | 'codecDetail'>) {
  const audioInfo = info as Omit<AudioStreamInfo, 'id'>;
  const videoInfo = info as Omit<VideoStreamInfo, 'id'>;

  let offset = 0;
  while (offset + 2 <= descriptors.length) {
    const tag = descriptors[offset];
    const length = descriptors[offset + 1];
    const end = offset + 2 + length;

    if (end > descriptors.length) break;
    const body = descriptors.subarray(offset + 2, end);

    switch (tag) {
      // -------------------------------------------------------------------
      // ISO 639 Language Descriptor
      // -------------------------------------------------------------------
      case 0x0a: {
        parseLanguageDescriptorTagBody(body, audioInfo);
        break;
      }

      // -------------------------------------------------------------------
      // Registration Descriptor
      // -------------------------------------------------------------------
      case 0x05: {
        if (body.length >= 4) {
          const reg = readAscii(body, 0, 4);
          audioInfo.codecDetail = reg;
        }
        break;
      }

      // -------------------------------------------------------------------
      // AVC / H.264 Descriptor
      // -------------------------------------------------------------------
      case 0x28: {
        if (body.length >= 4) {
          const profileIdc = body[0];
          const levelIdc = body[2];
          videoInfo.profile = h264ProfileName(profileIdc);
          videoInfo.level = h264LevelString(levelIdc);
        }
        break;
      }

      // -------------------------------------------------------------------
      // HEVC / H.265 Descriptor
      // -------------------------------------------------------------------
      case 0x38: {
        if (body.length >= 12) {
          const profileIdc = body[0] & 0x1f;
          const levelIdc = body[11];
          videoInfo.profile = h265ProfileName(profileIdc);
          videoInfo.level = h265LevelString(levelIdc);
        }
        break;
      }

      // -------------------------------------------------------------------
      // AC-3 Descriptor
      // -------------------------------------------------------------------
      case 0x6a: {
        parseAc3DescriptorTagBody(body, audioInfo);
        break;
      }

      // -------------------------------------------------------------------
      // Enhanced AC-3 Descriptor
      // -------------------------------------------------------------------
      case 0x7b: {
        parseEac3DescriptorTagBody(body, audioInfo);
        break;
      }

      // -------------------------------------------------------------------
      // DTS Descriptor
      // -------------------------------------------------------------------
      case 0x7a: {
        parseDtsDescriptorTagBody(body, audioInfo);
        break;
      }

      // Ignore unknown descriptors (no extra allowed)
      default: {
        console.error('unknown ES descriptor', tag);
        break;
      }
    }

    offset = end;
  }
}

const AUDIO_TYPE_MAP: Record<number, string> = {
  0x00: 'Undefined',
  0x01: 'Clean effects / Commentary',
  0x02: 'Hearing impaired',
  0x03: 'Visual impaired / Audio description',
  0x04: 'Dialogue / Commentary',
  0x05: 'Commentary',
  0x06: 'Karaoke / Music and vocals',
  0x07: 'Orchestra / Music',
  0x08: 'Music',
  0x09: 'Effects',
  // 0x0A–0xFF are reserved
};

/**
 * Parses Language Descriptor tag body
 * @param body Language Descriptor tag body
 * @param info The AudioStreamInfo object that will be updated with parsed data
 */
export function parseLanguageDescriptorTagBody(body: Uint8Array, info: Partial<AudioStreamInfo>) {
  if (body.length >= 4) {
    info.language = readAscii(body, 0, 3);
    const audioTypeCode = body[3];
    if (audioTypeCode !== 0) {
      // 0 is "Undefined"
      info.audioType = AUDIO_TYPE_MAP[audioTypeCode];
    }
  }
}
/**
 * Parses ES Descriptor tag body for AC-3 audio stream
 * @param body ES Descriptor tag body
 * @param info The AudioStreamInfo object that will be updated with parsed data
 */
export function parseAc3DescriptorTagBody(body: Uint8Array, info: Partial<AudioStreamInfo>) {
  if (!info.codecDetails) info.codecDetails = {};
  if (body.length >= 1) info.codecDetails.componentType = body[0];
  if (body.length >= 2) info.codecDetails.bsmod = body[1];
  if (body.length >= 3) info.codecDetails.mainId = body[2];
  if (body.length >= 4) info.codecDetails.asvc = body[3];
}

/**
 * Parses ES Descriptor tag body for EAC-3 audio stream
 * @param body ES Descriptor tag body
 * @param info The AudioStreamInfo object that will be updated with parsed data
 */
export function parseEac3DescriptorTagBody(body: Uint8Array, info: Partial<AudioStreamInfo>) {
  if (!info.codecDetails) info.codecDetails = {};
  if (body.length >= 1) info.codecDetails.componentType = body[0];
  if (body.length >= 2) info.codecDetails.bsmod = body[1];
}

// Sample rate table (index → Hz)
const DTS_SAMPLE_RATE_TABLE: Record<number, number> = {
  0x0: 0, // Open/Unknown
  0x1: 8000,
  0x2: 16000,
  0x3: 32000,
  0x4: 11025,
  0x5: 22050,
  0x6: 44100,
  0x7: 12000,
  0x8: 24000,
  0x9: 48000,
  0xa: 96000,
  0xb: 192000,
  0xc: 0, // Reserved
  0xd: 0, // Reserved
  0xe: 0, // Reserved
  0xf: 0, // Open/Unknown
};

// Bitrate table (index → kbps)
const DTS_BITRATE_TABLE: Record<number, number> = {
  0x0: 32,
  0x1: 56,
  0x2: 64,
  0x3: 96,
  0x4: 112,
  0x5: 128,
  0x6: 192,
  0x7: 224,
  0x8: 256,
  0x9: 320,
  0xa: 384,
  0xb: 448,
  0xc: 512,
  0xd: 576,
  0xe: 640,
  0xf: 768, // Some tables go up to 1536 kbps
};

// Surround mode table (index → description)
const DTS_SURROUND_TABLE: Record<number, string> = {
  0x0: '1+1',
  0x1: '2/0',
  0x2: '3/0',
  0x3: '2/1',
  0x4: '3/1',
  0x5: '2/2',
  0x6: '3/2',
  0x7: '3/3',
};

/**
 * Tries to guess the audio header in PES payload.
 * This function is primarily for private streams (stream_type 0x06) generated by ffmpeg.
 * @param data PES payload
 * @param streamInfo The AudioStreamInfo object that will be updated with parsed data
 * @returns The offset of the first frame found
 */
export function guessAudioHeaderInPES(data: Uint8Array, streamInfo: Partial<AudioStreamInfo> & { streamTypeCategory?: string }): number {
  // console.error('guessAudioHeaderInPES', toHexString(data.subarray(0, 80)));

  if (data.length < 4) {
    throw new UnsupportedFormatError('Private PES payload too small');
  }

  // FFMPEG's LATM mux PES payload starts with AudioMuxConfig
  try {
    const br = new BitReader(data);
    const info = parseAudioMuxElement(br, [1, 0]);
    // console.error('private stream is ffmpeg packaged', info);

    if (info.sampleRate) streamInfo.sampleRate = info.sampleRate;
    if (info.channelCount) streamInfo.channelCount = info.channelCount;
    if (info.codecDetail) streamInfo.codecDetail = info.codecDetail;

    const framesOffset = br.getByteOffset();
    try {
      const mp3Offset = parseMp2OrMp3HeaderInPES(data.subarray(framesOffset), streamInfo, 20);
      streamInfo.streamTypeCategory = 'audio';
      // console.error('private stream is ffmpeg packaged MP2/MP3', streamInfo);
      return framesOffset + mp3Offset;
    } catch {
      const aacOffset = parseAacHeaderInPES(data.subarray(framesOffset), streamInfo, 20, false);
      streamInfo.streamTypeCategory = 'audio';
      // console.error('private stream is ffmpeg packaged AAC', streamInfo);
      return framesOffset + aacOffset;
    }
  } catch {
    throw new UnsupportedFormatError('Failed to guess private stream header inside PES');
  }
}

/**
 * Parses DTS header bytes to extract sample rate, bitrate, and surround mode
 * @param body ES Descriptor tag body
 * @param info The AudioStreamInfo object that will be updated with parsed data
 */
export function parseDtsDescriptorTagBody(body: Uint8Array, info: Partial<AudioStreamInfo>) {
  if (body.length >= 1) {
    const sampleRateCode = body[0] >> 4;
    const bitRateCode = body[0] & 0x0f;

    info.sampleRate = DTS_SAMPLE_RATE_TABLE[sampleRateCode] ?? 0;
    info.bitrate = (DTS_BITRATE_TABLE[bitRateCode] ?? 0) * 1000; // convert kbps → bps
  }

  if (body.length >= 2) {
    const surroundCode = body[1] >> 5;
    info.surroundMode = DTS_SURROUND_TABLE[surroundCode] ?? 'Unknown';
  }
}

/**
 * Parses AAC header bytes in a PES payload.
 * Detects ADTS / LOAS(LATM) / RAW AAC formats.
 * @param data ES Descriptor tag body
 * @param streamInfo The AudioStreamInfo object that will be updated with parsed data
 * @param searchRange Number of bytes to scan for frame sync
 * @param fallbackToRawAAC Whether to fallback to raw AAC if no valid header is found
 * @returns The offset of the first frame found
 * @throws UnsupportedFormatError if the data is not a valid AAC header
 */
export function parseAacHeaderInPES(data: Uint8Array, streamInfo: Partial<AudioStreamInfo>, searchRange = 20, fallbackToRawAAC = false): number {
  // console.error('parseAacHeaderInPES', toHexString(data.subarray(0, 80)));

  if (data.length < 4) {
    throw new UnsupportedFormatError('AAC PES payload too small');
  }

  const limit = Math.min(data.length - 2, searchRange);

  // 1. Search for ADTS syncword (0xFFF)
  for (let i = 0; i < limit; i++) {
    if (data[i] === 0xff && (data[i + 1] & 0xf0) === 0xf0) {
      try {
        const info = parseADTSHeader(data, i);

        if (info.sampleRate) streamInfo.sampleRate = info.sampleRate;
        if (info.channelCount) streamInfo.channelCount = info.channelCount;
        if (info.codecDetail) streamInfo.codecDetail = info.codecDetail;

        streamInfo.codec = 'aac';
        streamInfo.codecDetail = 'AAC in ADTS';
        // console.error(`Found ADTS header in PES at ${i}`, toHexString(data.subarray(0, searchRange + 10)));
        return i;
      } catch {
        // False positive, continue searching
      }
    }
  }

  // 2. Search for LOAS syncword (0x2B7 => 0x56 0xE0)
  for (let i = 0; i < limit; i++) {
    if (data[i] === 0x56 && (data[i + 1] & 0xe0) === 0xe0) {
      try {
        const info = parseLOAS(data.subarray(i));

        if (info.sampleRate) streamInfo.sampleRate = info.sampleRate;
        if (info.channelCount) streamInfo.channelCount = info.channelCount;
        if (info.codecDetail) streamInfo.codecDetail = info.codecDetail;

        streamInfo.codec = 'aac_latm';
        streamInfo.codecDetail = 'AAC in LOAS/LATM';
        // console.error(`Found LOAS header in PES at ${i}`, toHexString(data.subarray(0, searchRange + 10)));
        return i;
      } catch {
        // False positive, continue searching
      }
    }
  }

  // ------------------------------------------------------------
  // 3. RAW AAC (no ADTS header)
  // ------------------------------------------------------------
  // In TS, AAC raw access units are very common (stream_type 0x0F)
  // These rely on AudioSpecificConfig from PMT.
  if (fallbackToRawAAC) {
    streamInfo.codecDetail = 'RAW AAC';
    streamInfo.codec = 'aac';
    return 0; // Assume starts at 0 if raw
  }

  throw new UnsupportedFormatError('PES payload does not seem to be AAC');
}

/**
 * Parses MP2 or MP3 header bytes to extract sample rate, bitrate, and codec details
 * @param data ES Descriptor tag body
 * @param streamInfo The AudioStreamInfo object that will be updated with parsed data
 * @param searchRange Number of bytes to scan for frame sync
 * @returns The offset of the first frame found
 * @throws UnsupportedFormatError if the data is not a valid MP2/MP3 header
 */
export function parseMp2OrMp3HeaderInPES(data: Uint8Array, streamInfo: Partial<AudioStreamInfo>, searchRange = 20): number {
  // console.error('parseMp2OrMp3HeaderInPES', toHexString(data.subarray(0, 80)));
  if (data.length < 5) {
    throw new UnsupportedFormatError('MP2/MP3 header expected in PES but insufficient data');
  }

  // Look for frame sync (0xFFF)
  // Note: MP2/MP3 frame header is 4 bytes. We scan a bit to find it.
  for (let i = 0; i < Math.min(data.length - 4, searchRange); i++) {
    if (data[i] === 0xff && (data[i + 1] & 0xe0) === 0xe0) {
      try {
        // 111xxxxx
        const header = data.subarray(i, i + 4);
        const info = parseMP3Header(header); // Reusing MP3 parser which handles Layer I/II/III
        // console.error(`Found MP2/MP3 header in PES at ${i}`, toHexString(data.subarray(0, searchRange + 10)));

        // Update audio stream info
        Object.assign(streamInfo, {
          ...info,
          codecDetails: {
            ...streamInfo.codecDetails,
            ...info.codecDetails,
          },
        });
        return i;
      } catch {
        // Ignore
      }
    }
  }

  // Not found
  throw new UnsupportedFormatError('MP2/MP3 header expected in PES but not found or invalid');
}

/**
 * Parses H.264 NAL unit bytes to extract width, height, and codec details
 * @param data H.264 NAL unit bytes
 * @param streamInfo The VideoStreamInfo object that will be updated with parsed data
 * @throws UnsupportedFormatError if the data is not a valid H.264 NAL unit
 */
export function parseH264HeaderInPES(data: Uint8Array, streamInfo: Partial<VideoStreamInfo>) {
  if (data.length < 5) {
    throw new UnsupportedFormatError('H.264 NAL unit expected in PES but insufficient data');
  }

  // Look for SPS NAL unit (type 7)
  // Start code prefix: 00 00 01 or 00 00 00 01
  for (let i = 0; i < Math.min(data.length - 5, 4096); i++) {
    if (data[i] === 0x00 && data[i + 1] === 0x00) {
      let nalStart = -1;
      if (data[i + 2] === 0x01) {
        nalStart = i + 3;
      } else if (data[i + 2] === 0x00 && data[i + 3] === 0x01) {
        nalStart = i + 4;
      }

      if (nalStart !== -1) {
        if (data.length < nalStart + 5) {
          continue;
        }
        try {
          const nalType = data[nalStart] & 0x1f;
          if (nalType === 7) {
            // SPS
            // Found SPS, parse it
            // We need to pass the data starting from nalStart + 1 (after header)
            // But parseSPS expects the RBSP (Raw Byte Sequence Payload) which is handled inside it?
            // No, parseSPS in h264.ts takes the NAL unit payload (after header byte)
            const spsData = data.subarray(nalStart + 1);
            const info = parseSPS(spsData);

            if (info.width) streamInfo.width = info.width;
            if (info.height) streamInfo.height = info.height;
            if (info.codecDetail) streamInfo.codecDetail = info.codecDetail;
            return;
          }
        } catch {
          // Ignore
        }
      }
    }
  }

  // Not found
  throw new UnsupportedFormatError('H.264 NAL unit expected in PES but not found or invalid');
}

/**
 * Parses MPEG-2 Video Header
 * @param data Data containing the sequence header (starting with 0x000001B3)
 * @param streamInfo The VideoStreamInfo object that will be updated with parsed data
 * @throws UnsupportedFormatError if valid sequence header is not found
 */
export function parseMpeg2VideoHeaderInPES(data: Uint8Array, streamInfo: Partial<VideoStreamInfo>) {
  if (data.length < 12) {
    throw new UnsupportedFormatError('MPEG-2 Video Sequence Header expected in PES but insufficient data');
  }

  // Look for Sequence Header (0x000001B3)
  for (let i = 0; i < Math.min(data.length - 12, 2048); i++) {
    if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01 && data[i + 3] === 0xb3) {
      try {
        const info = parseMpeg2VideoSequenceHeader(data.subarray(i));

        if (info.width) streamInfo.width = info.width;
        if (info.height) streamInfo.height = info.height;
        if (info.fps) streamInfo.fps = info.fps;
        return;
      } catch {
        // Ignore and try next offset
      }
    }
  }

  // Not found
  throw new UnsupportedFormatError('MPEG-2 Video Sequence Header expected in PES but not found or invalid');
}

/**
 * Parses MPEG-2 Video Sequence Header
 * Start code: 0x000001B3
 *
 * @param data Data containing the sequence header (starting with 0x000001B3)
 * @returns Parsed video stream info
 */
export function parseMpeg2VideoSequenceHeader(data: Uint8Array): Partial<VideoStreamInfo> {
  if (data.length < 12) {
    throw new UnsupportedFormatError(`Invalid MPEG-2 Video Sequence Header has too few data bytes: ${data.length}`);
  }

  // Check start code
  if (data[0] !== 0x00 || data[1] !== 0x00 || data[2] !== 0x01 || data[3] !== 0xb3) {
    throw new UnsupportedFormatError(`Invalid MPEG-2 Video Sequence Header at ${data[0]}${data[1]}${data[2]}${data[3]}`);
  }

  // Horizontal size (12 bits)
  const horizontalSize = (data[4] << 4) | (data[5] >> 4);

  // Vertical size (12 bits)
  const verticalSize = ((data[5] & 0x0f) << 8) | data[6];

  // Aspect ratio information (4 bits)
  // const aspectRatioInfo = data[7] >> 4;

  // Frame rate code (4 bits)
  const frameRateCode = data[7] & 0x0f;

  // Bit rate (18 bits)
  // const bitRateValue = (data[8] << 10) | (data[9] << 2) | (data[10] >> 6);
  // Bit rate is in units of 400 bits/second.
  // const bitRate = bitRateValue * 400;

  // Marker bit (1 bit) - should be 1
  // const markerBit = (data[10] >> 5) & 0x01;

  // VBV buffer size (10 bits)
  // const vbvBufferSize = ((data[10] & 0x1f) << 5) | (data[11] >> 3);

  // Constrained parameters flag (1 bit)
  // const constrainedParametersFlag = (data[11] >> 2) & 0x01;

  // Load intra quantizer matrix flag (1 bit)
  // const loadIntraQuantizerMatrixFlag = (data[11] >> 1) & 0x01;

  // Load non-intra quantizer matrix flag (1 bit)
  // const loadNonIntraQuantizerMatrixFlag = data[11] & 0x01;

  let fps: number | undefined;
  switch (frameRateCode) {
    case 1: {
      fps = 23.976;
      break;
    }
    case 2: {
      fps = 24;
      break;
    }
    case 3: {
      fps = 25;
      break;
    }
    case 4: {
      fps = 29.97;
      break;
    }
    case 5: {
      fps = 30;
      break;
    }
    case 6: {
      fps = 50;
      break;
    }
    case 7: {
      fps = 59.94;
      break;
    }
    case 8: {
      fps = 60;
      break;
    }
    default: {
      // Reserved or forbidden
      break;
    }
  }

  return {
    width: horizontalSize,
    height: verticalSize,
    fps,
  };
}
