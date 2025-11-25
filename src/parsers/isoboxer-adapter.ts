import { toAudioCodecType, toContainerType, toVideoCodecType } from '../codec-utils';
import { GetMediaInfoOptions } from '../get-media-info';
import { AudioStreamInfo, MediaInfo, VideoStreamInfo } from '../media-info';
import { MediaParserAdapter, ParsingError, UnsupportedFormatError } from './adapter';

export class IsoBoxerAdapter implements MediaParserAdapter {
  private ISOBoxer: any;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module
    this.ISOBoxer = require('codem-isoboxer');
  }

  async parse(stream: ReadableStream<Uint8Array>, options?: GetMediaInfoOptions): Promise<MediaInfo> {
    try {
      return await this.parseWithoutErrorHandling(stream, options);
    } catch (error) {
      if (error && !(error as ParsingError).isUnsupportedFormatError) {
        const msg = (error as Error)?.message;
        if (msg && /(Unknown|Invalid|Unsupported|not found|cannot parse)/i.test(msg)) {
          (error as ParsingError).isUnsupportedFormatError = true;
        }
      }

      throw error;
    }
  }

  private async parseWithoutErrorHandling(stream: ReadableStream<Uint8Array>, _options?: GetMediaInfoOptions): Promise<MediaInfo> {
    // The first 1MB of the file is read and then fed to the parser
    const MAX_PROBE_SIZE = 1 * 1024 * 1024; // 1MB
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    let bytesRead = 0;
    while (bytesRead < MAX_PROBE_SIZE) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        bytesRead += value.length;
      }
    }
    reader.cancel();

    // Combine chunks into a single ArrayBuffer
    const arrayBuffer = new ArrayBuffer(bytesRead);
    const uint8Array = new Uint8Array(arrayBuffer);
    let offset = 0;
    for (const chunk of chunks) {
      uint8Array.set(chunk, offset);
      offset += chunk.length;
    }

    // Parse the buffer using ISOBoxer
    const parsedFile = this.ISOBoxer.parseBuffer(arrayBuffer);

    if (!parsedFile || !parsedFile.boxes) {
      throw new UnsupportedFormatError('Failed to parse file with ISOBoxer');
    }

    // Extract ftyp box for container information
    const ftyp = parsedFile.fetch('ftyp');
    if (!ftyp) {
      throw new UnsupportedFormatError('ftyp box not found - file may not be a valid MP4/ISOBMFF file');
    }

    const brands = [ftyp.major_brand, ...(ftyp.compatible_brands || [])];
    const container = toContainerType(brands);

    // Extract moov box for metadata
    const moov = parsedFile.fetch('moov');
    if (!moov) {
      throw new UnsupportedFormatError('moov box not found - file may be incomplete or corrupted');
    }

    // Get all track boxes using fetchAll on the parsed file (not on moov)
    const traks = parsedFile.fetchAll('trak');
    if (!traks || traks.length === 0) {
      throw new UnsupportedFormatError('No tracks found in file');
    }

    const videoStreams: VideoStreamInfo[] = [];
    const audioStreams: AudioStreamInfo[] = [];
    let durationInSeconds: number | undefined;

    // Extract movie header duration if available
    const mvhd = moov.boxes?.find((box: any) => box.type === 'mvhd');
    if (mvhd && mvhd.duration && mvhd.timescale) {
      durationInSeconds = mvhd.duration / mvhd.timescale;
    }

    // Process each track
    for (const trak of traks) {
      // Navigate to mdia box
      const mdia = trak.boxes?.find((box: any) => box.type === 'mdia');
      if (!mdia) continue;

      const tkhd = trak.boxes?.find((box: any) => box.type === 'tkhd');
      const mdhd = mdia.boxes?.find((box: any) => box.type === 'mdhd');
      const hdlr = mdia.boxes?.find((box: any) => box.type === 'hdlr');
      const minf = mdia.boxes?.find((box: any) => box.type === 'minf');

      if (!hdlr || !minf) continue;

      const handlerType = hdlr.handler_type;
      const stbl = minf.boxes?.find((box: any) => box.type === 'stbl');
      if (!stbl) continue;

      const stsd = stbl.boxes?.find((box: any) => box.type === 'stsd');
      if (!stsd || !stsd.entries || stsd.entries.length === 0) continue;

      const sampleEntry = stsd.entries[0];
      let codecDetail = sampleEntry.type;
      let esdsInfo: EsdsInfo | undefined;

      // Try to parse ESDS for more detailed codec information
      if (sampleEntry.esds && sampleEntry.esds.byteLength > 0) {
        esdsInfo = parseEsds(sampleEntry.esds);
        if (esdsInfo) {
          codecDetail += `.${esdsInfo.objectTypeIndication.toString(16).padStart(2, '0')}`;
        }
      }

      // Calculate track duration
      let trackDuration: number | undefined;
      if (mdhd && mdhd.duration && mdhd.timescale) {
        trackDuration = mdhd.duration / mdhd.timescale;
      }

      if (handlerType === 'vide') {
        // Video track
        const width = sampleEntry.width;
        const height = sampleEntry.height;

        videoStreams.push({
          id: tkhd.track_ID,
          codecDetail,
          codec: toVideoCodecType(codecDetail),
          width,
          height,
          durationInSeconds: trackDuration || durationInSeconds,
        });
      } else if (handlerType === 'soun') {
        // Audio track
        const channelCount = sampleEntry.channelcount;
        const sampleRate = sampleEntry.samplerate;
        const codec = toAudioCodecType(codecDetail);

        const audioStreamInfo = {
          id: tkhd.track_ID,
          codecDetail,
          codec,
          channelCount: channelCount ?? esdsInfo?.channels,
          sampleRate: sampleRate ?? esdsInfo?.sampleRate,
          durationInSeconds: trackDuration || durationInSeconds,
        };

        audioStreams.push(audioStreamInfo);
      }
    }

    return {
      parser: 'isoboxer',
      containerDetail: brands.join(', '),
      container,
      durationInSeconds,
      videoStreams,
      audioStreams,
    };
  }
}

function readMp4Length(data: Uint8Array, offset: number): { length: number; headerSize: number } {
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

interface EsdsInfo {
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

function readMp3Header(frameHeader: Uint8Array) {
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

function parseEsds(data: Uint8Array): EsdsInfo | undefined {
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
