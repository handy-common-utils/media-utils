import { parseADTSHeader } from '../codecs/aac';
import { parseSPS } from '../codecs/h264';
import { parseMP3Header } from '../codecs/mp3';
import { parseMpeg2VideoSequenceHeader } from '../codecs/mpeg2-video';
import { PesPayloadHandler } from '../codecs/pes';
import { GetMediaInfoOptions } from '../get-media-info';
import { AudioCodecType, AudioStreamInfo, MediaInfo, VideoCodecType, VideoStreamInfo } from '../media-info';
import { ensureBufferData, UnsupportedFormatError } from '../utils';

// Constants
const TS_PACKET_SIZE_188 = 188;
const TS_PACKET_SIZE_192 = 192; // M2TS format
const SYNC_BYTE = 0x47;

// PIDs
const PID_PAT = 0x0000;
const PID_SDT = 0x0011;

// Table IDs
const TID_PAT = 0x00;
const TID_PMT = 0x02;
const TID_SDT = 0x42;

// Stream Types Mapping
const STREAM_TYPE_MAP: Record<number, { type: 'video' | 'audio' | 'other'; codec: AudioCodecType | VideoCodecType }> = {
  0x01: { type: 'video', codec: 'mpeg1video' }, // Not strictly in VideoCodecType but let's see
  0x02: { type: 'video', codec: 'mpeg2video' },
  0x03: { type: 'audio', codec: 'mp3' }, // MPEG-1 Audio (mp1/mp2/mp3 - need to parse to determine)
  0x04: { type: 'audio', codec: 'mp3' }, // MPEG-2 Audio (mp1/mp2/mp3 - need to parse to determine)
  0x0f: { type: 'audio', codec: 'aac' }, // ADTS
  0x11: { type: 'audio', codec: 'aac_latm' }, // LATM
  0x1b: { type: 'video', codec: 'h264' },
  0x24: { type: 'video', codec: 'hevc' },
  0x81: { type: 'audio', codec: 'ac3' }, // ATSC AC-3
  0x82: { type: 'audio', codec: 'dts' }, // SCTE DTS
  0x87: { type: 'audio', codec: 'eac3' }, // ATSC E-AC-3
  // 0x06 is Private Data, often AC-3 or E-AC-3 in DVB, requires descriptor check
};

interface StreamInfo {
  pid: number;
  type: 'video' | 'audio' | 'unknown';
  codec: AudioCodecType | VideoCodecType;
  buffer: Uint8Array;
  parsed: boolean;
  pesHandler?: PesPayloadHandler; // For audio streams during extraction
}

// ...

export class MpegTsParser {
  private buffer: Uint8Array = new Uint8Array(0);
  private bufferOffset = 0;
  private reader: ReadableStreamDefaultReader<Uint8Array>;

  private patFound = false;
  private pmtPids: Set<number> = new Set();
  private processedPmtPids: Set<number> = new Set();
  private sdtFound = false;

  private audioStreams: AudioStreamInfo[] = [];
  private videoStreams: VideoStreamInfo[] = [];

  private streamInfoByPid: Map<number, StreamInfo> = new Map();

  private serviceName?: string;
  private providerName?: string;

  // Limit how much we scan to avoid reading the whole file
  private bytesRead = 0;
  private readonly MAX_SCAN_BYTES = 2 * 1024 * 1024; // 2MB
  private packetSize = 0; // Will be detected (188 or 192)

  constructor(
    stream: ReadableStream<Uint8Array>,
    private options?: GetMediaInfoOptions,
    private onSamples?: (streamId: number, samples: Uint8Array[]) => void,
  ) {
    this.reader = stream.getReader();
  }

  async parse(): Promise<Omit<MediaInfo, 'parser'>> {
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Ensure we have at least some data
        const minBufferSize = this.packetSize > 0 ? this.packetSize * 10 : 2000;
        const { buffer, bufferOffset, done } = await ensureBufferData(this.reader, this.buffer, this.bufferOffset, minBufferSize);
        this.buffer = buffer;
        this.bufferOffset = bufferOffset;

        // Detect packet size on first read by finding valid sync bytes
        if (this.packetSize === 0 && this.buffer.length >= 600) {
          const result = this.findValidSyncAndPacketSize();
          if (result) {
            this.packetSize = result.packetSize;
            this.bufferOffset = result.syncOffset;
          } else if (this.buffer.length >= 1000) {
            // Searched 1000 bytes without finding valid TS structure
            throw new UnsupportedFormatError('Not MPEG-TS: No valid sync pattern found');
          }
        }

        // Skip if we haven't detected packet size yet
        if (this.packetSize === 0) {
          if (done) {
            throw new UnsupportedFormatError('Not MPEG-TS: Cannot detect packet size (EOF)');
          }
          continue;
        }

        if (done && this.buffer.length - this.bufferOffset < this.packetSize) {
          break;
        }

        // Find next valid sync byte
        let syncOffset = this.bufferOffset;
        let foundValidSync = false;

        // For M2TS, the sync byte is at offset 4 within each packet
        const syncByteOffset = this.packetSize === TS_PACKET_SIZE_192 ? 4 : 0;

        while (syncOffset < this.buffer.length && !foundValidSync) {
          // Check if sync byte is at the expected position
          if (syncOffset + syncByteOffset < this.buffer.length && this.buffer[syncOffset + syncByteOffset] === SYNC_BYTE) {
            foundValidSync = true;
            break;
          }
          syncOffset++;
        }

        if (!foundValidSync || syncOffset + this.packetSize > this.buffer.length) {
          if (done) break;
          // Need more data
          this.bufferOffset = syncOffset;
          continue;
        }

        // Parse packet
        const packetData = this.buffer.subarray(syncOffset, syncOffset + this.packetSize);
        await this.processPacket(packetData);

        this.bufferOffset = syncOffset + this.packetSize;
        this.bytesRead += this.packetSize;

        // Check if we have enough info
        // If we are extracting (onSamples is provided), we read until the end
        if (!this.onSamples && (this.isMetadataComplete() || this.bytesRead > this.MAX_SCAN_BYTES)) {
          break;
        }
      }
    } finally {
      if (!this.onSamples) {
        this.reader.cancel().catch(() => {});
      }
    }

    if (this.videoStreams.length === 0 && this.audioStreams.length === 0) {
      throw new UnsupportedFormatError('No streams found in MPEG-TS');
    }

    return {
      container: 'mpegts',
      containerDetail: 'mpegts',
      audioStreams: this.audioStreams,
      videoStreams: this.videoStreams,
    };
  }

  private findValidSyncAndPacketSize(): { syncOffset: number; packetSize: number } | null {
    // Industry-standard algorithm: Search for 0x47 bytes and verify by checking
    // if they appear at regular intervals (188 or 192 bytes apart)
    const searchLimit = Math.min(this.buffer.length, 1000);
    const MIN_SYNC_CHECKS = 4; // Check at least 4 consecutive sync bytes

    for (let i = 0; i < searchLimit; i++) {
      if (this.buffer[i] !== SYNC_BYTE) {
        continue;
      }

      // Found a candidate 0x47, now check if it's part of a regular pattern
      // Try 188-byte spacing first (standard TS)
      if (this.verifySyncPattern(i, TS_PACKET_SIZE_188, MIN_SYNC_CHECKS)) {
        // Standard TS: sync byte is at the start of the packet
        return { syncOffset: i, packetSize: TS_PACKET_SIZE_188 };
      }

      // Try 192-byte spacing (M2TS/Blu-ray)
      if (this.verifySyncPattern(i, TS_PACKET_SIZE_192, MIN_SYNC_CHECKS)) {
        // M2TS: sync byte is at offset 4 within the packet
        // So the packet actually starts 4 bytes before the sync byte
        const packetStart = i >= 4 ? i - 4 : i;
        return { syncOffset: packetStart, packetSize: TS_PACKET_SIZE_192 };
      }
    }

    return null;
  }

  private verifySyncPattern(offset: number, packetSize: number, minChecks: number): boolean {
    // Verify that sync bytes appear at regular intervals
    for (let check = 1; check < minChecks; check++) {
      const nextSyncPos = offset + packetSize * check;
      if (nextSyncPos >= this.buffer.length) {
        // Not enough data to verify
        return false;
      }
      if (this.buffer[nextSyncPos] !== SYNC_BYTE) {
        // Pattern broken
        return false;
      }
    }
    return true;
  }

  private isValidTsPacket(offset: number): boolean {
    // Check if there's enough data for a minimal TS packet header
    if (offset + 4 > this.buffer.length) {
      return false;
    }

    // Sync byte must be 0x47
    if (this.buffer[offset] !== SYNC_BYTE) {
      return false;
    }

    // Read the header
    const byte1 = this.buffer[offset + 1];
    const byte2 = this.buffer[offset + 2];
    const byte3 = this.buffer[offset + 3];

    // Check transport error indicator (should typically be 0)
    const transportErrorIndicator = (byte1 & 0x80) !== 0;
    if (transportErrorIndicator) {
      return false; // Packets with errors are not valid for our purposes
    }

    // Extract PID (13 bits from byte1 and byte2)
    const pid = ((byte1 & 0x1f) << 8) | byte2;

    // PID should be valid (0x0000 to 0x1FFF)
    // Some PIDs are reserved and shouldn't appear in normal streams
    if (pid === 0x1fff) {
      return false; // Null packets
    }

    // Check adaptation field control (2 bits in byte3)
    const adaptationFieldControl = (byte3 & 0x30) >> 4;

    // Valid values are: 01 (payload only), 10 (adaptation only), 11 (both)
    // 00 is reserved and invalid
    if (adaptationFieldControl === 0x00) {
      return false;
    }

    // If adaptation field is present, verify its length is reasonable
    if ((adaptationFieldControl & 0x02) !== 0 && offset + 4 < this.buffer.length) {
      const adaptationLength = this.buffer[offset + 4];
      // Adaptation length should not exceed packet size
      if (adaptationLength > 183) {
        return false;
      }
    }

    return true;
  }

  private isMetadataComplete(): boolean {
    // We need PAT, and if we have PMT PIDs, we need to have processed them.
    // SDT is optional but good to have.
    if (!this.patFound) return false;
    if (this.pmtPids.size > 0 && this.processedPmtPids.size < this.pmtPids.size) return false;

    // Check if we have parsed headers for all streams we are tracking
    for (const stream of this.streamInfoByPid.values()) {
      if (!stream.parsed) return false;
    }

    // We can stop if we have streams, even if SDT is missing, to save time.
    // But let's try to get SDT if it's close.
    return true;
  }

  private async processPacket(data: Uint8Array) {
    // M2TS files have 4 bytes of timestamp before the 188-byte TS packet
    const tsPacketStart = this.packetSize === TS_PACKET_SIZE_192 ? 4 : 0;
    const tsPacket = data.subarray(tsPacketStart, tsPacketStart + TS_PACKET_SIZE_188);

    const view = new DataView(tsPacket.buffer, tsPacket.byteOffset, tsPacket.byteLength);
    const header = view.getUint32(0);

    // Sync byte check (already done but good for sanity)
    const syncByte = header >>> 24;
    if (syncByte !== SYNC_BYTE) {
      return;
    }

    const transportErrorIndicator = (header & 0x800000) !== 0;
    if (transportErrorIndicator) return;

    const payloadUnitStartIndicator = (header & 0x400000) !== 0;
    const pid = (header & 0x1fff00) >>> 8;
    const adaptationFieldControl = (header & 0x000030) >>> 4;

    // 01 = payload only, 10 = adaptation only, 11 = adaptation + payload
    const hasPayload = (adaptationFieldControl & 0x01) !== 0;
    const hasAdaptation = (adaptationFieldControl & 0x02) !== 0;

    if (!hasPayload) return;

    let payloadOffset = 4;
    if (hasAdaptation) {
      const adaptationLength = tsPacket[4];
      payloadOffset += 1 + adaptationLength;
    }

    if (payloadOffset >= TS_PACKET_SIZE_188) return;

    const payload = tsPacket.subarray(payloadOffset);

    if (pid === PID_PAT) {
      this.parsePat(payload, payloadUnitStartIndicator);
    } else if (pid === PID_SDT) {
      this.parseSdt(payload, payloadUnitStartIndicator);
    } else if (this.pmtPids.has(pid)) {
      this.parsePmt(payload, payloadUnitStartIndicator, pid);
    } else if (this.streamInfoByPid.has(pid)) {
      await this.processStreamPacket(pid, payload, payloadUnitStartIndicator);
    }
  }

  private async processStreamPacket(pid: number, payload: Uint8Array, _payloadUnitStartIndicator: boolean) {
    const stream = this.streamInfoByPid.get(pid);
    if (!stream) return;
    if (stream.parsed && !this.onSamples) return;

    // Append payload to buffer
    const newBuffer = new Uint8Array(stream.buffer.length + payload.length);
    newBuffer.set(stream.buffer);
    newBuffer.set(payload, stream.buffer.length);
    stream.buffer = newBuffer;

    // Try to parse if we have enough data
    // We need to handle PES headers first
    // PES packet start code prefix: 0x000001
    // Stream ID: 1 byte
    // PES Packet Length: 2 bytes
    // Optional PES header...

    // Find PES start code
    let pesOffset = -1;
    for (let i = 0; i < stream.buffer.length - 3; i++) {
      if (stream.buffer[i] === 0x00 && stream.buffer[i + 1] === 0x00 && stream.buffer[i + 2] === 0x01) {
        pesOffset = i;
        break;
      }
    }

    if (pesOffset === -1) {
      // Keep only last 3 bytes to handle split start code
      if (stream.buffer.length > 3) {
        stream.buffer = stream.buffer.slice(-3);
      }
      return;
    }

    // We have a PES start code.
    // Skip PES header to get to ES data.
    // PES header length is variable.
    // 00 00 01 [StreamID] [PacketLength(2)]
    // If StreamID is not specific (program_stream_map, padding_stream, etc.), parsing is different.
    // Assuming audio/video streams:
    // [10: flags] [11: flags] [12: header_data_length]
    // ES data starts at 9 + header_data_length (if we count from 00 00 01 as offset 0)
    // Actually:
    // 0: 00
    // 1: 00
    // 2: 01
    // 3: StreamID
    // 4-5: Packet Length
    // 6: '10' (2 bits) ...
    // 7: ...
    // 8: PES_header_data_length
    // 9...: PES header data
    // 9 + PES_header_data_length: ES Data

    const headerStart = pesOffset;
    if (stream.buffer.length < headerStart + 9) return; // Need more data

    // Check Stream ID to ensure it has PES header extensions
    const streamId = stream.buffer[headerStart + 3];
    // These stream IDs do NOT have the extension:
    // program_stream_map, private_stream_2, ECM, EMM, program_stream_directory, DSMCC, H.222.1 type E
    // padding_stream
    if (
      streamId !== 0xbc && // program_stream_map
      streamId !== 0xbf && // private_stream_2
      streamId !== 0xf0 && // ECM
      streamId !== 0xf1 && // EMM
      streamId !== 0xff && // program_stream_directory
      streamId !== 0xf2 && // DSMCC
      streamId !== 0xf8 // H.222.1 type E
    ) {
      const pesHeaderDataLength = stream.buffer[headerStart + 8];
      const esDataStart = headerStart + 9 + pesHeaderDataLength;

      if (stream.buffer.length < esDataStart + 16) return; // Need some ES data

      const esData = stream.buffer.subarray(esDataStart);

      // Sniff codec if unknown
      // if (stream.codec === 'unknown') {
      //   this.sniffCodec(pid, esData);
      //   // If sniffed, it will update stream.codec and we can continue
      //   if (stream.codec === 'unknown') {
      //     // Still unknown, maybe need more data or it's just not supported
      //     // If we have a lot of data and still unknown, give up
      //     if (esData.length > 4096) {
      //       stream.parsed = true;
      //     }
      //     return;
      //   }
      // }

      switch (stream.codec) {
        case 'mp2':
        case 'mp3': {
          if (!stream.parsed) {
            this.parseMp2Header(pid, esData);
          }
          if (this.onSamples && !stream.pesHandler) {
            // Lazy init pesHandler for sniffed streams
            stream.pesHandler = new PesPayloadHandler(stream.codec as any, (frames) =>
              this.onSamples!(
                pid,
                frames.map((f) => f.data),
              ),
            );
          }
          await stream.pesHandler?.onData(esData);
          break;
        }
        case 'mpeg2video': {
          this.parseMpeg2VideoHeader(pid, esData);
          break;
        }
        case 'h264': {
          this.parseH264Header(pid, esData);
          break;
        }
        case 'aac': {
          if (!stream.parsed) {
            this.parseAacHeader(pid, esData);
          }
          if (this.onSamples && !stream.pesHandler) {
            stream.pesHandler = new PesPayloadHandler('aac', (frames) =>
              this.onSamples!(
                pid,
                frames.map((f) => f.data),
              ),
            );
          }
          await stream.pesHandler?.onData(esData);
          break;
        }
        default: {
          // For other codecs, we might mark as parsed to stop buffering
          stream.parsed = true;
          break;
        }
      }
    } else {
      // Stream ID without extension, payload follows immediately after length (offset 6)
      // But usually audio/video streams have extensions.
      stream.parsed = true;
    }
  }

  private sniffCodec(pid: number, data: Uint8Array) {
    const stream = this.streamInfoByPid.get(pid);
    if (!stream) return;

    // Try to detect AAC (FFF)
    // ADTS header: Sync (12 bits) + ID (1 bit) + Layer (2 bits) + Protection (1 bit)
    // Layer must be 00 for AAC
    for (let i = 0; i < Math.min(data.length - 2, 1024); i++) {
      if (data[i] === 0xff && (data[i + 1] & 0xf6) === 0xf0) {
        stream.codec = 'aac';
        stream.type = 'audio';
        this.addAudioStream(pid, 'aac');
        return;
      }
    }

    // Try to detect MP3 (FFE/FFF)
    try {
      for (let i = 0; i < Math.min(data.length - 4, 1024); i++) {
        if (data[i] === 0xff && (data[i + 1] & 0xe0) === 0xe0) {
          const header = data.subarray(i, i + 4);
          const layer = (header[1] >> 1) & 0x03;
          if (layer !== 0) {
            try {
              const info = parseMP3Header(header);
              stream.codec = info.codec;
              stream.type = 'audio';
              this.addAudioStream(pid, info.codec);
              return;
            } catch {
              // Not MP3
            }
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  private addAudioStream(pid: number, codec: string) {
    if (!this.audioStreams.some((s) => s.id === pid)) {
      this.audioStreams.push({
        id: pid,
        codec: codec as any,
        codecDetail: codec,
      });
    }
  }

  private parseMp2Header(pid: number, data: Uint8Array) {
    try {
      // Look for frame sync (0xFFF)
      // Note: MP2/MP3 frame header is 4 bytes.
      // We scan a bit to find it.
      for (let i = 0; i < Math.min(data.length - 4, 2048); i++) {
        if (data[i] === 0xff && (data[i + 1] & 0xe0) === 0xe0) {
          // 111xxxxx
          const header = data.subarray(i, i + 4);
          const info = parseMP3Header(header); // Reusing MP3 parser which handles Layer I/II/III

          // Update audio stream info
          const stream = this.audioStreams.find((s) => s.id === pid);
          if (stream) {
            Object.assign(stream, info);
          } else {
            this.audioStreams.push({ ...info, id: pid });
          }

          const streamData = this.streamInfoByPid.get(pid);
          if (streamData) {
            streamData.parsed = true;
            // Update codec in streamData
            streamData.codec = info.codec;

            // Create PES handler now that we know the actual codec
            if (this.onSamples && !streamData.pesHandler) {
              console.error('Setting PesPayloadHandler from parseMp2Header', streamData.pid);
              streamData.pesHandler = new PesPayloadHandler(info.codec, (frames) =>
                this.onSamples!(
                  pid,
                  frames.map((f) => f.data),
                ),
              );
            }
          }
          return;
        }
      }
    } catch {
      // Ignore errors, maybe not enough data or false sync
    }
  }

  private parseMpeg2VideoHeader(pid: number, data: Uint8Array) {
    try {
      // Look for Sequence Header (0x000001B3)
      for (let i = 0; i < Math.min(data.length - 12, 2048); i++) {
        if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01 && data[i + 3] === 0xb3) {
          const info = parseMpeg2VideoSequenceHeader(data.subarray(i));

          const stream = this.videoStreams.find((s) => s.id === pid);
          if (stream) {
            if (info.width) stream.width = info.width;
            if (info.height) stream.height = info.height;
            if (info.fps) stream.fps = info.fps;
          }

          const streamData = this.streamInfoByPid.get(pid);
          if (streamData) streamData.parsed = true;
          return;
        }
      }
    } catch {
      // Ignore
    }
  }

  private parseH264Header(pid: number, data: Uint8Array) {
    try {
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
            const nalType = data[nalStart] & 0x1f;
            if (nalType === 7) {
              // SPS
              // Found SPS, parse it
              // We need to pass the data starting from nalStart + 1 (after header)
              // But parseSPS expects the RBSP (Raw Byte Sequence Payload) which is handled inside it?
              // No, parseSPS in h264.ts takes the NAL unit payload (after header byte)
              const spsData = data.subarray(nalStart + 1);
              const info = parseSPS(spsData);

              const stream = this.videoStreams.find((s) => s.id === pid);
              if (stream) {
                if (info.width) stream.width = info.width;
                if (info.height) stream.height = info.height;
                if (info.codecDetail) stream.codecDetail = info.codecDetail;
              }

              const streamData = this.streamInfoByPid.get(pid);
              if (streamData) streamData.parsed = true;
              return;
            }
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  private parseAacHeader(pid: number, data: Uint8Array) {
    try {
      // Look for ADTS sync word (0xFFF)
      for (let i = 0; i < Math.min(data.length - 7, 2048); i++) {
        if (data[i] === 0xff && (data[i + 1] & 0xf0) === 0xf0) {
          const info = parseADTSHeader(data.subarray(i));

          const stream = this.audioStreams.find((s) => s.id === pid);
          if (stream) {
            if (info.sampleRate) stream.sampleRate = info.sampleRate;
            if (info.channelCount) stream.channelCount = info.channelCount;
            if (info.codecDetail) stream.codecDetail = info.codecDetail;
          }

          const streamData = this.streamInfoByPid.get(pid);
          if (streamData) streamData.parsed = true;
          return;
        }
      }
    } catch {
      // Ignore
    }
  }

  private parsePat(payload: Uint8Array, payloadUnitStartIndicator: boolean) {
    if (!payloadUnitStartIndicator) return; // Only handle start of section for simplicity

    let offset = 0;
    const pointerField = payload[offset];
    offset += 1 + pointerField; // Skip pointer field

    if (offset >= payload.length) return;

    const tableId = payload[offset];
    if (tableId !== TID_PAT) return;

    // Section length
    const sectionLength = ((payload[offset + 1] & 0x0f) << 8) | payload[offset + 2];
    // Transport Stream ID (2 bytes)
    // Version number (5 bits), Current/Next indicator (1 bit)
    // Section number (1 byte)
    // Last section number (1 byte)

    // Program loop starts at offset + 8
    let current = offset + 8;
    // CRC32 is last 4 bytes, so loop until end of section - 4
    const end = offset + 3 + sectionLength - 4;

    while (current < end) {
      const programNumber = (payload[current] << 8) | payload[current + 1];
      const pid = ((payload[current + 2] & 0x1f) << 8) | payload[current + 3];

      if (programNumber !== 0) {
        // 0 is NIT
        this.pmtPids.add(pid);
      }
      current += 4;
    }
    this.patFound = true;
  }

  private parsePmt(payload: Uint8Array, payloadUnitStartIndicator: boolean, pid: number) {
    if (!payloadUnitStartIndicator) return;

    let offset = 0;
    const pointerField = payload[offset];
    offset += 1 + pointerField;

    if (offset >= payload.length) return;

    const tableId = payload[offset];
    if (tableId !== TID_PMT) return;

    const sectionLength = ((payload[offset + 1] & 0x0f) << 8) | payload[offset + 2];

    // Program info length is at offset + 10 (12 bits)
    const programInfoLength = ((payload[offset + 10] & 0x0f) << 8) | payload[offset + 11];

    let current = offset + 12 + programInfoLength;
    const end = offset + 3 + sectionLength - 4; // Exclude CRC

    while (current < end) {
      const streamType = payload[current];
      const elementaryPid = ((payload[current + 1] & 0x1f) << 8) | payload[current + 2];
      const esInfoLength = ((payload[current + 3] & 0x0f) << 8) | payload[current + 4];

      const descriptors = payload.subarray(current + 5, current + 5 + esInfoLength);

      if (!this.streamInfoByPid.has(elementaryPid)) {
        this.addStream(streamType, elementaryPid, descriptors);
      }

      current += 5 + esInfoLength;
    }
    this.processedPmtPids.add(pid);
  }

  private addStream(streamType: number, pid: number, descriptors: Uint8Array) {
    let codecInfo = STREAM_TYPE_MAP[streamType];

    if (!codecInfo && streamType === 0x06) {
      // Private data, check descriptors for AC-3 / E-AC-3
      if (this.hasDescriptor(descriptors, 0x6a)) {
        // AC-3 descriptor
        codecInfo = { type: 'audio', codec: 'ac3' };
      } else if (this.hasDescriptor(descriptors, 0x7a)) {
        // Enhanced AC-3 descriptor
        codecInfo = { type: 'audio', codec: 'eac3' };
      } else if (this.hasDescriptor(descriptors, 0x7c)) {
        // AAC descriptor
        codecInfo = { type: 'audio', codec: 'aac' };
      }
    }

    if (codecInfo?.type === 'video') {
      // Check if we already have this stream
      if (!this.videoStreams.some((s) => s.id === pid)) {
        this.videoStreams.push({
          id: pid,
          codec: codecInfo.codec as any,
          codecDetail: codecInfo.codec,
          width: 0, // Not easily available without parsing ES
          height: 0,
          // duration is hard to get
        });

        if (codecInfo.codec === 'mpeg2video' || codecInfo.codec === 'h264') {
          this.streamInfoByPid.set(pid, { pid, type: 'video', codec: codecInfo.codec, buffer: new Uint8Array(0), parsed: false });
        }
      }
    } else if (codecInfo?.type === 'audio') {
      if (!this.audioStreams.some((s) => s.id === pid)) {
        this.audioStreams.push({
          id: pid,
          codec: codecInfo.codec as AudioCodecType,
          codecDetail: codecInfo.codec,
          // sampleRate, channels etc from descriptors if available
        });

        // For unknown codec (MPEG audio), we'll determine mp2/mp3 later in parseMp2Header
        // For now, just set up the stream data for buffering
        if (codecInfo.codec === 'mp2' || codecInfo.codec === 'mp3' || codecInfo.codec === 'aac') {
          this.streamInfoByPid.set(pid, {
            pid,
            type: 'audio',
            codec: codecInfo.codec, // mp2 could be mistaken as mp3 now, but will be corrected later when the audio frame is parsed
            buffer: new Uint8Array(0),
            parsed: false,
            pesHandler: this.onSamples
              ? new PesPayloadHandler(codecInfo.codec, (frames) =>
                  this.onSamples!(
                    pid,
                    frames.map((f) => f.data),
                  ),
                )
              : undefined,
          });
        }
      }
    } else if (!codecInfo && streamType === 0x06 && !this.streamInfoByPid.has(pid)) {
      // Unknown private data, try to sniff
      this.streamInfoByPid.set(pid, { pid, type: 'unknown', codec: 'unknown', buffer: new Uint8Array(0), parsed: false });
    }
  }

  private hasDescriptor(descriptors: Uint8Array, tag: number): boolean {
    let i = 0;
    while (i < descriptors.length) {
      const descTag = descriptors[i];
      const descLen = descriptors[i + 1];
      if (descTag === tag) return true;
      i += 2 + descLen;
    }
    return false;
  }

  private parseSdt(payload: Uint8Array, payloadUnitStartIndicator: boolean) {
    if (!payloadUnitStartIndicator) return;

    let offset = 0;
    const pointerField = payload[offset];
    offset += 1 + pointerField;

    if (offset >= payload.length) return;

    const tableId = payload[offset];
    if (tableId !== TID_SDT) return; // Actual SDT

    const sectionLength = ((payload[offset + 1] & 0x0f) << 8) | payload[offset + 2];

    let current = offset + 11; // After original_network_id (2) + reserved (1)
    const end = offset + 3 + sectionLength - 4;

    while (current < end) {
      // const serviceId = (payload[current] << 8) | payload[current + 1];
      const descriptorsLoopLength = ((payload[current + 3] & 0x0f) << 8) | payload[current + 4];

      const descriptors = payload.subarray(current + 5, current + 5 + descriptorsLoopLength);
      this.parseSdtDescriptors(descriptors);

      current += 5 + descriptorsLoopLength;
    }
    this.sdtFound = true;
  }

  private parseSdtDescriptors(descriptors: Uint8Array) {
    let i = 0;
    while (i < descriptors.length) {
      const tag = descriptors[i];
      const len = descriptors[i + 1];

      if (tag === 0x48) {
        // Service Descriptor
        // const serviceType = descriptors[i + 2];
        const providerNameLen = descriptors[i + 3];
        const providerName = new TextDecoder().decode(descriptors.subarray(i + 4, i + 4 + providerNameLen));
        const serviceNameLen = descriptors[i + 4 + providerNameLen];
        const serviceName = new TextDecoder().decode(descriptors.subarray(i + 5 + providerNameLen, i + 5 + providerNameLen + serviceNameLen));

        this.serviceName = serviceName;
        this.providerName = providerName;
      }

      i += 2 + len;
    }
  }
}

/**
 * Parse MPEG-TS stream to extract media information.
 * @param stream The input stream
 * @param options Options for parsing
 * @param onSamples Callback for extracted samples (not fully implemented yet)
 * @returns Media information
 */
export async function parseMpegTs(
  stream: ReadableStream<Uint8Array>,
  options?: GetMediaInfoOptions,
  onSamples?: (streamId: number, samples: Uint8Array[]) => void,
): Promise<MediaInfo> {
  const parser = new MpegTsParser(stream, options, onSamples);
  const info = await parser.parse();
  return { ...info, parser: 'media-utils' };
}
