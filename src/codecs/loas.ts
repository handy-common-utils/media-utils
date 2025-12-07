import { UnsupportedFormatError } from '../utils';
import { parseAudioSpecificConfig } from './aac';
import { BitReader } from './binary';

/**
 * Parses LOAS header bytes to extract sample rate, channel count, and codec details
 * @param data LOAS header bytes
 * @param hasSyncWord Whether the input data is expected to start with sync word
 * @returns Parsed audio stream info
 */
export function parseLOAS(data: Uint8Array, hasSyncWord = true): ReturnType<typeof parseAudioMuxElement> {
  const br = new BitReader(data);

  if (hasSyncWord) {
    // -------------------------
    // 1. LOAS sync word check
    // -------------------------
    const syncWord = br.readBits(11);
    if (syncWord !== 0x2b7) {
      throw new UnsupportedFormatError('Invalid LOAS sync word');
    }
  }

  // -------------------------
  // 2. AudioMuxLength
  // -------------------------
  const audioMuxLength = readAudioMuxLength(br);

  // -------------------------
  // 3. audioMuxElement()
  // -------------------------
  const { sampleRate, channelCount, audioObjectType, codecDetail } = parseAudioMuxElement(br);

  return {
    sampleRate,
    channelCount,
    audioObjectType,
    codecDetail,
  };
}

function readAudioMuxLength(br: BitReader): number {
  let length = 0;
  let temp;
  do {
    temp = br.readBits(8);
    length += temp;
  } while (temp === 255);
  return length;
}

/**
 * Parse the AudioMuxConfig header
 * @param br bit reader
 * @param assertMuxVersions Optional tuple of expected audioMuxVersion and audioMuxVersionA values
 * @returns audio info from the header
 */
export function parseAudioMuxElement(br: BitReader, assertMuxVersions: [number, number] = [0, 0]): ReturnType<typeof parseAudioSpecificConfig> {
  const audioMuxVersion = br.readBits(1);
  const audioMuxVersionA = br.readBits(1);

  if (audioMuxVersion !== assertMuxVersions[0] || audioMuxVersionA !== assertMuxVersions[1]) {
    throw new UnsupportedFormatError(
      `Unsupported audioMuxVersion: [${audioMuxVersion}, ${audioMuxVersionA}], expected: [${assertMuxVersions[0]}, ${assertMuxVersions[1]}`,
    );
  }

  // allStreamsSameTimeFraming = 1 → Only this case supported
  const allStreamsSameTimeFraming = br.readBits(2);
  // if (allStreamsSameTimeFraming !== 1) {
  //   throw new UnsupportedFormatError('Unsupported LATM: allStreamsSameTimeFraming = 0');
  // }

  // numSubFrames (0 = one subframe)
  br.readBits(6); // numSubFrames

  // numPrograms
  const numPrograms = br.readBits(4);
  if (numPrograms !== 0) {
    throw new UnsupportedFormatError('Unsupported LATM: multiple programs');
  }

  // numLayers
  const numLayers = br.readBits(3);
  if (numLayers !== 0) {
    throw new UnsupportedFormatError('Unsupported LATM: multiple layers');
  }

  // -----------------------------------------
  // Stream 0 → read AudioSpecificConfig (ASC)
  // -----------------------------------------
  const asc = parseAudioSpecificConfig(br);

  // Other fields not strictly needed for config parsing
  const frameLengthType = br.readBits(3);

  switch (frameLengthType) {
    case 0: {
      br.readBits(8); // latmBufferFullness
      break;
    }
    case 1: {
      br.readBits(6); // celpFrameLengthTableIndex
      break;
    }
    case 3: {
      br.readBits(1); // hvxcFrameLengthTableIndex
      break;
    }
    default: {
      if (frameLengthType >= 4) {
        throw new UnsupportedFormatError(`Unsupported LATM frameLengthType: ${frameLengthType}`);
      }
      break;
    }
  }

  const otherDataPresent = br.readBits(1);
  if (otherDataPresent) {
    let otherDataLenBits = 0;
    if (audioMuxVersion === 1) {
      // Variable length via 2-bit escLen mechanism
      let temp: number;
      do {
        temp = br.readBits(2);
        otherDataLenBits += temp;
      } while (temp === 3);
    } else {
      // audioMuxVersion === 0
      // 8-bit chunks
      let temp: number;
      do {
        temp = br.readBits(8);
        otherDataLenBits += temp;
      } while (temp === 255);
    }

    if (otherDataLenBits > 0) {
      br.readBits(otherDataLenBits); // Read/Skip
    }
  }

  const crcCheckPresent = br.readBits(1);
  if (crcCheckPresent) {
    br.readBits(8); // crcCheckSum
  }

  // return parsed info
  return asc;
}
