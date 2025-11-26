import { GetMediaInfoOptions } from '../get-media-info';
import { AudioStreamInfo, MediaInfo } from '../media-info';
import { UnsupportedFormatError } from './adapter';

/**
 * Parses WMA file from a stream and extracts media information.
 * WMA files use ASF (Advanced Systems Format) container.
 *
 * @param stream The input media stream
 * @param _options Optional options for the parser
 * @returns Media information without the parser field
 * @throws UnsupportedFormatError if the stream is not a valid WMA file
 */
export async function parseWma(stream: ReadableStream<Uint8Array>, _options?: GetMediaInfoOptions): Promise<Omit<MediaInfo, 'parser'>> {
  const reader = stream.getReader();
  const { done, value } = await reader.read();
  reader.cancel();

  if (done || !value || value.length < 30) {
    throw new UnsupportedFormatError('Not a WMA file: insufficient data');
  }

  // Check ASF header GUID: 30 26 B2 75 8E 66 CF 11 A6 D9 00 AA 00 62 CE 6C
  const asfHeaderGuid = [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c];
  for (let i = 0; i < 16; i++) {
    if (value[i] !== asfHeaderGuid[i]) {
      throw new UnsupportedFormatError('Not a WMA file: missing ASF header GUID');
    }
  }

  // Parse header object size (8 bytes, little-endian)
  // JavaScript can't handle 64-bit integers well, so we only use the lower 32 bits
  const headerSize = value[16] | (value[17] << 8) | (value[18] << 16) | (value[19] << 24);

  // Number of header objects (4 bytes, little-endian)
  const numObjects = value[24] | (value[25] << 8) | (value[26] << 16) | (value[27] << 24);

  if (numObjects === 0 || headerSize < 30) {
    throw new UnsupportedFormatError('Not a WMA file: invalid header');
  }

  // Stream Properties Object GUID as it appears in the file
  // Note: GUIDs in ASF have mixed endianness - first 3 fields are little-endian
  const streamPropertiesGuid = [0x91, 0x07, 0xdc, 0xb7, 0xb7, 0xa9, 0xcf, 0x11, 0x8e, 0xe6, 0x00, 0xc0, 0x0c, 0x20, 0x53, 0x65];

  //  Scan for Stream Properties Object
  let offset = 30;
  let channelCount = 0;
  let sampleRate = 0;
  let codec = 'wmav2';
  let codecDetail = 'wmav2';

  while (offset + 24 < value.length && offset < headerSize) {
    // Check if this is a Stream Properties Object
    let isStreamProperties = true;
    for (let i = 0; i < 16; i++) {
      if (value[offset + i] !== streamPropertiesGuid[i]) {
        isStreamProperties = false;
        break;
      }
    }

    if (isStreamProperties) {
      // Object size (8 bytes, little-endian) at offset 16
      const objectSize = value[offset + 16] | (value[offset + 17] << 8) | (value[offset + 18] << 16) | (value[offset + 19] << 24);

      // Stream Type GUID at offset 24 (16 bytes)
      // Audio Stream GUID as it appears in the file (with mixed endianness)
      const audioStreamGuid = [0x40, 0x9e, 0x69, 0xf8, 0x4d, 0x5b, 0xcf, 0x11, 0xa8, 0xfd, 0x00, 0x80, 0x5f, 0x5c, 0x44, 0x2b];
      let isAudio = true;
      for (let i = 0; i < 16; i++) {
        if (value[offset + 24 + i] !== audioStreamGuid[i]) {
          isAudio = false;
          break;
        }
      }

      if (isAudio && offset + 78 < value.length) {
        // According to ASF spec, Type-Specific Data starts at byte 78 of Stream Properties Object
        // WAVEFORMATEX structure:
        // - Format Tag (2 bytes) at offset 0
        // - Channels (2 bytes) at offset 2
        // - Samples Per Sec (4 bytes) at offset 4
        const typeSpecificDataOffset = offset + 78;
        channelCount = value[typeSpecificDataOffset + 2] | (value[typeSpecificDataOffset + 3] << 8);
        sampleRate =
          value[typeSpecificDataOffset + 4] |
          (value[typeSpecificDataOffset + 5] << 8) |
          (value[typeSpecificDataOffset + 6] << 16) |
          (value[typeSpecificDataOffset + 7] << 24);
        break;
      }

      offset += objectSize;
    } else {
      // Skip this object - read its size
      const objectSize = value[offset + 16] | (value[offset + 17] << 8) | (value[offset + 18] << 16) | (value[offset + 19] << 24);
      offset += objectSize;
    }
  }

  if (sampleRate === 0 || channelCount === 0) {
    throw new UnsupportedFormatError('Not a WMA file: could not find audio stream properties');
  }

  const audioStream: AudioStreamInfo = {
    id: 1,
    codec: codec as any,
    codecDetail,
    channelCount,
    sampleRate,
    durationInSeconds: undefined, // Would need to parse File Properties Object for duration
  };

  return {
    container: 'asf' as any,
    containerDetail: 'wma',
    durationInSeconds: undefined,
    videoStreams: [],
    audioStreams: [audioStream],
  };
}
