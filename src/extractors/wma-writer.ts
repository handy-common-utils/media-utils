import { AsfGuid, writeObjectHeader } from '../codecs/asf';
import { writeUInt16LE, writeUInt32LE, writeUInt64LE } from '../codecs/binary';
import { PayloadMetadata } from '../parsers/asf';

export interface AudioContent {
  /** E.g., 0x0161 for WMA Standard, 0x0162 for WMA Pro */
  codecId: number;
  /** Number of channels (e.g., 2) */
  channels: number;
  /** Sample rate (e.g., 44100) */
  sampleRate: number;
  /** Audio bit rate in bits per second (e.g., 128000) */
  bitrate: number;
  /** Block Align (nBlockAlign) in bytes */
  blockSize: number;
  /** Codec-specific data for the Stream Properties Object */
  encoderSpecificData: Uint8Array;
  /** Duration of a single audio object/frame in 100-nanosecond units (hns) */
  objectDuration: number;
  /** Bits per sample (e.g., 16) */
  bitsPerSample: number;
  /** Average bytes per second */
  avgBytesPerSec: number;
  /** Play duration from source in 100-nanosecond units */
  playDuration: number;
  /** Send duration from source in 100-nanosecond units */
  sendDuration: number;
  /** Preroll from source in milliseconds */
  preroll: number;
  /** Packet size from source (min and max must be equal) */
  packetSize: number;
  /** Max bitrate from source */
  maxBitrate: number;
  /** Raw Extended Stream Properties Object from source */
  extendedStreamPropertiesObject: Uint8Array;
  /** Stream number from source */
  streamNumber: number;
  /** Maximum payload size in bytes (for error correction) */
  maxPayloadSize: number;
  /**
   * All the payloads extracted from the original ASF file
   */
  allPayloads: Array<PayloadDetails>;
}

type AudioMetadata = Omit<AudioContent, 'allPayloads'>;

export interface PayloadDetails {
  streamNumber: number;
  payloadData: Uint8Array;
  metadata: PayloadMetadata;
  replicatedData: Uint8Array;
}

/**
 * Write WMA audio content to a writer.
 * This function does not close or cancel the writer after the content is written.
 * @param writer Writer to write the WMA audio content to.
 * @param content Audio content to write
 * @param onProgress Optional callback for progress reporting (0-100).
 */
export async function writeWma(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  content: AudioContent,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const { allPayloads: _, ...metadata } = content;

  // Progress range: 0% - 100%
  // Allocation:
  // - buildDataObject: 40% (0 -> 40)
  // - buildHeaderObject: 10% (40 -> 50)
  // - write headerObjectBuffer: 10% (50 -> 60)
  // - write dataObjectBuffer: 40% (60 -> 100)

  const { dataObjectBuffer, totalDataPackets } = buildDataObject(
    content,
    onProgress
      ? (progress) => {
          // Map 0-100 to 0-40
          onProgress(Math.round(progress * 0.4));
        }
      : undefined,
  );

  const headerObjectBuffer = buildHeaderObject({ ...metadata, dataObjectSize: dataObjectBuffer.length, totalDataPackets });

  if (onProgress) onProgress(50);

  await writer.write(headerObjectBuffer);
  if (onProgress) onProgress(60);

  await writer.write(dataObjectBuffer);
  if (onProgress) onProgress(100);
}

/**
 * Creates the ASF File Properties Object.
 * @param metadata Audio metadata to use for the File Properties Object.
 * @returns The File Properties Object as a Uint8Array.
 */
function buildFilePropertiesObject(metadata: AudioMetadata & { totalDataPackets: number }): Uint8Array {
  // 3.2 File Properties Object (mandatory, one only)
  // +--------------------------+------------+------------+
  // | Field name               | Field type | Size (bits)|
  // +--------------------------+------------+------------+
  // | Object ID                | GUID       | 128        |
  // | Object Size              | QWORD      | 64         |
  // | File ID                  | GUID       | 128        |
  // | File Size                | QWORD      | 64         |
  // | Creation Date            | QWORD      | 64         |
  // | Data Packets Count       | QWORD      | 64         |
  // | Play Duration            | QWORD      | 64         |
  // | Send Duration            | QWORD      | 64         |
  // | Preroll                  | QWORD      | 64         |
  // | Flags                    | DWORD      | 32         |
  // |   - Broadcast Flag       |            | 1 (LSB)    |
  // |   - Seekable Flag        |            | 1          |
  // |   - Reserved             |            | 30         |
  // | Minimum Data Packet Size | DWORD      | 32         |
  // | Maximum Data Packet Size | DWORD      | 32         |
  // | Maximum Bitrate          | DWORD      | 32         |
  // +--------------------------+------------+------------+

  const OBJECT_SIZE = 24 + 80; // Header (24) + Body (80)
  const buf = new Uint8Array(OBJECT_SIZE);
  let offset = 0;

  offset += writeObjectHeader(buf, offset, AsfGuid.FILE_PROPERTIES, OBJECT_SIZE);

  // File ID (GUID) - All zeros for MMS ID
  const FILE_ID = new Uint8Array(16); // All zeros
  buf.set(FILE_ID, offset);
  offset += 16;

  // File Size (QWORD) - Total file size = Header Object Size + Data Object Size (will be back-patched)
  offset += writeUInt64LE(buf, offset, 0); // Placeholder: will be filled in finish() logic

  // Creation Date (QWORD) - The value is given as the number of 100-nanosecond intervals since January 1, 1601,
  // according to Coordinated Universal Time (Greenwich Mean Time).
  // The value of this field may be invalid if the Broadcast Flag bit in the Flags field is set to 1.
  buf.set([0x00, 0x80, 0x3e, 0xd5, 0xde, 0xb1, 0x9d, 0x01], offset); // Epoch
  offset += 8;

  // Data Packets Count (QWORD)
  offset += writeUInt64LE(buf, offset, metadata.totalDataPackets);

  // Play Duration (QWORD) - Use from source
  offset += writeUInt64LE(buf, offset, metadata.playDuration);

  // Send Duration (QWORD) - Use from source
  offset += writeUInt64LE(buf, offset, metadata.sendDuration);

  // Preroll (QWORD) - Use from source if available, otherwise 0
  offset += writeUInt64LE(buf, offset, metadata.preroll);

  // Flags (DWORD) - 0x00000002 (Broadcast Flag = 0, Seekable Flag = 1)
  offset += writeUInt32LE(buf, offset, 0x00000002);

  // Minimum/Maximum Data Packet Size (DWORD) - Use packet size from source
  offset += writeUInt32LE(buf, offset, metadata.packetSize); // Minimum
  offset += writeUInt32LE(buf, offset, metadata.packetSize); // Maximum

  // Maximum Bitrate (DWORD) - Use from source if available
  offset += writeUInt32LE(buf, offset, metadata.maxBitrate);

  return buf;
}

/**
 * Creates the ASF Stream Properties Object for the WMA stream.
 * @param metadata Audio metadata to use for the Stream Properties Object.
 * @returns The Stream Properties Object as a Uint8Array.
 */
function buildStreamPropertiesObject(metadata: AudioMetadata): Uint8Array {
  // 3.3 Stream Properties Object (mandatory, one per stream)
  // +---------------------------------+------------+------------+
  // | Field Name                      | Field Type | Size (bits)|
  // +---------------------------------+------------+------------+
  // | Object ID                       | GUID       | 128        |
  // | Object Size                     | QWORD      | 64         |
  // | Stream Type                     | GUID       | 128        |
  // | Error Correction Type           | GUID       | 128        |
  // | Time Offset                     | QWORD      | 64         |
  // | Type-Specific Data Length       | DWORD      | 32         |
  // | Error Correction Data Length    | DWORD      | 32         |
  // | Flags                           | WORD       | 16         |
  // |   - Stream Number               |            | 7 (LSB)    |
  // |   - Reserved                    |            | 8          |
  // |   - Encrypted Content Flag      |            | 1          |
  // | Reserved                        | DWORD      | 32         |
  // | Type-Specific Data              | BYTE       | varies     |
  // | Error Correction Data           | BYTE       | varies     |
  // +---------------------------------+------------+------------+

  // Type-Specific Data size: WAVEFORMATEX (18 bytes + extra data)
  const WAVEFORMATEX_SIZE = 18 + metadata.encoderSpecificData.length;

  // Error Correction Data: Audio Spread
  // Span (1 byte) + Virtual Packet Length (2 bytes) + Virtual Chunk Length (2 bytes) +
  // Silence Data Length (2 bytes) + Silence Data (Block Alignment bytes)
  const SILENCE_DATA_LENGTH = metadata.blockSize; // Use Block Alignment for silence data
  const ERROR_CORRECTION_DATA_SIZE = 1 + 2 + 2 + 2 + SILENCE_DATA_LENGTH;

  // Object size: Header (24) + Body before Type-Specific (54) + WAVEFORMATEX + Error Correction Data
  const OBJECT_SIZE = 24 + 54 + WAVEFORMATEX_SIZE + ERROR_CORRECTION_DATA_SIZE;
  const buf = new Uint8Array(OBJECT_SIZE);
  let offset = 0;

  offset += writeObjectHeader(buf, offset, AsfGuid.STREAM_PROPERTIES, OBJECT_SIZE);

  // Stream Type GUID (16 bytes)
  buf.set(AsfGuid.AUDIO_STREAM, offset);
  offset += 16;

  // Error Correction Type GUID (16 bytes) - Audio Spread for WMA
  buf.set(AsfGuid.AUDIO_SPREAD, offset);
  offset += 16;

  // Time Offset (QWORD)
  offset += writeUInt64LE(buf, offset, 0);

  // Type-Specific Data Length (DWORD) - Size of WAVEFORMATEX structure
  offset += writeUInt32LE(buf, offset, WAVEFORMATEX_SIZE);

  // Error Correction Data Length (DWORD) - Size of Audio Spread error correction data
  offset += writeUInt32LE(buf, offset, ERROR_CORRECTION_DATA_SIZE);

  // Flags (WORD) - bits 0-6 contain stream number, bit 15 = encrypted flag
  offset += writeUInt16LE(buf, offset, metadata.streamNumber);

  // Reserved (DWORD)
  offset += writeUInt32LE(buf, offset, 0x00000000);

  // --- Type-Specific Data (WAVEFORMATEX structure for WMA) starts at offset 78 ---

  // WMA Codec ID (WORD) - formatTag
  offset += writeUInt16LE(buf, offset, metadata.codecId);

  // Number of Channels (WORD)
  offset += writeUInt16LE(buf, offset, metadata.channels);

  // Sample Rate (DWORD) - samples/second
  offset += writeUInt32LE(buf, offset, metadata.sampleRate);

  // Average Bytes Per Second (DWORD) - copied from source
  offset += writeUInt32LE(buf, offset, metadata.avgBytesPerSec);

  // Block Align (WORD)
  offset += writeUInt16LE(buf, offset, metadata.blockSize);

  // Bits Per Sample (WORD) - copied from source
  offset += writeUInt16LE(buf, offset, metadata.bitsPerSample);

  // Extra Data Size (WORD)
  offset += writeUInt16LE(buf, offset, metadata.encoderSpecificData.length);

  // --- Stream-Specific Data (Encoder Specific) ---
  buf.set(metadata.encoderSpecificData, offset);
  offset += metadata.encoderSpecificData.length;

  // --- Error Correction Data (Audio Spread) ---
  // Span (BYTE) - Number of packets over which audio will be spread (typically 1)
  buf[offset++] = 1;

  // Virtual Packet Length (WORD) - Size of the largest audio payload
  offset += writeUInt16LE(buf, offset, metadata.maxPayloadSize);

  // Virtual Chunk Length (WORD) - Size of the largest audio payload (same as Virtual Packet Length)
  offset += writeUInt16LE(buf, offset, metadata.maxPayloadSize);

  // Silence Data Length (WORD) - Number of bytes in Silence Data (Block Alignment)
  offset += writeUInt16LE(buf, offset, SILENCE_DATA_LENGTH);

  // Silence Data (BYTE array) - Array of silence data bytes (all zeros)
  for (let i = 0; i < SILENCE_DATA_LENGTH; i++) {
    buf[offset++] = 0x00;
  }

  return buf;
}

/**
 * Creates the Header Extension Object containing the provided Extended Stream Properties Object.
 * @param metadata Audio metadata to use for the Header Extension Object.
 * @returns The Header Extension Object as a Uint8Array.
 */
function buildHeaderExtensionObject(metadata: AudioMetadata): Uint8Array {
  // 3.4 Header Extension Object (mandatory, one only)
  // +---------------------------+------------+-------------+
  // | Field Name                | Field Type | Size (bits) |
  // +===========================+============+=============+
  // | Object ID                 | GUID       | 128         |
  // +---------------------------+------------+-------------+
  // | Object Size               | QWORD      | 64          |
  // +---------------------------+------------+-------------+
  // | Reserved Field 1          | GUID       | 128         |
  // +---------------------------+------------+-------------+
  // | Reserved Field 2          | WORD       | 16          |
  // +---------------------------+------------+-------------+
  // | Header Extension Data Size| DWORD      | 32          |
  // +---------------------------+------------+-------------+
  // | Header Extension Data     | BYTE       | varies      |
  // +---------------------------+------------+-------------+

  // Header Extension Object GUID: 5FBF03B5-A92E-11CF-8EE3-00C00C205365
  const HEADER_EXTENSION_GUID = [0xb5, 0x03, 0xbf, 0x5f, 0x2e, 0xa9, 0xcf, 0x11, 0x8e, 0xe3, 0x00, 0xc0, 0x0c, 0x20, 0x53, 0x65];
  // Reserved Field 1 GUID: ABD3D211-A9BA-11cf-8EE6-00C00C205365
  const RESERVED_FIELD_1_GUID = [0x11, 0xd2, 0xd3, 0xab, 0xba, 0xa9, 0xcf, 0x11, 0x8e, 0xe6, 0x00, 0xc0, 0x0c, 0x20, 0x53, 0x65];

  // Use the raw Extended Stream Properties Object passed in the format
  const extendedStreamProps = metadata.extendedStreamPropertiesObject;

  // Header Extension Data Size
  const HEADER_EXTENSION_DATA_SIZE = extendedStreamProps.length;

  // Total Header Extension Object size
  const HEADER_EXTENSION_SIZE = 24 + 16 + 2 + 4 + HEADER_EXTENSION_DATA_SIZE;

  const buf = new Uint8Array(HEADER_EXTENSION_SIZE);
  let offset = 0;

  // Header Extension Object Header
  offset += writeObjectHeader(buf, offset, HEADER_EXTENSION_GUID, HEADER_EXTENSION_SIZE);

  // Reserved Field 1 (GUID)
  buf.set(RESERVED_FIELD_1_GUID, offset);
  offset += 16;

  // Reserved Field 2 (WORD) - must be 6
  writeUInt16LE(buf, offset, 6);
  offset += 2;

  // Header Extension Data Size (DWORD)
  writeUInt32LE(buf, offset, HEADER_EXTENSION_DATA_SIZE);
  offset += 4;

  // --- Extended Stream Properties Object ---
  buf.set(extendedStreamProps, offset);
  // offset += extendedStreamProps.length;

  return buf;
}

/**
 * Creates and buffers the ASF Data Object and all interleaved Data Packets.
 * @param content The content for the audio file.
 * @param onProgress Optional callback for progress reporting (0-100).
 * @returns The Data Object as a Uint8Array.
 */
function buildDataObject(
  content: AudioContent & { packetSize: number },
  onProgress?: (progress: number) => void,
): { dataObjectBuffer: Uint8Array; totalDataPackets: number } {
  // Data Object is a top level structure that contains the data packets.
  // +--------------------------+-----------------+-------------+-------------------------------------------------+
  // | Field Name               | Field Type      | Size (bits) | Description                                     |
  // +==========================+=================+=============+=================================================+
  // | Object ID                | GUID            | 128         | Unique Identifier for the object.               |
  // +--------------------------+-----------------+-------------+-------------------------------------------------+
  // | Object Size              | QWORD           | 64          | The total size of the object in bytes.          |
  // +--------------------------+-----------------+-------------+-------------------------------------------------+
  // | File ID                  | GUID            | 128         | Identifier linking the object back to its       |
  // |                          |                 |             | source file.                                    |
  // +--------------------------+-----------------+-------------+-------------------------------------------------+
  // | Total Data Packets       | QWORD           | 64          | The number of data packets that comprise        |
  // |                          |                 |             | this object.                                    |
  // +--------------------------+-----------------+-------------+-------------------------------------------------+
  // | Reserved                 | WORD            | 16          | Field reserved for future use.                  |
  // +--------------------------+-----------------+-------------+-------------------------------------------------+
  // | Data Packets             | See section 5.2 | varies      | The actual data segments, structured as         |
  // |                          |                 |             | described in section 5.2.                       |
  // +--------------------------+-----------------+-------------+-------------------------------------------------+

  const { allPayloads, packetSize, streamNumber } = content;

  // Data Object Header size (24 bytes object header + 16 bytes File ID + 8 bytes Total Data Packets + 2 bytes Reserved)
  const DATA_OBJECT_HEADER_SIZE = 50;

  const packets: Uint8Array[] = [];
  let totalDataPackets = 0;

  // --- Create all Data Packets ---
  for (let i = 0; i < allPayloads.length; i++) {
    if (onProgress) {
      const progress = Math.round((i / (allPayloads.length - 1)) * 100);
      if (i === 0 || i === allPayloads.length - 1 || progress >= 5 + ((i - 1) / (allPayloads.length - 1)) * 100) {
        onProgress(progress);
      }
    }

    const { payloadData, metadata, replicatedData } = allPayloads[i];

    // Below is the data structure of an ASF Data Packet:
    //    +--------------------------+
    //    | Error Correction Data    |  > Optional
    //    +--------------------------+
    //    | Payload Parsing          |
    //    | Information              |
    //    +--------------------------+
    //    |                          |
    //    | Payload Data             |
    //    |                          |
    //    +--------------------------+
    //    | Padding Data             |  > Optional
    //    +--------------------------+
    //
    //                Or
    //
    //    +--------------------------+
    //    | Error Correction Data    |  > Optional
    //    +--------------------------+
    //    |                          |
    //    | Opaque Data              |
    //    |                          |
    //    +--------------------------+
    //    | Padding Data             |  > Optional
    //    +--------------------------+

    // 1. Data Packet Header

    // Calculate sizes:
    // Error Correction Data (Audio Spread - Compact format)
    // When Error Correction Present flag is set in the first byte:
    // - First byte: Error Correction Flags (0x82 for compact error correction with 2 bytes data)
    // - Next 2 bytes: Error Correction Data
    const ERROR_CORRECTION_SIZE = 3; // 1 byte flags + 2 bytes data

    // Fixed header part (before Payload Parsing Information, after Error Correction)
    // 1 (Length Type Flags) + 1 (Property Flags) + 4 (Packet Length) + 1 (Padding Length) + 4 (Send Time) + 2 (Duration) = 13 bytes
    const FIXED_PACKET_HEADER_SIZE = 13;

    // Payload Parsing Info size for a single payload:
    const replicatedDataSize = replicatedData.length;
    const PAYLOAD_PARSING_INFO_SIZE =
      1 + // Stream Number (1 byte, Type 1)
      4 + // Media Object Number (4 bytes, Type 3)
      4 + // Offset Into Media Object (4 bytes, Type 3)
      1 + // Replicated Data Length (1 byte, Type 1)
      replicatedDataSize; // Replicated Data

    const PAYLOAD_METADATA_SIZE = PAYLOAD_PARSING_INFO_SIZE; // 10 + replicatedDataSize bytes
    const PAYLOAD_DATA_SIZE = payloadData.length;

    const CONTENT_SIZE = ERROR_CORRECTION_SIZE + FIXED_PACKET_HEADER_SIZE + PAYLOAD_METADATA_SIZE + PAYLOAD_DATA_SIZE;

    const PADDING_SIZE = packetSize - CONTENT_SIZE;

    if (PADDING_SIZE < 0) {
      throw new Error(`Payload size (${CONTENT_SIZE}) exceeds fixed packet size (${packetSize}). Fragmentation not supported.`);
    }

    const packetBuf = new Uint8Array(packetSize);
    let offset = 0;

    // 5.2.1 Error Correction Data (Compact format for Audio Spread)
    // +-----------------------------------+-----------------------+-------------+
    // | Field Name                        | Field Type            | Size (bits) |
    // +===================================+=======================+=============+
    // | Error Correction Flags            | BYTE                  | 8           |
    // |   - Error Correction Data Length  |                       | 4 (LSB)     |
    // |   - Opaque Data Present           |                       | 1           |
    // |   - Error Correction Length Type  |                       | 2           |
    // |   - Error Correction Present      |                       | 1 (MSB)     |
    // +-----------------------------------+-----------------------+-------------+
    // | Error Correction Data             | BYTE                  | varies      |
    // +-----------------------------------+-----------------------+-------------+

    // Error Correction Flags:
    // Bit 0-3: Error Correction Data Length (2 = 2 bytes of data)
    // Bit 4: Opaque Data Present (0 = false)
    // Bit 5-6: Error Correction Length Type (0 = no length field)
    // Bit 7: Error Correction Present (1 = true)
    packetBuf[offset++] = 0x82; // 0b10000010

    // Error Correction Data (2 bytes) - For Audio Spread compact format
    // These bytes are implementation-specific. Typically set to 0x00 0x00
    packetBuf[offset++] = 0x00;
    packetBuf[offset++] = 0x00;

    // 5.2.2 Payload Parsing Information
    // +-----------------------------------+-----------------------+-------------+
    // | Field Name                        | Field Type            | Size (bits) |
    // +===================================+=======================+=============+
    // | Length Type Flags                 | BYTE                  | 8           |
    // |  - Multiple Payloads Present      |                       | 1 (LSB)     |
    // |  - Sequence Type                  |                       | 2           |
    // |  - Padding Length Type            |                       | 2           |
    // |  - Packet Length Type             |                       | 2           |
    // |  - Error Correction Present       |                       | 1           |
    // +-----------------------------------+-----------------------+-------------+
    // | Property Flags                    | BYTE                  | 8           |
    // |  - Replicated Data Length Type    |                       | 2 (LSB)     |
    // |  - Offset Into Media Object LT    |                       | 2           |
    // |  - Media Object Number Length Type|                       | 2           |
    // |  - Stream Number Length Type      |                       | 2           |
    // +-----------------------------------+-----------------------+-------------+
    // | Packet Length                     | BYTE, WORD or DWORD   | 0, 8, 16, 32|
    // +-----------------------------------+-----------------------+-------------+
    // | Sequence                          | BYTE, WORD or DWORD   | 0, 8, 16, 32|
    // +-----------------------------------+-----------------------+-------------+
    // | Padding Length                    | BYTE, WORD or DWORD   | 0, 8, 16, 32|
    // +-----------------------------------+-----------------------+-------------+
    // | Send Time                         | DWORD                 | 32          |
    // +-----------------------------------+-----------------------+-------------+
    // | Duration                          | WORD                  | 16          |
    // +-----------------------------------+-----------------------+-------------+

    // Length Type Flags (BYTE, 8 bits)
    // Bit 0: Multiple Payloads Present (0 = false)
    // Bit 1-2: Sequence Type (0 = no sequence field, reserved for future use)
    // Bit 3-4: Padding Length Type (1 = 1 byte)
    // Bit 5-6: Packet Length Type (3 = 4 bytes)
    // Bit 7: Error Correction Present (0 = false, handled separately above)
    packetBuf[offset++] = 0b01101000; // 0x68

    // Property Flags (BYTE, 8 bits)
    // Bit 0-1: Replicated Data Length Type (1 = 1 byte)
    // Bit 2-3: Offset Into Media Object Length Type (3 = 4 bytes)
    // Bit 4-5: Media Object Number Length Type (3 = 4 bytes)
    // Bit 6-7: Stream Number Length Type (1 = 1 byte)
    packetBuf[offset++] = 0b01111101; // 0x7D

    // Packet Length (DWORD, 4 bytes)
    writeUInt32LE(packetBuf, offset, packetSize);
    offset += 4;

    // Sequence field is not written (Sequence Type = 0, reserved for future use)

    // Padding Length (BYTE, 1 byte)
    packetBuf[offset++] = PADDING_SIZE;

    // Send Time (DWORD, 4 bytes)
    // The Send Time field must be coded using a DWORD and is specified in millisecond units.
    writeUInt32LE(packetBuf, offset, metadata.packetSendTime); // Time in ms
    offset += 4;

    // Duration (WORD, 2 bytes)
    // The Duration field is coded using a WORD and is specified in millisecond units.
    writeUInt16LE(packetBuf, offset, metadata.packetDuration);
    offset += 2;

    // 5.3.3.1 Single payload
    // +---------------------------+-----------------------+-------------+
    // | Field Name                | Field Type            | Size (bits) |
    // +===========================+=======================+=============+
    // | Stream Number             | BYTE                  | 8           |
    // +---------------------------+-----------------------+-------------+
    // | Media Object Number       | BYTE, WORD, or DWORD  | 0, 8, 16, 32|
    // +---------------------------+-----------------------+-------------+
    // | Offset Into Media Object  | BYTE, WORD, or DWORD  | 0, 8, 16, 32|
    // +---------------------------+-----------------------+-------------+
    // | Replicated Data Length    | BYTE, WORD, or DWORD  | 0, 8, 16, 32|
    // +---------------------------+-----------------------+-------------+
    // | Replicated Data           | BYTE                  | varies      |
    // +---------------------------+-----------------------+-------------+
    // | Payload Data              | BYTE                  | varies      |
    // +---------------------------+-----------------------+-------------+
    //
    // or 5.2.3.2 Single payload, compressed payload data
    //
    // +---------------------------+-----------------------+-------------+
    // | Field Name                | Field Type            | Size (bits) |
    // +===========================+=======================+=============+
    // | Stream Number             | BYTE                  | 8           |
    // +---------------------------+-----------------------+-------------+
    // | Media Object Number       | BYTE, WORD or DWORD   | 0, 8, 16, 32|
    // +---------------------------+-----------------------+-------------+
    // | Presentation Time         | BYTE, WORD or DWORD   | 0, 8, 16, 32|
    // +---------------------------+-----------------------+-------------+
    // | Replicated Data Length    | BYTE, WORD or DWORD   | 0, 8, 16, 32|
    // +---------------------------+-----------------------+-------------+
    // | Presentation Time Delta   | BYTE                  | 8           |
    // +---------------------------+-----------------------+-------------+
    // | Sub-Payload Data          | BYTE                  | varies      |
    // +---------------------------+-----------------------+-------------+

    // 5.2.3.3 Multiple payloads
    // +---------------------------+-----------------------+-------------+
    // | Field Name                | Field Type            | Size (bits) |
    // +===========================+=======================+=============+
    // | Stream Number             | BYTE                  | 8           |
    // +---------------------------+-----------------------+-------------+
    // | Media Object Number       | BYTE, WORD or DWORD   | 0, 8, 16, 32|
    // +---------------------------+-----------------------+-------------+
    // | Offset Into Media Object  | BYTE, WORD or DWORD   | 0, 8, 16, 32|
    // +---------------------------+-----------------------+-------------+
    // | Replicated Data Length    | BYTE, WORD or DWORD   | 0, 8, 16, 32|
    // +---------------------------+-----------------------+-------------+
    // | Replicated Data           | BYTE                  | varies      |
    // +---------------------------+-----------------------+-------------+
    // | Payload Length            | BYTE, WORD or DWORD   | 8, 16, 32   |
    // +---------------------------+-----------------------+-------------+
    // | Payload Data              | BYTE                  | varies      |
    // +---------------------------+-----------------------+-------------+
    //
    // or 5.2.3.4 Multiple payloads, compressed payload data
    // +---------------------------+-----------------------+-------------+
    // | Field Name                | Field Type            | Size (bits) |
    // +===========================+=======================+=============+
    // | Stream Number             | BYTE                  | 8           |
    // +---------------------------+-----------------------+-------------+
    // | Media Object Number       | BYTE, WORD or DWORD   | 0, 8, 16, 32|
    // +---------------------------+-----------------------+-------------+
    // | Presentation Time         | BYTE, WORD or DWORD   | 0, 8, 16, 32|
    // +---------------------------+-----------------------+-------------+
    // | Replicated Data Length    | BYTE, WORD or DWORD   | 0, 8, 16, 32|
    // +---------------------------+-----------------------+-------------+
    // | Presentation Time Delta   | BYTE                  | 8           |
    // +---------------------------+-----------------------+-------------+
    // | Payload Length            | BYTE, WORD or DWORD   | 8, 16, 32   |
    // +---------------------------+-----------------------+-------------+
    // | Sub-Payload Data          | BYTE                  | varies      |
    // +---------------------------+-----------------------+-------------+

    // The use of the compressed payload structure forces a rule on the ASF file writer (the muxer):
    // Each new payload must either start a new Media Object, or implicitly follow
    // the previous payload fragment without requiring an explicit byte offset.
    //
    // For streams like WMA audio using this mode, the container structure effectively assumes:
    //  - If a payload starts a new audio block (Superframe), its internal offset is 0.
    //  - If a payload is the continuation of the previous audio block, the decoder
    //    simply assumes the data starts immediately after the previous fragment ended.
    //    The Media Object Number (the 1-byte counter) remains the same, confirming it
    //    belongs to the current frame.

    // Stream Number (BYTE)
    packetBuf[offset++] = streamNumber;

    // Media Object Number (DWORD)
    offset += writeUInt32LE(packetBuf, offset, metadata.mediaObjectNumber);

    // Offset Into Media Object (DWORD)
    offset += writeUInt32LE(packetBuf, offset, metadata.offsetIntoMediaObjectOrPresentationTime);

    // Replicated Data Length (BYTE)
    packetBuf[offset++] = replicatedDataSize;

    // Replicated Data
    packetBuf.set(replicatedData, offset);
    offset += replicatedDataSize;

    // c. Stream Payload Data
    packetBuf.set(payloadData, offset);
    offset += PAYLOAD_DATA_SIZE;

    // d. Padding Data (remaining space is implicitly 0x00)

    packets.push(packetBuf);
    totalDataPackets++;
  }

  // --- Create the Data Object container ---

  const TOTAL_PACKETS_SIZE = totalDataPackets * packetSize;
  const DATA_OBJECT_SIZE = DATA_OBJECT_HEADER_SIZE + TOTAL_PACKETS_SIZE;

  // Create a single buffer to hold the header and all packets
  const dataObjectBuffer = new Uint8Array(DATA_OBJECT_SIZE);
  let offset = 0;

  // 1. Data Object Header (56 bytes)
  offset += writeObjectHeader(dataObjectBuffer, offset, AsfGuid.DATA_OBJECT, DATA_OBJECT_SIZE);

  // File ID (GUID) - Must match the one in File Properties Object (all zeros)
  const FILE_ID = new Uint8Array(16); // All zeros
  dataObjectBuffer.set(FILE_ID, offset);
  offset += 16;

  // Total Data Packets (QWORD)
  writeUInt64LE(dataObjectBuffer, offset, totalDataPackets);
  offset += 8;

  // Reserved (WORD) - 0x0101
  writeUInt16LE(dataObjectBuffer, offset, 0x0101);
  offset += 2;

  // 2. Data Packets
  for (const packet of packets) {
    dataObjectBuffer.set(packet, offset);
    offset += packet.length;
  }

  return {
    dataObjectBuffer,
    totalDataPackets,
  };
}

/**
 * Writes the full ASF Header Object.
 * @param metadata The metadata for the audio file.
 * @returns The Header Object as a Uint8Array.
 */
function buildHeaderObject(metadata: AudioMetadata & { dataObjectSize: number; totalDataPackets: number }): Uint8Array {
  // 3.1 Header Object (mandatory, one only)
  // +--------------------------+------------+------------+
  // | Field name               | Field type | Size (bits)|
  // +--------------------------+------------+------------+
  // | Object ID                | GUID       | 128        |
  // | Object Size              | QWORD      | 64         |
  // | Number of Header Objects | DWORD      | 32         |
  // | Reserved1                | BYTE       | 8          |
  // | Reserved2                | BYTE       | 8          |
  // +--------------------------+------------+------------+

  const fileProps = buildFilePropertiesObject(metadata);
  const streamProps = buildStreamPropertiesObject(metadata);
  const headerExtension = buildHeaderExtensionObject(metadata);
  // const headerExtension = new Uint8Array(0); //

  // 3 sub-objects: File Properties, Stream Properties, Header Extension
  const NUM_HEADER_OBJECTS = 3;

  // Total Header Object size
  const HEADER_SIZE = 30 + fileProps.length + streamProps.length + headerExtension.length;

  // Re-calculate total file size
  const TOTAL_FILE_SIZE = HEADER_SIZE + metadata.dataObjectSize;

  // --- Write the Top-Level Header Object ---
  const headerBuf = new Uint8Array(HEADER_SIZE);
  let offset = 0;

  // 1. Header Object Header
  offset += writeObjectHeader(headerBuf, offset, AsfGuid.HEADER, HEADER_SIZE);

  // Number of Header Objects (DWORD)
  writeUInt32LE(headerBuf, offset, NUM_HEADER_OBJECTS);
  offset += 4;

  // Reserved (BYTE) - 0x01
  headerBuf[offset++] = 0x01;
  // Reserved (BYTE) - 0x02 (ASF Version)
  headerBuf[offset++] = 0x02;

  // 2. File Properties Object (Patch File Size and Packet Count)
  writeUInt64LE(fileProps, 24 + 16, TOTAL_FILE_SIZE); // Patch the File Size field
  writeUInt64LE(fileProps, 24 + 32, metadata.totalDataPackets); // Patch the Packet Count field
  headerBuf.set(fileProps, offset);
  offset += fileProps.length;

  // 3. Stream Properties Object
  headerBuf.set(streamProps, offset);
  offset += streamProps.length;

  // 4. Header Extension Object
  headerBuf.set(headerExtension, offset);
  offset += headerExtension.length;

  return headerBuf;
}
