import { AsfGuid, calculateFieldSizes, interpreteAudioFormatTag, matchesGuid, readVarLengthField } from '../codecs/asf';
import { readUInt16LE, readUInt32LE, readUInt64LE } from '../codecs/binary';
import { GetMediaInfoOptions } from '../get-media-info';
import { AudioStreamInfo, MediaInfo, toVideoCodec, VideoStreamInfo } from '../media-info';
import { UnsupportedFormatError } from '../utils';

/**
 * Metadata about a payload
 */
export interface PayloadMetadata {
  /**
   * Whether this payload is part of a multi-payload packet
   */
  isMultiPayload: boolean;
  /**
   * Whether this payload is a sub-payload from a compressed payload
   */
  isSubPayload: boolean;
  /**
   * Whether this payload is a compressed payload
   */
  isCompressedPayload: boolean;
  /**
   * Whether this payload belongs to a key frame
   */
  isKeyFrame: boolean;
  /**
   * The send time of the Data Packet in milliseconds
   */
  packetSendTime: number;
  /**
   * The duration of the Data Packet in milliseconds
   */
  packetDuration: number;
  /**
   * The media object number (e.g. frame number)
   */
  mediaObjectNumber: number;
  /**
   * The offset into the media object, or presentation time for compressed payloads
   */
  offsetIntoMediaObjectOrPresentationTime: number;
}

/**
 * Callback function to receive payload and metadata for extracted streams.
 * @param streamNumber - The stream number (1-127) of the payload
 * @param payloadData - Payload data excluding header
 * @param metadata - Metadata about the payload
 * @param replicatedData - Replicated data (e.g. presentation time delta or other metadata)
 */
export type OnPayloadCallback = (streamNumber: number, payloadData: Uint8Array, metadata: PayloadMetadata, replicatedData: Uint8Array) => void;

export interface ParseAsfOptions extends GetMediaInfoOptions {
  /**
   * Array of stream numbers (1-127) to extract payload data from.
   * If not specified, no payload extraction will be performed.
   */
  extractStreams?: number[];
  /**
   * Callback function to receive payload and metadata for extracted streams.
   * @param streamNumber - The stream number (1-127) of the payload
   * @param payloadData - Payload data excluding header
   * @param metadata - Metadata about the payload
   * @param replicatedData - Replicated data (e.g. presentation time delta or other metadata)
   */
  onPayload?: OnPayloadCallback;
}

export interface FileProperties {
  playDuration: number;
  sendDuration: number;
  preroll: number;
  packetSize: number;
}

export interface AdditionalStreamInfo {
  codecPrivate: Uint8Array;
  extendedStreamPropertiesObject: Uint8Array;
}

export type AsfMediaInfo = Omit<MediaInfo, 'parser'> & {
  fileProperties: FileProperties;
  additionalStreamInfo: Map<number, AdditionalStreamInfo>;
};

/**
 * Parses ASF (Advanced Systems Format) file from a stream and extracts media information.
 * Used for WMA (Windows Media Audio) and WMV (Windows Media Video) files.
 *
 * @param stream The input media stream
 * @param options Optional options for the parser, including extraction settings
 * @returns Media information without the parser field
 * @throws UnsupportedFormatError if the stream is not a valid ASF file
 */
export async function parseAsf(stream: ReadableStream<Uint8Array>, options?: ParseAsfOptions): Promise<AsfMediaInfo> {
  const shouldExtractPayload = options?.extractStreams && options?.extractStreams.length > 0 && options?.onPayload;
  const extractStreamSet = new Set(options?.extractStreams);

  // 2.2 Top-level file structure
  // +----------------------------------------------+
  // |                                              |
  // |      Header Object (Mandatory, Start)        |
  // |                                              |
  // |  +----------------------------------------+  |
  // |  | File Properties Object (Mandatory)     |  |
  // |  +----------------------------------------+  |
  // |  | Stream Properties Object 1 (Mandatory) |  |
  // |  +----------------------------------------+  |
  // |  | ...                                    |  |
  // |  +----------------------------------------+  |
  // |  | Stream Properties Object N (Optional)  |  |
  // |  +----------------------------------------+  |
  // |  | Header Extension Object (Mandatory)    |  |
  // |  +----------------------------------------+  |
  // |  | <Other header objects> (Optional)      |  |
  // |  +----------------------------------------+  |
  // +----------------------------------------------+
  // |                                              |
  // |          Data Object (Mandatory)             |
  // |                                              |
  // |  +----------------------------------------+  |
  // |  | Data Packet 1                          |  |
  // |  +----------------------------------------+  |
  // |  | ...                                    |  |
  // |  +----------------------------------------+  |
  // |  | Data Packet M                          |  |
  // |  +----------------------------------------+  |
  // |                                              |
  // +----------------------------------------------+
  // |                                              |
  // |  <Other top-level objects> (Optional)        |
  // |  (e.g., Extended Content Encryption)         |
  // |                                              |
  // +----------------------------------------------+
  // |       Index Object 1 (Optional)              |
  // +----------------------------------------------+
  // |                  ...                         |
  // +----------------------------------------------+
  // |       Index Object K (Optional)              |
  // +----------------------------------------------+
  // |  Simple Index Object 1 (per video stream)    |
  // +----------------------------------------------+
  // |                  ...                         |
  // +----------------------------------------------+
  // |  Simple Index Object L (per video stream)    |
  // +----------------------------------------------+

  // The Header Object is mandatory and must be placed at the beginning of every ASF file.
  // The Data Object is also mandatory and must follow the Header Object.
  // The Index Object(s) are optional, but they are useful in providing time-based random access into ASF files.
  // When present, the Index Object(s) must be the last object in the ASF file.

  const reader = stream.getReader();

  // Read first chunk for header parsing
  const { done: firstDone, value: firstValue } = await reader.read();

  if (firstDone || !firstValue || firstValue.length < 50) {
    throw new UnsupportedFormatError('Not an ASF file: insufficient data');
  }

  const data = firstValue;

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

  // Check ASF header GUID
  if (!matchesGuid(data, 0, AsfGuid.HEADER)) {
    throw new UnsupportedFormatError('Not an ASF file: missing ASF header GUID');
  }

  // Parse header object size (8 bytes, little-endian)
  // JavaScript can't handle 64-bit integers well, so we only use the lower 32 bits
  const headerSize = Number(readUInt64LE(data, 16));

  // Number of header objects (4 bytes, little-endian)
  const numObjects = readUInt32LE(data, 24);

  if (numObjects === 0 || headerSize < 50) {
    throw new UnsupportedFormatError('Not an ASF file: invalid header');
  }

  let offset = 30;

  const audioStreams: AudioStreamInfo[] = [];
  const videoStreams: VideoStreamInfo[] = [];
  let durationInSeconds: number | undefined;

  // Additional info collection
  const additionalStreamInfo = new Map<number, AdditionalStreamInfo>();
  let filePacketSize: number | undefined;
  let filePlayDuration: number | undefined;
  let fileSendDuration: number | undefined;
  let filePreroll: number | undefined;

  //  Scan for Stream Properties Object
  while (offset + 24 < data.length && offset < headerSize) {
    if (matchesGuid(data, offset, AsfGuid.STREAM_PROPERTIES)) {
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

      // Object size (8 bytes, little-endian) at offset 16
      const objectSize = Number(readUInt64LE(data, offset + 16));

      // Stream Type GUID at offset 24 (16 bytes)
      const isAudio = matchesGuid(data, offset + 24, AsfGuid.AUDIO_STREAM);
      const isVideo = matchesGuid(data, offset + 24, AsfGuid.VIDEO_STREAM);

      const typeSpecificDataLength = readUInt32LE(data, offset + 64);

      // Extract Stream Number from Flags field at offset 72 (2 bytes, little-endian)
      // Bits 0-6 contain the stream number (1-127)
      const flags = data[offset + 72] | (data[offset + 73] << 8);
      const streamNumber = flags & 0x7f; // Extract lower 7 bits

      const typeSpecificDataOffset = offset + 78;
      if (typeSpecificDataOffset + typeSpecificDataLength > data.length) {
        throw new UnsupportedFormatError('Insufficient data for type-specific data');
      }
      const codecPrivate = data.slice(typeSpecificDataOffset, typeSpecificDataOffset + typeSpecificDataLength);
      const info = additionalStreamInfo.get(streamNumber) || ({} as AdditionalStreamInfo);
      info.codecPrivate = codecPrivate;
      additionalStreamInfo.set(streamNumber, info);

      if (isAudio) {
        const formatTag = data[typeSpecificDataOffset] | (data[typeSpecificDataOffset + 1] << 8);
        const channelCount = data[typeSpecificDataOffset + 2] | (data[typeSpecificDataOffset + 3] << 8);
        const sampleRate =
          data[typeSpecificDataOffset + 4] |
          (data[typeSpecificDataOffset + 5] << 8) |
          (data[typeSpecificDataOffset + 6] << 16) |
          (data[typeSpecificDataOffset + 7] << 24);
        const bitsPerSample = data[typeSpecificDataOffset + 14] | (data[typeSpecificDataOffset + 15] << 8);

        const { codec, codecDetail } = interpreteAudioFormatTag(formatTag);

        audioStreams.push({
          id: streamNumber,
          codec,
          codecDetail,
          channelCount,
          sampleRate,
          bitsPerSample,
          durationInSeconds: undefined,
        });
      } else if (isVideo) {
        const encodedWidth =
          data[typeSpecificDataOffset] |
          (data[typeSpecificDataOffset + 1] << 8) |
          (data[typeSpecificDataOffset + 2] << 16) |
          (data[typeSpecificDataOffset + 3] << 24);
        const encodedHeight =
          data[typeSpecificDataOffset + 4] |
          (data[typeSpecificDataOffset + 5] << 8) |
          (data[typeSpecificDataOffset + 6] << 16) |
          (data[typeSpecificDataOffset + 7] << 24);

        // Format Data starts at offset 78 + 4 + 4 + 1 + 2 = 78 + 11 = 89
        const formatDataOffset = typeSpecificDataOffset + 11;

        // BITMAPINFOHEADER:
        // - Size (4 bytes)
        // - Width (4 bytes)
        // - Height (4 bytes)
        // - Planes (2 bytes)
        // - BitCount (2 bytes)
        // - Compression (4 bytes) -> Codec

        const compression =
          String.fromCodePoint(data[formatDataOffset + 16]) +
          String.fromCodePoint(data[formatDataOffset + 17]) +
          String.fromCodePoint(data[formatDataOffset + 18]) +
          String.fromCodePoint(data[formatDataOffset + 19]);

        const videoCodec = toVideoCodec(compression);

        videoStreams.push({
          id: streamNumber,
          codec: videoCodec.code,
          codecDetail: compression,
          width: encodedWidth,
          height: encodedHeight,
          durationInSeconds: undefined,
          fps: undefined,
        });
      }

      offset += objectSize;
    } else if (matchesGuid(data, offset, AsfGuid.FILE_PROPERTIES)) {
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

      // Object size (8 bytes, little-endian) at offset 16
      const objectSize = Number(readUInt64LE(data, offset + 16));
      if (offset + objectSize > data.length) throw new UnsupportedFormatError(`Insufficient data for File Properties Object at offset ${offset}`);

      const flags = readUInt32LE(data, offset + 88);
      const broadcastFlag = flags & 1;
      const _seekableFlag = (flags >>> 1) & 1;

      // Capture global props
      filePlayDuration = Number(readUInt64LE(data, offset + 64));
      fileSendDuration = Number(readUInt64LE(data, offset + 72));
      filePreroll = Number(readUInt64LE(data, offset + 80));
      filePacketSize = readUInt32LE(data, offset + 100);

      if (!broadcastFlag) {
        // Specifies the time needed to play the file in 100-nanosecond units.
        const playDuration = readUInt64LE(data, offset + 64);
        // Specifies the amount of time to buffer data before starting to play the file, in millisecond units.
        // If this value is nonzero, the Play Duration field and all of the payload Presentation Time fields
        // have been offset by this amount. Therefore, player software must subtract the value in the preroll
        // field from the play duration and presentation times to calculate their actual values.
        // It follows that all payload Presentation Time fields need to be at least this value.
        const preroll = readUInt64LE(data, offset + 80);

        const durationInSecondsBigInt = playDuration / 10000000n - preroll / 1000n;
        durationInSeconds = Number(durationInSecondsBigInt);
      }

      // Min Data Packet Size (4 bytes) at offset 92
      // Max Data Packet Size (4 bytes) at offset 96
      // In general, the values of these two fields are invalid if the Broadcast Flag bit in the Flags field is set to 1.
      // However, for the purposes of this specification, the values for the Minimum Data Packet Size and
      // Maximum Data Packet Size fields shall be set to the same value, and this value should be set to
      // the packet size, even when the Broadcast Flag in the Flags field is set to 1.
      const minPacketSize = readUInt32LE(data, offset + 92);
      const maxPacketSize = readUInt32LE(data, offset + 96);
      if (minPacketSize !== maxPacketSize) {
        throw new UnsupportedFormatError(
          `Not an ASF file: Min Data Packet Size (${minPacketSize}) and Max Data Packet Size (${maxPacketSize}) are not equal`,
        );
      }
      filePacketSize = maxPacketSize;

      offset += objectSize;
    } else if (matchesGuid(data, offset, AsfGuid.HEADER_EXTENSION)) {
      // Header Extension Object
      const extensionDataSize = readUInt32LE(data, offset + 42);
      if (offset + 46 + extensionDataSize <= data.length) {
        let extOffset = offset + 46;
        const extEnd = extOffset + extensionDataSize;

        while (extOffset + 24 <= extEnd) {
          const extObjSize = Number(readUInt64LE(data, extOffset + 16));
          if (matchesGuid(data, extOffset, AsfGuid.EXTENDED_STREAM_PROPERTIES) && extOffset + 74 <= extEnd) {
            const streamNum = readUInt16LE(data, extOffset + 72);
            const extendedStreamPropertiesObject = data.slice(extOffset, extOffset + extObjSize);
            const info = additionalStreamInfo.get(streamNum) || ({} as AdditionalStreamInfo);
            info.extendedStreamPropertiesObject = extendedStreamPropertiesObject;
            additionalStreamInfo.set(streamNum, info);
          }
          extOffset += extObjSize;
        }
      }
      const objectSize = Number(readUInt64LE(data, offset + 16));
      offset += objectSize;
    } else {
      // Unknown / uninterested object
      // Skip this object - read its size
      const objectSize = Number(readUInt64LE(data, offset + 16));
      offset += objectSize;
    }
  }

  if (audioStreams.length === 0 && videoStreams.length === 0) {
    throw new UnsupportedFormatError('Not an ASF file: could not find any media streams');
  }

  if (durationInSeconds) {
    for (const stream of audioStreams) {
      stream.durationInSeconds = durationInSeconds;
    }

    for (const stream of videoStreams) {
      stream.durationInSeconds = durationInSeconds;
    }
  }

  // Extract payload data if requested - using streaming approach
  if (shouldExtractPayload && options?.onPayload && options?.extractStreams) {
    // Check that what follows the header is the Data Object
    let dataOffset = headerSize;
    if (dataOffset + 50 > firstValue.length) {
      reader.cancel();
      throw new UnsupportedFormatError('Not an ASF file: insufficient data for Data Object');
    }

    const isDataObject = matchesGuid(firstValue, dataOffset, AsfGuid.DATA_OBJECT);
    if (!isDataObject) {
      reader.cancel();
      throw new UnsupportedFormatError('Not an ASF file: Data Object not found after Header');
    }

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

    const dataObjectSize =
      firstValue[dataOffset + 16] | (firstValue[dataOffset + 17] << 8) | (firstValue[dataOffset + 18] << 16) | (firstValue[dataOffset + 19] << 24);
    const dataObjectEnd = dataOffset + dataObjectSize;

    // Initialize packet buffer with remaining data from first chunk
    dataOffset += 50;
    let packetBuffer = firstValue.slice(dataOffset);

    // Process packets in a loop
    while (dataOffset < dataObjectEnd) {
      // Keep reading chunks until packetBuffer is > 64KB or stream ends
      while (packetBuffer.length < 65536) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        // Append new data to packet buffer
        const newBuffer = new Uint8Array(packetBuffer.length + value.length);
        newBuffer.set(packetBuffer, 0);
        newBuffer.set(value, packetBuffer.length);
        packetBuffer = newBuffer;
      }

      // If no data in buffer, we're done
      if (packetBuffer.length === 0) break;

      // Parse one packet from the buffer
      // Parse one packet from the buffer
      const result = parsePacket(packetBuffer, extractStreamSet, options.onPayload, filePacketSize!);

      if (result.bytesConsumed === 0) {
        throw new Error('The packet is too large or malformed');
      }

      // Remove consumed bytes from packet buffer
      packetBuffer = packetBuffer.slice(result.bytesConsumed);
      dataOffset += result.bytesConsumed;
    }
  }

  reader.cancel();

  return {
    container: 'asf',
    containerDetail: videoStreams.length > 0 ? 'wmv' : 'wma',
    durationInSeconds,
    videoStreams,
    audioStreams,
    additionalStreamInfo,
    fileProperties: {
      playDuration: filePlayDuration!,
      sendDuration: fileSendDuration!,
      preroll: filePreroll!,
      packetSize: filePacketSize!,
    },
  };
}

/**
 * Parse the first ASF Data Packet from the start of a data buffer.
 * @param buffer The buffer starts with the data of a complete ASF Data Packet optionally followed by other Data Packets.
 * @param extractStreamSet Set of stream numbers to extract
 * @param onPayload Callback function for extracted payloads
 * @param fixedPacketSize Optional fixed packet size from File Properties Object (used if Packet Length Type is 0)
 * @returns Object with bytesConsumed (0 if incomplete packet)
 *
 * Below is the data structure of an ASF Data Packet:
 *    +--------------------------+
 *    | Error Correction Data    |  > Optional
 *    +--------------------------+
 *    | Payload Parsing          |
 *    | Information              |
 *    +--------------------------+
 *    |                          |
 *    | Payload Data             |
 *    |                          |
 *    +--------------------------+
 *    | Padding Data             |  > Optional
 *    +--------------------------+
 *
 *                Or
 *
 *    +--------------------------+
 *    | Error Correction Data    |  > Optional
 *    +--------------------------+
 *    |                          |
 *    | Opaque Data              |
 *    |                          |
 *    +--------------------------+
 *    | Padding Data             |  > Optional
 *    +--------------------------+
 */
function parsePacket(
  buffer: Uint8Array,
  extractStreamSet: Set<number>,
  onPayload: OnPayloadCallback,
  fixedPacketSize?: number,
): { bytesConsumed: number } {
  let offset = 0;

  // 5.2.1 Error Correction Data
  let errorCorrectionOrLengthTypeFlags = buffer[offset++];

  let errorCorrectionDataLength = 0;
  const errorCorrectionPresent = (errorCorrectionOrLengthTypeFlags & 0x80) !== 0;
  if (errorCorrectionPresent) {
    // Bits 5-6: Error Correction Length Type
    // Bit 4: Opaque Data Present
    // We expect them to be 0 for the standard "0x82" case (Compact Error Correction).
    const errorCorrectionLengthType = (errorCorrectionOrLengthTypeFlags >> 5) & 0x03;
    const opaqueDataPresent = (errorCorrectionOrLengthTypeFlags >> 4) & 0x01;

    if (errorCorrectionLengthType !== 0 || opaqueDataPresent !== 0) {
      throw new UnsupportedFormatError(
        `Invalid ASF Data Packet: Unsupported Error Correction Flags: 0x${errorCorrectionOrLengthTypeFlags.toString(16)}`,
      );
    }
    errorCorrectionDataLength = errorCorrectionOrLengthTypeFlags & 0x0f;
    if (errorCorrectionDataLength !== 2) {
      throw new UnsupportedFormatError(`Invalid ASF Data Packet: InvalidError Correction Data Length: ${errorCorrectionDataLength}`);
    }
    offset += errorCorrectionDataLength;
    errorCorrectionOrLengthTypeFlags = buffer[offset++];
  }

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

  // Length Type Flags
  const lengthTypeFlags = errorCorrectionOrLengthTypeFlags;
  const multiplePayloadsPresent = (lengthTypeFlags & 0x01) !== 0;
  const sequenceType = (lengthTypeFlags >> 1) & 0x03;
  const paddingLengthType = (lengthTypeFlags >> 3) & 0x03;
  const packetLengthType = (lengthTypeFlags >> 5) & 0x03;

  // Property Flags
  const propertyFlags = buffer[offset++];
  const replicatedDataLengthType = propertyFlags & 0x03;
  const offsetIntoMediaObjectLengthType = (propertyFlags >> 2) & 0x03;
  const mediaObjectNumberLengthType = (propertyFlags >> 4) & 0x03;
  const streamNumberLengthType = (propertyFlags >> 6) & 0x03;
  if (streamNumberLengthType !== 1)
    throw new UnsupportedFormatError(`Invalid ASF Data Packet: Invalid Stream Number Length Type: ${streamNumberLengthType}`);

  // Packet Length = (Size of Error Correction Data) + (Size of Payload Parsing Information) + (Size of All Payloads) + (Size of Padding Data)
  // Packet Length = (Size of Error Correction Data) + (Size of Payload Parsing Information) + (Size of All Payloads) + (Size of Padding Data)
  const packetLengthResult = readVarLengthField(buffer, offset, packetLengthType);
  let packetLength = packetLengthResult.value;
  if (packetLengthType === 0 && fixedPacketSize) {
    packetLength = fixedPacketSize;
  }
  offset += packetLengthResult.size;

  // Sequence
  const sequenceResult = readVarLengthField(buffer, offset, sequenceType);
  offset += sequenceResult.size;

  // Padding Length
  const paddingResult = readVarLengthField(buffer, offset, paddingLengthType);
  const paddingLength = paddingResult.value;
  offset += paddingResult.size;

  // Send Time (4 bytes)
  if (offset + 4 > buffer.length)
    throw new UnsupportedFormatError(`Invalid ASF Data Packet: insufficient data for send time: ${offset} + 4 > ${buffer.length}`);
  const packetSendTime = readUInt32LE(buffer, offset);
  offset += 4;

  // Duration (2 bytes)
  if (offset + 2 > buffer.length)
    throw new UnsupportedFormatError(`Invalid ASF Data Packet: insufficient data for duration: ${offset} + 2 > ${buffer.length}`);
  const packetDuration = readUInt16LE(buffer, offset);
  offset += 2;

  // 5.2.3 Payload Data
  let numPayloads = 1;
  let payloadLengthType = 0;

  if (multiplePayloadsPresent) {
    if (offset + 1 >= buffer.length)
      throw new UnsupportedFormatError(`Invalid ASF Data Packet: insufficient data for multi-payload flags: ${offset} + 1 > ${buffer.length}`);
    const payloadFlags = buffer[offset++];
    numPayloads = payloadFlags & 0x3f;
    payloadLengthType = (payloadFlags >> 6) & 0x03;

    for (let p = 0; p < numPayloads; p++) {
      // Conservative check: ensure we have at least minimum bytes for payload header
      // Stream Number (1) + variable-length fields
      const minBytesNeeded =
        1 + calculateFieldSizes(mediaObjectNumberLengthType, offsetIntoMediaObjectLengthType, replicatedDataLengthType, payloadLengthType);

      if (offset + minBytesNeeded > buffer.length) {
        throw new UnsupportedFormatError(
          `Invalid ASF Data Packet: insufficient data for payload ${p}: need at least ${minBytesNeeded} bytes at offset ${offset}, but only ${buffer.length - offset} available`,
        );
      }

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

      // Stream Number
      const streamNumberByte = buffer[offset++];
      const streamNumber = streamNumberByte & 0x7f;
      const isKeyFrame = (streamNumberByte & 0x80) !== 0;

      // Media Object Number
      // For Video (WMV): A "Media Object" is one single Video Frame.
      // For Audio (WMA): A "Media Object" is one single Superframe (a compressed block of audio).
      const mediaObjectNumberResult = readVarLengthField(buffer, offset, mediaObjectNumberLengthType);
      const mediaObjectNumber = mediaObjectNumberResult.value;
      offset += mediaObjectNumberResult.size;

      // Offset Into Media Object, or Presentation Time for compressed payloads
      // In ASF, a single logical unit of content, known as a Media Object (e.g., a single
      // video frame or WMA superframe), can be very large.
      // Since the ASF data packets are fixed and often smaller than the frame (e.g., a 10KB
      // video frame split across three 4KB packets), the frame must be fragmented.
      // When a single Media Object is split across multiple payloads, the decoder needs to
      // know where each payload fits to correctly reassemble the complete frame.
      const offsetIntoMediaObjectOrPresentationTimeResult = readVarLengthField(buffer, offset, offsetIntoMediaObjectLengthType);
      const offsetIntoMediaObject = offsetIntoMediaObjectOrPresentationTimeResult.value;
      offset += offsetIntoMediaObjectOrPresentationTimeResult.size;

      // Replicated Data Length
      const replicatedDataLengthResult = readVarLengthField(buffer, offset, replicatedDataLengthType);
      offset += replicatedDataLengthResult.size;
      const isCompressedPayload = replicatedDataLengthResult.value === 1;

      if (isCompressedPayload) {
        // Presentation Time Delta
        const presentationTimeDelta = buffer[offset++];
        const replicatedData = new Uint8Array([presentationTimeDelta]);

        // Payload Data Length - Specifies the number of bytes in the Sub-Payload Data array
        const payloadDataLengthResult = readVarLengthField(buffer, offset, payloadLengthType);
        offset += payloadDataLengthResult.size;
        const payloadDataLength = payloadDataLengthResult.value;

        // Sub-payloads
        const beyondPayloadData = offset + payloadDataLength;
        while (offset < beyondPayloadData) {
          const subPayloadDataLength = buffer[offset++];
          const subPayloadStreamNumber = buffer[offset]; // This is usually same as streamNumber? Or can be different?
          // Actually subPayloadStreamNumber is just the stream number again?
          // Spec says "Stream Number".
          // Let's check if we should filter by it.

          if (extractStreamSet.has(subPayloadStreamNumber)) {
            const subPayloadData = buffer.slice(offset, offset + subPayloadDataLength);
            onPayload(
              subPayloadStreamNumber,
              subPayloadData,
              {
                isMultiPayload: true,
                isSubPayload: true,
                isCompressedPayload,
                isKeyFrame,
                packetSendTime,
                packetDuration,
                mediaObjectNumber,
                offsetIntoMediaObjectOrPresentationTime: offsetIntoMediaObject,
              },
              replicatedData,
            );
          }
          offset += subPayloadDataLength;
        }
      } else {
        // Replicated Data
        const replicatedDataLength = replicatedDataLengthResult.value;
        const replicatedData = buffer.slice(offset, offset + replicatedDataLength);
        offset += replicatedDataLength;

        // Payload Data Length
        const payloadDataLengthResult = readVarLengthField(buffer, offset, payloadLengthType);
        offset += payloadDataLengthResult.size;
        const payloadDataLength = payloadDataLengthResult.value;

        // Payload Data
        if (extractStreamSet.has(streamNumber)) {
          const payloadData = buffer.slice(offset, offset + payloadDataLength);
          onPayload(
            streamNumber,
            payloadData,
            {
              isMultiPayload: true,
              isSubPayload: false,
              isCompressedPayload,
              isKeyFrame,
              packetSendTime,
              packetDuration,
              mediaObjectNumber,
              offsetIntoMediaObjectOrPresentationTime: offsetIntoMediaObject,
            },
            replicatedData,
          );
        }
        offset += payloadDataLength;
      }
    }
    offset += paddingLength;
    return { bytesConsumed: offset };
  } else {
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

    // Single payload
    // Stream Number (with keyframe flag in bit 7)
    const streamNumberByte = buffer[offset++];
    const streamNumber = streamNumberByte & 0x7f;
    const isKeyFrame = (streamNumberByte & 0x80) !== 0;

    // Media Object Number
    const mediaObjectNumberResult = readVarLengthField(buffer, offset, mediaObjectNumberLengthType);
    const mediaObjectNumber = mediaObjectNumberResult.value;
    offset += mediaObjectNumberResult.size;

    // Offset Into Media Object, or Presentation Time for compressed payload data
    const offsetIntoMediaObjectOrPresentationTimeResult = readVarLengthField(buffer, offset, offsetIntoMediaObjectLengthType);
    const offsetIntoMediaObject = offsetIntoMediaObjectOrPresentationTimeResult.value;
    offset += offsetIntoMediaObjectOrPresentationTimeResult.size;

    // Replicated Data Length
    const replicatedDataLengthResult = readVarLengthField(buffer, offset, replicatedDataLengthType);
    offset += replicatedDataLengthResult.size;
    const isCompressedPayload = replicatedDataLengthResult.value === 1;

    if (isCompressedPayload) {
      // Presentation Time Delta
      const presentationTimeDelta = buffer[offset++];
      const replicatedData = new Uint8Array([presentationTimeDelta]);

      // Sub-payloads
      const beyondPayloadData = packetLength - paddingLength;
      while (offset < beyondPayloadData) {
        const subPayloadDataLength = buffer[offset++];
        const subPayloadStreamNumber = buffer[offset];
        if (extractStreamSet.has(subPayloadStreamNumber)) {
          const subPayloadData = buffer.slice(offset, offset + subPayloadDataLength);
          onPayload(
            subPayloadStreamNumber,
            subPayloadData,
            {
              isMultiPayload: false,
              isSubPayload: true,
              isCompressedPayload,
              isKeyFrame,
              packetSendTime,
              packetDuration,
              mediaObjectNumber,
              offsetIntoMediaObjectOrPresentationTime: offsetIntoMediaObject,
            },
            replicatedData,
          );
        }
        offset += subPayloadDataLength;
      }
    } else {
      // Replicated Data
      const replicatedDataLength = replicatedDataLengthResult.value;
      const replicatedData = buffer.slice(offset, offset + replicatedDataLength);
      offset += replicatedDataLength;

      // Payload Data - everything remaining in the packet except padding
      // The number of bytes in this array can be calculated from the overall Packet Length field,
      // and is equal to the Packet Length minus the packet header length, minus the payload
      // header length (including Replicated Data), minus the Padding Length.
      const payloadDataLength = packetLength - offset - paddingLength;
      if (offset + payloadDataLength > buffer.length) {
        throw new UnsupportedFormatError(
          `Invalid ASF Data Packet: insufficient data for single payload: ${offset} + ${payloadDataLength} > ${buffer.length}`,
        );
      }

      // Payload data
      if (extractStreamSet.has(streamNumber)) {
        const payloadData = buffer.slice(offset, offset + payloadDataLength);
        onPayload(
          streamNumber,
          payloadData,
          {
            isMultiPayload: false,
            isSubPayload: false,
            isCompressedPayload,
            isKeyFrame,
            packetSendTime,
            packetDuration,
            mediaObjectNumber,
            offsetIntoMediaObjectOrPresentationTime: offsetIntoMediaObject,
          },
          replicatedData,
        );
      }
      offset += payloadDataLength;
    }

    // Skip padding
    offset += paddingLength;

    return { bytesConsumed: offset };
  }
}
