import { AsfGuid, writeUInt16, writeUInt32, writeUInt64 } from '../codecs/asf';
import { PayloadMetadata } from '../parsers/asf';

interface WmaAudioFormat {
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
}

// --- ASF Muxer Class ---

/**
 * A basic ASF Muxer for a single WMA audio stream.
 */
export class WmaWriter {
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  private readonly format: WmaAudioFormat;
  private readonly PACKET_SIZE: number; // Packet size from source file

  private totalDataPackets = 0;
  private totalPayloadsSize = 0;
  private maxDuration = 0; // Total duration in hns
  private payloadQueue: Array<{ streamNumber: number; data: Uint8Array; metadata: PayloadMetadata }> = [];

  constructor(writableStream: WritableStream<Uint8Array>, format: WmaAudioFormat) {
    this.writer = writableStream.getWriter();
    this.format = format;
    this.PACKET_SIZE = format.packetSize; // Use packet size from source
  }

  /**
   * Callback function to receive raw payload data and metadata.
   */
  public onPayload(streamNumber: number, payloadData: Uint8Array, metadata: PayloadMetadata): void {
    // Only support the single designated WMA stream
    if (streamNumber !== this.format.streamNumber) {
      console.warn(`Ignoring payload for unknown stream: ${streamNumber}`);
      return;
    }

    // Track total size and duration
    this.totalPayloadsSize += payloadData.length;
    this.maxDuration = Math.max(this.maxDuration, this.format.objectDuration);

    this.payloadQueue.push({ streamNumber, data: payloadData, metadata });
  }

  /**
   * Finishes writing the file:
   * 1. Generates and writes the Data Object.
   * 2. Calculates final sizes and writes the Header Object.
   * 3. Closes the stream.
   */
  public async finish(): Promise<void> {
    // 1. Write the Data Object (will calculate the final packet count)
    const dataObjectBuffer = await this.writeDataObject();

    // 2. Write the Header Object
    await this.writeHeaderObject(dataObjectBuffer.length);

    // 3. Write the buffered Data Object content
    await this.writer.write(dataObjectBuffer);

    // 4. Close the stream
    await this.writer.close();
  }

  // --- Private Helper Methods for Object Construction ---

  /**
   * Writes a GUID (16 bytes) and Object Size (8 bytes) to a buffer.
   * @param buf Buffer to write to
   * @param offset Offset in buffer
   * @param guid GUID to write
   * @param size Object size (number or bigint)
   * @returns The size of the object header (24 bytes).
   */
  private writeObjectHeader(buf: Uint8Array, offset: number, guid: readonly number[], size: number | bigint): number {
    buf.set(guid, offset);
    writeUInt64(buf, offset + 16, size);
    return 24;
  }

  /**
   * Creates the ASF File Properties Object.
   * @returns The File Properties Object as a Uint8Array.
   */
  private createFilePropertiesObject(): Uint8Array {
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

    offset += this.writeObjectHeader(buf, offset, AsfGuid.FILE_PROPERTIES, OBJECT_SIZE);

    // File ID (GUID) - All zeros for MMS ID
    const FILE_ID = new Uint8Array(16); // All zeros
    buf.set(FILE_ID, offset);
    offset += 16;

    // File Size (QWORD) - Total file size = Header Object Size + Data Object Size (will be back-patched)
    offset += writeUInt64(buf, offset, 0); // Placeholder: will be filled in finish() logic

    // Creation Date (QWORD) - The value is given as the number of 100-nanosecond intervals since January 1, 1601,
    // according to Coordinated Universal Time (Greenwich Mean Time).
    // The value of this field may be invalid if the Broadcast Flag bit in the Flags field is set to 1.
    buf.set([0x00, 0x80, 0x3e, 0xd5, 0xde, 0xb1, 0x9d, 0x01], offset); // Epoch
    offset += 8;

    // Data Packets Count (QWORD)
    offset += writeUInt64(buf, offset, this.totalDataPackets);

    // Play Duration (QWORD) - Use from source
    offset += writeUInt64(buf, offset, this.format.playDuration);

    // Send Duration (QWORD) - Use from source
    offset += writeUInt64(buf, offset, this.format.sendDuration);

    // Preroll (QWORD) - Use from source if available, otherwise 0
    offset += writeUInt64(buf, offset, this.format.preroll);

    // Flags (DWORD) - 0x00000002 (Broadcast Flag = 0, Seekable Flag = 1)
    offset += writeUInt32(buf, offset, 0x00000002);

    // Minimum/Maximum Data Packet Size (DWORD) - Use packet size from source
    offset += writeUInt32(buf, offset, this.format.packetSize); // Minimum
    offset += writeUInt32(buf, offset, this.format.packetSize); // Maximum

    // Maximum Bitrate (DWORD) - Use from source if available
    offset += writeUInt32(buf, offset, this.format.maxBitrate);

    return buf;
  }

  /**
   * Creates the ASF Stream Properties Object for the WMA stream.
   * @returns The Stream Properties Object as a Uint8Array.
   */
  private createStreamPropertiesObject(): Uint8Array {
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
    const WAVEFORMATEX_SIZE = 18 + this.format.encoderSpecificData.length;

    // Error Correction Data: Audio Spread
    // Span (1 byte) + Virtual Packet Length (2 bytes) + Virtual Chunk Length (2 bytes) +
    // Silence Data Length (2 bytes) + Silence Data (Block Alignment bytes)
    const SILENCE_DATA_LENGTH = this.format.blockSize; // Use Block Alignment for silence data
    const ERROR_CORRECTION_DATA_SIZE = 1 + 2 + 2 + 2 + SILENCE_DATA_LENGTH;

    // Object size: Header (24) + Body before Type-Specific (54) + WAVEFORMATEX + Error Correction Data
    const OBJECT_SIZE = 24 + 54 + WAVEFORMATEX_SIZE + ERROR_CORRECTION_DATA_SIZE;
    const buf = new Uint8Array(OBJECT_SIZE);
    let offset = 0;

    offset += this.writeObjectHeader(buf, offset, AsfGuid.STREAM_PROPERTIES, OBJECT_SIZE);

    // Stream Type GUID (16 bytes)
    buf.set(AsfGuid.AUDIO_STREAM, offset);
    offset += 16;

    // Error Correction Type GUID (16 bytes) - Audio Spread for WMA
    buf.set(AsfGuid.AUDIO_SPREAD, offset);
    offset += 16;

    // Time Offset (QWORD)
    writeUInt64(buf, offset, 0);
    offset += 8;

    // Type-Specific Data Length (DWORD) - Size of WAVEFORMATEX structure
    writeUInt32(buf, offset, WAVEFORMATEX_SIZE);
    offset += 4;

    // Error Correction Data Length (DWORD) - Size of Audio Spread error correction data
    writeUInt32(buf, offset, ERROR_CORRECTION_DATA_SIZE);
    offset += 4;

    // Flags (WORD) - bits 0-6 contain stream number, bit 15 = encrypted flag
    writeUInt16(buf, offset, this.format.streamNumber);
    offset += 2;

    // Reserved (DWORD)
    writeUInt32(buf, offset, 0x00000000);
    offset += 4;

    // --- Type-Specific Data (WAVEFORMATEX structure for WMA) starts at offset 78 ---

    // WMA Codec ID (WORD) - formatTag
    writeUInt16(buf, offset, this.format.codecId);
    offset += 2;

    // Number of Channels (WORD)
    writeUInt16(buf, offset, this.format.channels);
    offset += 2;

    // Sample Rate (DWORD) - samples/second
    writeUInt32(buf, offset, this.format.sampleRate);
    offset += 4;

    // Average Bytes Per Second (DWORD) - copied from source
    writeUInt32(buf, offset, this.format.avgBytesPerSec);
    offset += 4;

    // Block Align (WORD)
    writeUInt16(buf, offset, this.format.blockSize);
    offset += 2;

    // Bits Per Sample (WORD) - copied from source
    writeUInt16(buf, offset, this.format.bitsPerSample);
    offset += 2;

    // Extra Data Size (WORD)
    writeUInt16(buf, offset, this.format.encoderSpecificData.length);
    offset += 2;

    // --- Stream-Specific Data (Encoder Specific) ---
    buf.set(this.format.encoderSpecificData, offset);
    offset += this.format.encoderSpecificData.length;

    // --- Error Correction Data (Audio Spread) ---
    // Span (BYTE) - Number of packets over which audio will be spread (typically 1)
    buf[offset++] = 1;

    // Virtual Packet Length (WORD) - Size of the largest audio payload
    writeUInt16(buf, offset, this.format.maxPayloadSize);
    offset += 2;

    // Virtual Chunk Length (WORD) - Size of the largest audio payload (same as Virtual Packet Length)
    writeUInt16(buf, offset, this.format.maxPayloadSize);
    offset += 2;

    // Silence Data Length (WORD) - Number of bytes in Silence Data (Block Alignment)
    writeUInt16(buf, offset, SILENCE_DATA_LENGTH);
    offset += 2;

    // Silence Data (BYTE array) - Array of silence data bytes (all zeros)
    for (let i = 0; i < SILENCE_DATA_LENGTH; i++) {
      buf[offset++] = 0x00;
    }

    return buf;
  }

  /**
   * Creates the Header Extension Object with Extended Stream Properties.
   * @returns The Header Extension Object as a Uint8Array.
   */
  /**
   * Creates the Header Extension Object containing the provided Extended Stream Properties Object.
   * @returns The Header Extension Object as a Uint8Array.
   */
  private createHeaderExtensionObject(): Uint8Array {
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
    const extendedStreamProps = this.format.extendedStreamPropertiesObject;

    // Header Extension Data Size
    const HEADER_EXTENSION_DATA_SIZE = extendedStreamProps.length;

    // Total Header Extension Object size
    const HEADER_EXTENSION_SIZE = 24 + 16 + 2 + 4 + HEADER_EXTENSION_DATA_SIZE;

    const buf = new Uint8Array(HEADER_EXTENSION_SIZE);
    let offset = 0;

    // Header Extension Object Header
    offset += this.writeObjectHeader(buf, offset, HEADER_EXTENSION_GUID, HEADER_EXTENSION_SIZE);

    // Reserved Field 1 (GUID)
    buf.set(RESERVED_FIELD_1_GUID, offset);
    offset += 16;

    // Reserved Field 2 (WORD) - must be 6
    writeUInt16(buf, offset, 6);
    offset += 2;

    // Header Extension Data Size (DWORD)
    writeUInt32(buf, offset, HEADER_EXTENSION_DATA_SIZE);
    offset += 4;

    // --- Extended Stream Properties Object ---
    buf.set(extendedStreamProps, offset);
    // offset += extendedStreamProps.length;

    return buf;
  }

  /**
   * Writes the full ASF Header Object.
   * @param dataObjectSize The size of the full Data Object (including its header).
   */
  private async writeHeaderObject(dataObjectSize: number): Promise<void> {
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

    const fileProps = this.createFilePropertiesObject();
    const streamProps = this.createStreamPropertiesObject();
    const headerExtension = this.createHeaderExtensionObject();
    // const headerExtension = new Uint8Array(0); //

    // 3 sub-objects: File Properties, Stream Properties, Header Extension
    const NUM_HEADER_OBJECTS = 3;

    // Total Header Object size
    const HEADER_SIZE = 30 + fileProps.length + streamProps.length + headerExtension.length;

    // Re-calculate total file size
    const TOTAL_FILE_SIZE = HEADER_SIZE + dataObjectSize;

    // --- Write the Top-Level Header Object ---
    const headerBuf = new Uint8Array(HEADER_SIZE);
    let offset = 0;

    // 1. Header Object Header
    offset += this.writeObjectHeader(headerBuf, offset, AsfGuid.HEADER, HEADER_SIZE);

    // Number of Header Objects (DWORD)
    writeUInt32(headerBuf, offset, NUM_HEADER_OBJECTS);
    offset += 4;

    // Reserved (BYTE) - 0x01
    headerBuf[offset++] = 0x01;
    // Reserved (BYTE) - 0x02 (ASF Version)
    headerBuf[offset++] = 0x02;

    // 2. File Properties Object (Patch File Size and Packet Count)
    writeUInt64(fileProps, 24 + 16, TOTAL_FILE_SIZE); // Patch the File Size field
    writeUInt64(fileProps, 24 + 32, this.totalDataPackets); // Patch the Packet Count field
    headerBuf.set(fileProps, offset);
    offset += fileProps.length;

    // 3. Stream Properties Object
    headerBuf.set(streamProps, offset);
    offset += streamProps.length;

    // 4. Header Extension Object
    headerBuf.set(headerExtension, offset);
    offset += headerExtension.length;

    await this.writer.write(headerBuf);
  }

  /**
   * Creates and buffers the ASF Data Object and all interleaved Data Packets.
   * @returns The Data Object as a Uint8Array.
   */
  private async writeDataObject(): Promise<Uint8Array> {
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

    // Data Object Header size (24 bytes object header + 16 bytes File ID + 8 bytes Total Data Packets + 2 bytes Reserved)
    const DATA_OBJECT_HEADER_SIZE = 50;

    const packets: Uint8Array[] = [];
    let sequenceNumber = 0;

    // --- Create all Data Packets ---
    for (const { data, metadata } of this.payloadQueue) {
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
      const replicatedDataSize = metadata.replicatedData.length;
      const PAYLOAD_PARSING_INFO_SIZE =
        1 + // Stream Number (1 byte, Type 1)
        4 + // Media Object Number (4 bytes, Type 3)
        4 + // Offset Into Media Object (4 bytes, Type 3)
        1 + // Replicated Data Length (1 byte, Type 1)
        replicatedDataSize; // Replicated Data

      const PAYLOAD_METADATA_SIZE = PAYLOAD_PARSING_INFO_SIZE; // 10 + replicatedDataSize bytes
      const PAYLOAD_DATA_SIZE = data.length;

      const CONTENT_SIZE = ERROR_CORRECTION_SIZE + FIXED_PACKET_HEADER_SIZE + PAYLOAD_METADATA_SIZE + PAYLOAD_DATA_SIZE;

      const PADDING_SIZE = this.PACKET_SIZE - CONTENT_SIZE;

      if (PADDING_SIZE < 0) {
        throw new Error(`Payload size (${CONTENT_SIZE}) exceeds fixed packet size (${this.PACKET_SIZE}). Fragmentation not supported.`);
      }

      const packetBuf = new Uint8Array(this.PACKET_SIZE);
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
      writeUInt32(packetBuf, offset, this.PACKET_SIZE);
      offset += 4;

      // Sequence field is not written (Sequence Type = 0, reserved for future use)

      // Padding Length (BYTE, 1 byte)
      packetBuf[offset++] = PADDING_SIZE;

      // Send Time (DWORD, 4 bytes)
      // The Send Time field must be coded using a DWORD and is specified in millisecond units.
      writeUInt32(packetBuf, offset, metadata.packetSendTime); // Time in ms
      offset += 4;

      // Duration (WORD, 2 bytes)
      // The Duration field is coded using a WORD and is specified in millisecond units.
      writeUInt16(packetBuf, offset, metadata.packetDuration);
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
      packetBuf[offset++] = this.format.streamNumber;

      // Media Object Number (DWORD)
      offset += writeUInt32(packetBuf, offset, metadata.mediaObjectNumber);

      // Offset Into Media Object (DWORD)
      offset += writeUInt32(packetBuf, offset, metadata.offsetIntoMediaObject);

      // Replicated Data Length (BYTE)
      packetBuf[offset++] = replicatedDataSize;

      // Replicated Data
      packetBuf.set(metadata.replicatedData, offset);
      offset += replicatedDataSize;

      // c. Stream Payload Data
      packetBuf.set(data, offset);
      offset += PAYLOAD_DATA_SIZE;

      // d. Padding Data (remaining space is implicitly 0x00)

      packets.push(packetBuf);
      sequenceNumber++;
    }

    this.totalDataPackets = sequenceNumber;

    // --- Create the Data Object container ---

    const TOTAL_PACKETS_SIZE = this.totalDataPackets * this.PACKET_SIZE;
    const DATA_OBJECT_SIZE = DATA_OBJECT_HEADER_SIZE + TOTAL_PACKETS_SIZE;

    // Create a single buffer to hold the header and all packets
    const dataObjectBuffer = new Uint8Array(DATA_OBJECT_SIZE);
    let offset = 0;

    // 1. Data Object Header (56 bytes)
    offset += this.writeObjectHeader(dataObjectBuffer, offset, AsfGuid.DATA_OBJECT, DATA_OBJECT_SIZE);

    // File ID (GUID) - Must match the one in File Properties Object (all zeros)
    const FILE_ID = new Uint8Array(16); // All zeros
    dataObjectBuffer.set(FILE_ID, offset);
    offset += 16;

    // Total Data Packets (QWORD)
    writeUInt64(dataObjectBuffer, offset, this.totalDataPackets);
    offset += 8;

    // Reserved (WORD) - 0x0101
    writeUInt16(dataObjectBuffer, offset, 0x0101);
    offset += 2;

    // 2. Data Packets
    for (const packet of packets) {
      dataObjectBuffer.set(packet, offset);
      offset += packet.length;
    }

    return dataObjectBuffer;
  }
}

// Example placeholder for the WMA format (WMA Standard 128 kbps 44.1kHz Stereo)
// const WMA_FORMAT_EXAMPLE: WmaAudioFormat = {
//     codecId: 0x0161,
//     channels: 2,
//     sampleRate: 44100,
//     bitrate: 128000,
//     blockSize: 1024, // Placeholder block size
//     objectDuration: 400000, // 40ms per object in hns (40ms * 10000 hns/ms)
//     encoderSpecificData: new Uint8Array([]), // No extra data for this example
// };

// Example Web WritableStream implementation (or a mock for testing)
// const writableStream = getMyFileWritableStream();

// // 1. Initialize the writer
// const wmaWriter = new WmaWriter(writableStream, WMA_FORMAT_EXAMPLE);

// // 2. Feed payloads
// const audioFrame1 = new Uint8Array([/* raw WMA data 1 */]);
// wmaWriter.onPayload(1, audioFrame1, {
//     presentationTime: 0,
//     mediaObjectNumber: 0,
//     isKeyFrame: true,
// });

// const audioFrame2 = new Uint8Array([/* raw WMA data 2 */]);
// wmaWriter.onPayload(1, audioFrame2, {
//     presentationTime: WMA_FORMAT_EXAMPLE.objectDuration,
//     mediaObjectNumber: 1,
//     isKeyFrame: true,
// });

// // ... more payloads ...

// // 3. Finish and close the file
// await wmaWriter.finish();
