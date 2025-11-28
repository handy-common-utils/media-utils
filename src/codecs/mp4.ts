import { UnsupportedFormatError } from '../utils';

/**
 * Parse MP3 frame header usually found in MP4.
 * @param frameHeader MP3 frame header
 * @returns Sample rate and channel count
 */
export function readMp3Header(frameHeader: Uint8Array) {
  if (frameHeader.length < 4) return { sampleRate: undefined, channels: undefined };

  const b1 = frameHeader[1];
  const b2 = frameHeader[2];
  const b3 = frameHeader[3];

  // MPEG Audio version
  const versionBits = (b1 >> 3) & 0x03;
  const version = [2.5, undefined, 2, 1][versionBits]; // 00=2.5, 10=2, 11=1

  // Sample rate
  const sampleRateIndex = (b2 >> 2) & 0x03;
  const sampleRates =
    version === 1 ? [44100, 48000, 32000, 0] : version === 2 ? [22050, 24000, 16000, 0] : version === 2.5 ? [11025, 12000, 8000, 0] : [0, 0, 0, 0];

  const sampleRate = sampleRates[sampleRateIndex];

  // Channel mode
  const channelModeBits = (b3 >> 6) & 0x03;
  const channels = channelModeBits === 3 ? 1 : 2;

  return { sampleRate, channels };
}

/**
 * Based on MP4 container structure convention, parse the header and find out the data length.
 * @param data Data buffer
 * @param offset Offset to start reading from
 * @returns Length and header size
 */
export function readMp4Length(data: Uint8Array, offset: number): { length: number; headerSize: number } {
  // MPEG-4 size field: continuation bit 1 = more bytes
  let length = 0;
  let bytesRead = 0;
  let b: number;

  do {
    b = data[offset + bytesRead];
    length = (length << 7) | (b & 0x7f);
    bytesRead++;
  } while (b & 0x80);

  return { length, headerSize: bytesRead };
}

export interface EsdsInfo {
  ES_ID: number;
  objectTypeIndication: number;
  streamType: number;
  bufferSizeDB: number;
  maxBitrate: number;
  avgBitrate: number;
  decoderSpecificInfo?: Uint8Array;
  sampleRate?: number; // MP3 sample rate
  channels?: number; // MP3 channel count
}

/**
 * Parse the ESDS box.
 * @param data Data buffer
 * @returns ESDS information
 */
export function parseEsds(data: Uint8Array): EsdsInfo | undefined {
  // Find 'esds'
  let offset = 0;
  while (offset < data.length - 4) {
    if (data[offset] === 101 && data[offset + 1] === 115 && data[offset + 2] === 100 && data[offset + 3] === 115) {
      offset += 4;
      break;
    }
    offset++;
  }
  offset += 4; // ESDS version + flags
  if (offset >= data.length) return undefined;

  // ---- ES_Descriptor ----
  if (data[offset] !== 0x03) throw new UnsupportedFormatError(`Expected ES_Descriptor at offset ${offset}`);
  offset++;
  const esLengthInfo = readMp4Length(data, offset);
  offset += esLengthInfo.headerSize;

  const ES_ID = (data[offset] << 8) | data[offset + 1];
  offset += 2;
  const flags = data[offset];
  offset += 1;

  if (flags & 0x80) offset += 2;
  if (flags & 0x40) {
    const urlLen = data[offset];
    offset += 1 + urlLen;
  }
  if (flags & 0x20) offset += 2;

  // ---- DecoderConfigDescriptor ----
  if (data[offset] !== 0x04) throw new UnsupportedFormatError(`Expected DecoderConfigDescriptor at offset ${offset}`);
  offset++;
  const dcdLengthInfo = readMp4Length(data, offset);
  offset += dcdLengthInfo.headerSize;

  const objectTypeIndication = data[offset++];
  const streamType = data[offset++] >> 2;
  const bufferSizeDB = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];
  offset += 3;
  const maxBitrate = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
  offset += 4;
  const avgBitrate = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
  offset += 4;

  let decoderSpecificInfo: Uint8Array | undefined;
  let sampleRate: number | undefined;
  let channels: number | undefined;

  // ---- DecoderSpecificInfo ----
  if (data[offset] === 0x05) {
    offset++;
    const dsiLengthInfo = readMp4Length(data, offset);
    const dsiLength = dsiLengthInfo.length;
    offset += dsiLengthInfo.headerSize;
    decoderSpecificInfo = data.subarray(offset, offset + dsiLength);
    offset += dsiLength;

    if (objectTypeIndication === 0x6b && decoderSpecificInfo.length >= 4) {
      // MP3 frame header available, parse it
      const header = decoderSpecificInfo.subarray(0, 4);
      const mp3Info = readMp3Header(header);
      sampleRate = mp3Info.sampleRate;
      channels = mp3Info.channels;
    }
  }

  return {
    ES_ID,
    objectTypeIndication,
    streamType,
    bufferSizeDB,
    maxBitrate,
    avgBitrate,
    decoderSpecificInfo,
    sampleRate,
    channels,
  };
}
