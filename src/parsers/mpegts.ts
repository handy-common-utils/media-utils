import { parseADTSHeader } from '../codecs/aac';
import { readAscii, readUInt16BE, readUInt32BE, toHexString } from '../codecs/binary';
import { h264LevelString, h264ProfileName, parseSPS } from '../codecs/h264';
import { h265LevelString, h265ProfileName } from '../codecs/h265';
import { parseMP3Header } from '../codecs/mp3';
import {
  guessAudioHeaderInPES,
  parseAacHeaderInPES,
  parseAc3DescriptorTagBody,
  parseDtsDescriptorTagBody,
  parseEac3DescriptorTagBody,
  parseEsDescriptors,
  parseH264HeaderInPES,
  parseLanguageDescriptorTagBody,
  parseMp2OrMp3HeaderInPES,
  parseMpeg2VideoHeaderInPES,
  parseMpeg2VideoSequenceHeader,
} from '../codecs/mpegts';
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

interface StreamInfo {
  pid: number;
  type: 'video' | 'audio' | 'unknown';
  codec: AudioCodecType | VideoCodecType;
  buffer: Uint8Array;
  parsed: boolean;
  pesHandler?: PesPayloadHandler; // For audio streams during extraction
}

type StreamDetails = Omit<AudioStreamInfo | VideoStreamInfo, 'id' | 'durationInSeconds'> & {
  programNumber: number;
  pid: number;
  streamType: number;
  streamTypeCategory: 'video' | 'audio' | 'private' | 'other';
  /**
   * Whether at least one frame header in the PES payload has been parsed.
   * That also means the details of the codec is complete.
   */
  parsed: boolean;
  /**
   * All the data in PES including the start bytes 000001
   * It is always initialised to be an empty array.
   */
  pesBuffer: Uint8Array;
  /**
   * When the PES payload has an unknown length, we have to wait for the next PES start bytes to know the end of the payload.
   * This is the offset of the start of the unfinished PES payload in the PES buffer.
   */
  pesPayloadStartOffsetInPesBuffer: number | undefined;
  /**
   * Handler of PES payloads. Used for extracting audio frames from PES payloads.
   * It could be undefined when there's no need to extract stream data.
   */
  pesPayloadHandler?: PesPayloadHandler;
};

function convertStreamDetailsToStreamInfo<T extends AudioStreamInfo | VideoStreamInfo>(streamDetails: StreamDetails): T {
  const info = Object.assign({ id: streamDetails.pid }, streamDetails) as Partial<typeof streamDetails> & T;
  delete info.pid;
  delete info.streamType;
  delete info.streamTypeCategory;
  delete info.programNumber;
  delete info.parsed;
  delete info.pesBuffer;
  delete info.pesPayloadStartOffsetInPesBuffer;
  delete info.pesPayloadHandler;
  return info;
}

interface PmtDetails {
  pmtPid: number;
  programNumber: number;
  found: boolean;
}

export class MpegTsParser {
  private buffer: Uint8Array = new Uint8Array(0);
  private bufferOffset = 0;
  private reader: ReadableStreamDefaultReader<Uint8Array>;

  private allPmtDetails: Map<number, PmtDetails> = new Map();
  private allStreamDetails: Map<number, StreamDetails> = new Map();
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
  private tsPacketsProcessed = 0;

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
        await this.processTsPacket(packetData);
        this.tsPacketsProcessed++;

        this.bufferOffset = syncOffset + this.packetSize;
        this.bytesRead += this.packetSize;

        // Check if we have enough info
        // If we are extracting (onSamples is provided), we read until the end
        if (!this.onSamples && (this.isMetadataComplete() || this.bytesRead > this.MAX_SCAN_BYTES)) {
          break;
        }

        // There could be remaining PES payload of unknown size, we flush them out
        if (done && this.onSamples) {
          for (const streamDetails of this.allStreamDetails.values()) {
            await this.flushRemainingPESPayload(streamDetails, this.buffer.length);
          }
        }
      }
    } finally {
      this.reader.cancel().catch(() => {});
    }

    return {
      container: 'mpegts',
      containerDetail: 'mpegts',
      audioStreams: [...this.allStreamDetails.values()]
        .filter((s) => s.streamTypeCategory === 'audio')
        .map((s) => convertStreamDetailsToStreamInfo(s)),
      videoStreams: [...this.allStreamDetails.values()]
        .filter((s) => s.streamTypeCategory === 'video')
        .map((s) => convertStreamDetailsToStreamInfo(s)),
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

  private isMetadataComplete(): boolean {
    // Because there could be multiple PATs, we need to make sure we've given them chances to show up
    if (this.tsPacketsProcessed < 200) return false;

    // PAT should have been parsed and we should have PMT PIDs
    if (this.allPmtDetails.size === 0) return false;

    // All PMT should have been found
    for (const pmtDetails of this.allPmtDetails.values()) {
      if (!pmtDetails.found) return false;
    }

    // All audio/video streams should have been found
    for (const streamDetails of this.allStreamDetails.values()) {
      if ((streamDetails.streamTypeCategory === 'audio' || streamDetails.streamTypeCategory === 'video') && !streamDetails.parsed) return false;
    }

    return true;
  }

  /**
   * TS packet (188 bytes)
   *
   * -------------------------------------------------------------------------
   * | Sync Byte (8) | TEI (1) | PUSI (1) | T. Priority (1) | PID (13) | ...
   * -------------------------------------------------------------------------
   * ... | TSC (2) | AFC (2) | CC (4) | [Adaptation Field] | [Payload]
   * -------------------------------------------------------------------------
   * Sync Byte: 0x47
   * TEI: Transport Error Indicator
   * PUSI: Payload Unit Start Indicator (1 means payload starts with a section/PES header)
   * T. Priority: High priority packet if set
   * PID: Packet Identifier
   * TSC: Transport Scrambling Control
   * AFC: Adaptation Field Control (01: Payload only, 10: Adaptation only, 11: Both)
   * CC: Continuity Counter
   * @param data The 188-byte packet data
   */
  private async processTsPacket(data: Uint8Array) {
    // M2TS files have 4 bytes of timestamp before the 188-byte TS packet
    const tsPacketStart = this.packetSize === TS_PACKET_SIZE_192 ? 4 : 0;
    const tsPacket = data.subarray(tsPacketStart, tsPacketStart + TS_PACKET_SIZE_188);

    const header = readUInt32BE(tsPacket, 0);

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

    if (pid === PID_PAT && payloadUnitStartIndicator) {
      // Populating this.allPmtDetails
      this.parsePat(payload);
      return;
    }
    // } else if (pid === PID_SDT) {
    //   this.parseSdt(payload, payloadUnitStartIndicator);

    let pmtDetails = this.allPmtDetails.get(pid);
    if (payloadUnitStartIndicator && pmtDetails /* && pmtDetails.found === false */) {
      // Populating this.allStreamDetails with information available in this PMT.
      // There could be multiple PMTs needed for finding information about all streams.
      this.parsePmt(payload, pid);
      pmtDetails.found = true;
      return;
    }

    const streamDetails = this.allStreamDetails.get(pid);
    if (streamDetails && (streamDetails.parsed === false || this.onSamples)) {
      streamDetails.parsed = streamDetails.parsed || (await this.processStreamPacket(pid, payload, payloadUnitStartIndicator));
      return;
    }
  }

  private async flushRemainingPESPayload(streamDetails: StreamDetails, pesStart: number) {
    // Flush out any remaining PES payload
    if (streamDetails.pesPayloadHandler && streamDetails.pesPayloadStartOffsetInPesBuffer !== undefined) {
      await streamDetails.pesPayloadHandler.onData(streamDetails.pesBuffer.subarray(streamDetails.pesPayloadStartOffsetInPesBuffer, pesStart));
      streamDetails.pesPayloadStartOffsetInPesBuffer = undefined;
    }
  }

  /**
   * Process stream packet that contains PES/ES data.
   * Handles buffering, PES header parsing, and payload extraction.
   *
   * Since ES packets could span across multiple stream packets, we need to use a per-PID buffer and detect ES packet start.
   * ES packets may or may not have a known length, that means we may need to wait for the next ES packet start to determine the end of the current ES packet.
   * For audio streams, we need to facilitate the onSamples call back which is called when a complete ES packet is available.
   * An audio stream's ES packet payload contains multiple samples/frames.
   *
   * If PUSI is set, a PES header usually follows.
   * --------------------------------------------------------------------------
   * | Packet Start Code Prefix (24) | Stream ID (8) | PES Packet Length (16) |
   * --------------------------------------------------------------------------
   * | Optional PES Header ... | Elementary Stream Data ...
   * --------------------------------------------------------------------------
   * Packet Start Code Prefix: 0x000001
   * Stream ID: e.g. 0xE0-0xEF (Video), 0xC0-0xDF (Audio)
   * PES Packet Length: Length of the remaining packet (0 for unbounded video)
   *
   * @param pid Packet Identifier
   * @param payload The payload data
   * @param payloadUnitStartIndicator Whether this packet starts a new PES unit
   * @returns true if parsing is done, false if more data is needed
   */
  private async processStreamPacket(pid: number, payload: Uint8Array, payloadUnitStartIndicator: boolean): Promise<boolean> {
    const streamDetails = this.allStreamDetails.get(pid)!;
    const audioStreamDetails = streamDetails as Partial<AudioStreamInfo>;
    const videoStreamDetails = streamDetails as Partial<VideoStreamInfo>;

    // Append payload to buffer
    const newBuffer = new Uint8Array(streamDetails.pesBuffer.length + payload.length);
    newBuffer.set(streamDetails.pesBuffer);
    newBuffer.set(payload, streamDetails.pesBuffer.length);
    streamDetails.pesBuffer = newBuffer;

    // Wait for more data to be available next time
    if (streamDetails.pesBuffer.length < 9) return false;

    // When PUSI is not set, it is guaranteed that the full payload is a part of the previous PES packet.
    if (payloadUnitStartIndicator === false) {
      return false;
    }

    // Try to parse if we have enough data
    // We need to handle PES headers first
    // PES packet start code prefix: 0x000001
    // Stream ID: 1 byte
    // PES Packet Length: 2 bytes
    // Optional PES header...

    const checkAvailableData = ({
      pesLength,
      pesStart,
      onKnownLengthData,
    }: {
      pesLength: number;
      pesStart: number;
      onKnownLengthData?: (begin: number, end: number) => void;
    }) => {
      // Known length
      if (pesLength > 0) {
        const nextPesStart = pesStart + 6 + pesLength;
        // Data is complete
        if (nextPesStart < streamDetails.pesBuffer.length) {
          if (onKnownLengthData) onKnownLengthData(pesStart + 6, nextPesStart);
          return { shouldReturnNotContinue: false, nextIndex: nextPesStart - 1 };
        }
        // Wait for more data
        return { shouldReturnNotContinue: true };
      }

      // Unknown PES length → "keep searching"
      return { shouldReturnNotContinue: false, nextIndex: pesStart + 2 };
    };

    let parsedPESHeader = false;

    let pesStart = 0;
    for (let i = 0; i < streamDetails.pesBuffer.length - 3; i++) {
      if (streamDetails.pesBuffer[i] === 0x00 && streamDetails.pesBuffer[i + 1] === 0x00 && streamDetails.pesBuffer[i + 2] === 0x01) {
        if (streamDetails.pesBuffer.length < pesStart + 9) return false; // Need more data

        pesStart = i;
        const streamId = streamDetails.pesBuffer[pesStart + 3];
        const pesLength = readUInt16BE(streamDetails.pesBuffer, pesStart + 4);
        if (streamId >= 0xe0 && streamId <= 0xef) {
          // 0xE0–0xEF Video stream (MPEG-1/2/4, H.264/AVC, H.265/HEVC inside TS)
          if (streamDetails.pesBuffer.length < pesStart + 100) return false; // Need more data for parsing the header
          // try to parse the video header
          try {
            switch (streamDetails.codec) {
              case 'h264': {
                parseH264HeaderInPES(streamDetails.pesBuffer.subarray(pesStart + 6), videoStreamDetails);
                break;
              }
              case 'mpeg2video': {
                parseMpeg2VideoHeaderInPES(streamDetails.pesBuffer.subarray(pesStart + 6), videoStreamDetails);
                break;
              }
              default: {
                // Other codec, let's assume it is valid
                break;
              }
            }
          } catch {
            // could be caused by false positive PES start code, keep searching
            i += 2;
            continue;
          }

          // We believe a legit PES packet start is found
          parsedPESHeader = true;

          // Flush out any remaining PES payload
          await this.flushRemainingPESPayload(streamDetails, pesStart);

          const { shouldReturnNotContinue, nextIndex } = checkAvailableData({ pesLength, pesStart });
          if (shouldReturnNotContinue) return parsedPESHeader;
          i = nextIndex!;
          continue;
        } else if (streamId >= 0xc0 && streamId <= 0xdf) {
          // 0xC0–0xDF ISO/IEC 13818-3 audio streams (MPEG-1/2 Layer I/II/III), AAC, etc.
          if (streamDetails.pesBuffer.length < pesStart + 100) return false; // Need more data for parsing the header
          // try to parse the audio header
          try {
            if (streamDetails.streamTypeCategory === 'private') {
              // We need to guess, because ffmpeg uses 0x06 for aac and mp3 but with different packaging
              guessAudioHeaderInPES(streamDetails.pesBuffer.subarray(pesStart + 6), audioStreamDetails);
            } else {
              switch (streamDetails.codec) {
                case 'mp2':
                case 'mp3': {
                  parseMp2OrMp3HeaderInPES(streamDetails.pesBuffer.subarray(pesStart + 6), audioStreamDetails);
                  break;
                }
                case 'aac': {
                  parseAacHeaderInPES(streamDetails.pesBuffer.subarray(pesStart + 6), audioStreamDetails);
                  break;
                }
                default: {
                  // Other codec, let's assume it is valid
                  break;
                }
              }
            }
          } catch {
            // could be caused by false positive PES start code, keep searching
            i += 2;
            continue;
          }

          // Now we believe a legit PES packet start is found, and the codec information in streamDetails has been updated
          parsedPESHeader = true;

          if (this.onSamples && !streamDetails.pesPayloadHandler) {
            streamDetails.pesPayloadHandler = new PesPayloadHandler(audioStreamDetails.codec!, (frames) =>
              this.onSamples!(
                pid,
                frames.map((f) => f.data),
              ),
            );
          }

          // Flush out any remaining PES payload
          await this.flushRemainingPESPayload(streamDetails, pesStart);

          const { shouldReturnNotContinue, nextIndex } = checkAvailableData({
            pesLength,
            pesStart,
            onKnownLengthData: (start, end) => {
              streamDetails.pesPayloadHandler?.onData(streamDetails.pesBuffer.subarray(start, end));
            },
          });
          if (shouldReturnNotContinue) return parsedPESHeader;
          i = nextIndex!;
          continue;
        } else if (streamId === 0xbd) {
          // 0xBD Private Stream 1 (AC-3, DTS, DVB subtitles, teletext, etc.)
          if (streamDetails.pesBuffer.length < pesStart + 100) return false; // Need more data for parsing the header

          const { shouldReturnNotContinue, nextIndex } = checkAvailableData({ pesLength, pesStart });
          if (shouldReturnNotContinue) return parsedPESHeader;
          i = nextIndex!;
          continue;
        } else if (
          (streamId >= 0xbc && streamId <= 0xbf) ||
          streamId === 0xff ||
          (streamId >= 0xf0 && streamId <= 0xf2) ||
          (streamId >= 0xf8 && streamId <= 0xfe)
        ) {
          // BC, BE, BF, FF Special system streams
          // F0–F2, F8–FE Reserved

          const { shouldReturnNotContinue, nextIndex } = checkAvailableData({ pesLength, pesStart });
          if (shouldReturnNotContinue) return parsedPESHeader;
          i = nextIndex!;
          continue;
        } else {
          // Invalid stream ID, maybe the PES start is false positive
          // continue searching for next possible PES start code
          i += 2;
          continue;
        }
      }
    }

    // Discard already processed data  which could be valid data or garbage
    if (pesStart < streamDetails.pesBuffer.length) {
      streamDetails.pesBuffer = streamDetails.pesBuffer.slice(pesStart);
    }

    return parsedPESHeader;
  }

  /**
   * Program Association Table (PAT) - PID 0x0000, Table ID 0x00
   * Maps Program Numbers to PMT (Program Map Table) PIDs.
   * --------------------------------------------------------------------------------------
   * | Table ID (8) | ... | Section Length (12) | ... | Program Num (16) | PMT PID (13) ...
   * --------------------------------------------------------------------------------------
   * @param payload The payload data
   */
  private parsePat(payload: Uint8Array) {
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
      const pmtPid = ((payload[current + 2] & 0x1f) << 8) | payload[current + 3];

      if (
        programNumber !== 0 && // 0 is NIT
        !this.allPmtDetails.has(pmtPid)
      ) {
        this.allPmtDetails.set(pmtPid, { pmtPid, programNumber, found: false });
      }
      current += 4;
    }
  }

  /**
   * Program Map Table (PMT) - PID specified in PAT, Table ID 0x02
   * Maps Program Elements to Elementary Stream PIDs.
   * -------------------------------------------------------------------------------
   * | Table ID (8) | ... | Section Length (12) | ... | Stream Type (8) | ES PID (13) ...
   * -------------------------------------------------------------------------------
   * The PMT is the table that tells you:
   * - What streams exist inside a program
   * - The codec or stream type (via stream_type)
   * - Additional codec metadata appears in descriptors inside the PMT
   *
   * @param payload The payload data
   * @param pmtPid The PID of this PMT
   */
  private parsePmt(payload: Uint8Array, pmtPid: number) {
    let offset = 0;
    const pointerField = payload[offset];
    offset += 1 + pointerField;

    if (offset >= payload.length) return;

    // table_id                          8 bits (always 0x02)
    // section_syntax_indicator          1 bit (always 1)
    // '0'                               1 bit
    // reserved                          2 bits
    // section_length                    12 bits
    // program_number                    16 bits
    // reserved                          2 bits
    // version_number                    5 bits
    // current_next_indicator            1 bit
    // section_number                    8 bits
    // last_section_number               8 bits
    // reserved                          3 bits
    // PCR_PID                           13 bits
    // reserved                          4 bits
    // program_info_length               12 bits
    // program_info_descriptors...       program_info_length bytes

    const tableId = payload[offset];
    if (tableId !== TID_PMT) return;

    const sectionLength = ((payload[offset + 1] & 0x0f) << 8) | payload[offset + 2];

    const programNumber = readUInt16BE(payload, offset + 3);

    // Program info length is at offset + 10 (12 bits)
    const programInfoLength = ((payload[offset + 10] & 0x0f) << 8) | payload[offset + 11];

    let current = offset + 12 + programInfoLength;
    const end = offset + 3 + sectionLength - 4; // Exclude CRC

    while (current < end) {
      const elementaryPid = ((payload[current + 1] & 0x1f) << 8) | payload[current + 2];
      const esInfoLength = ((payload[current + 3] & 0x0f) << 8) | payload[current + 4];
      if (!this.allStreamDetails.has(elementaryPid)) {
        const streamType = payload[current];
        const descriptors = payload.subarray(current + 5, current + 5 + esInfoLength);

        const streamDetails: StreamDetails = {
          ...buildStreamDetails(streamType, descriptors),
          programNumber,
          pid: elementaryPid,
          pesBuffer: new Uint8Array(0),
        };
        this.allStreamDetails.set(elementaryPid, streamDetails);
      }
      current += 5 + esInfoLength;
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

// Stream Types Mapping
const STREAM_TYPE_MAP: Record<number, { type: 'video' | 'audio' | 'private' | 'other'; codec: AudioCodecType | VideoCodecType }> = {
  0x01: { type: 'video', codec: 'mpeg1video' }, // Not strictly in VideoCodecType but let's see
  0x02: { type: 'video', codec: 'mpeg2video' },
  0x03: { type: 'audio', codec: 'mp3' }, // MPEG-1 Audio (mp1/mp2/mp3 - need to parse to determine)
  0x04: { type: 'audio', codec: 'mp3' }, // MPEG-2 Audio (mp1/mp2/mp3 - need to parse to determine)
  0x0f: { type: 'audio', codec: 'aac' }, // Raw AAC, without ADTS, could be LATM or raw AUs
  0x11: { type: 'audio', codec: 'aac_latm' }, // LATM/LOAS AAC
  0x1b: { type: 'video', codec: 'h264' },
  0x24: { type: 'video', codec: 'hevc' },
  0x81: { type: 'audio', codec: 'ac3' }, // ATSC AC-3
  0x82: { type: 'audio', codec: 'dts' }, // SCTE DTS
  0x87: { type: 'audio', codec: 'eac3' }, // ATSC E-AC-3

  // But, ffmpeg uses this for its LATM muxed PES payload starting with AudioMuxConfig
  0x06: { type: 'private', codec: 'unknown' }, // Private Data, often AC-3 or E-AC-3 in DVB, requires descriptor check
};

/**
 * Build StreamDetails based on information found in PMT
 * @param streamType The stream type
 * @param descriptors The descriptors
 * @returns An StreamDetails object that is missing pid and programNumber properties
 */
export function buildStreamDetails(streamType: number, descriptors: Uint8Array): Omit<StreamDetails, 'programNumber' | 'pid'> {
  const streamTypeInfo = STREAM_TYPE_MAP[streamType];
  console.error('buildStreamDetails', streamType, streamTypeInfo);
  const info: Omit<StreamDetails, 'programNumber' | 'pid'> = {
    streamType,
    streamTypeCategory: streamTypeInfo?.type ?? 'other',
    codec: streamTypeInfo?.codec ?? 'unknown',
    parsed: false,
    pesBuffer: new Uint8Array(0),
    pesPayloadStartOffsetInPesBuffer: undefined,
    pesPayloadHandler: undefined,
  };
  parseEsDescriptors(descriptors, info);
  return info;
}
