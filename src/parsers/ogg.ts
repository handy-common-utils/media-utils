import { GetMediaInfoOptions, GetMediaInfoResult } from '../get-media-info';
import { AudioStreamInfo } from '../media-info';
import { readBeginning, UnsupportedFormatError } from '../utils';

/**
 * Parses OGG file from a stream and extracts media information.
 * OGG files use page-based container format that can contain Vorbis, Opus, or other codecs.
 *
 * @param stream The input media stream
 * @param _options Optional options for the parser
 * @returns Media information without the parser field
 * @throws UnsupportedFormatError if the stream is not a valid OGG file
 */
export async function parseOgg(stream: ReadableStream<Uint8Array>, _options?: GetMediaInfoOptions): Promise<Omit<GetMediaInfoResult, 'parser'>> {
  const reader = stream.getReader();
  const buffer = await readBeginning(reader);

  if (!buffer || buffer.length < 27) {
    throw new UnsupportedFormatError('Not an OGG file: insufficient data');
  }

  // Check OGG page header ("OggS")
  if (buffer[0] !== 0x4f || buffer[1] !== 0x67 || buffer[2] !== 0x67 || buffer[3] !== 0x53) {
    throw new UnsupportedFormatError('Not an OGG file: missing OggS signature');
  }

  // Version (should be 0)
  if (buffer[4] !== 0) {
    throw new UnsupportedFormatError('Not an OGG file: unsupported version');
  }

  // Skip to segment table
  const numSegments = buffer[26];
  if (buffer.length < 27 + numSegments) {
    throw new UnsupportedFormatError('Not an OGG file: incomplete segment table');
  }

  // Calculate payload offset
  let payloadOffset = 27 + numSegments;

  // Detect codec from identification header
  let codec = 'unknown';
  let codecDetail = 'unknown';
  let sampleRate = 0;
  let channelCount = 0;

  // Check for Vorbis
  if (buffer.length >= payloadOffset + 7) {
    const packetType = buffer[payloadOffset];
    // eslint-disable-next-line unicorn/prefer-code-point
    const codecStr = String.fromCharCode(
      buffer[payloadOffset + 1],
      buffer[payloadOffset + 2],
      buffer[payloadOffset + 3],
      buffer[payloadOffset + 4],
      buffer[payloadOffset + 5],
      buffer[payloadOffset + 6],
    );

    if (packetType === 1 && codecStr === 'vorbis') {
      codec = 'vorbis';
      codecDetail = 'vorbis';

      // Parse Vorbis identification header
      if (buffer.length >= payloadOffset + 30) {
        // Version (4 bytes, little-endian) at offset 7
        // Channels (1 byte) at offset 11
        channelCount = buffer[payloadOffset + 11];
        // Sample rate (4 bytes, little-endian) at offset 12
        sampleRate =
          buffer[payloadOffset + 12] | (buffer[payloadOffset + 13] << 8) | (buffer[payloadOffset + 14] << 16) | (buffer[payloadOffset + 15] << 24);
      }
    } else if (buffer.length >= payloadOffset + 8) {
      // Check for "OpusHead"  (8 bytes)
      // eslint-disable-next-line unicorn/prefer-code-point
      const opusHeader = String.fromCharCode(
        buffer[payloadOffset],
        buffer[payloadOffset + 1],
        buffer[payloadOffset + 2],
        buffer[payloadOffset + 3],
        buffer[payloadOffset + 4],
        buffer[payloadOffset + 5],
        buffer[payloadOffset + 6],
        buffer[payloadOffset + 7],
      );

      if (opusHeader === 'OpusHead') {
        codec = 'opus';
        codecDetail = 'opus';

        // Parse Opus identification header
        if (buffer.length >= payloadOffset + 19) {
          // Version (1 byte) at offset 8
          // Channel count (1 byte) at offset 9
          channelCount = buffer[payloadOffset + 9];
          // Opus always uses 48000 Hz internally
          sampleRate = 48000;
        }
      }
    }
  }

  if (codec === 'unknown') {
    throw new UnsupportedFormatError('Not a supported OGG file: unknown codec');
  }

  const audioStream: AudioStreamInfo = {
    id: 1,
    codec: codec as any,
    codecDetail,
    channelCount,
    sampleRate,
    durationInSeconds: undefined, // Would need to scan pages to calculate
  };

  return {
    container: 'ogg' as any,
    containerDetail: 'ogg',
    durationInSeconds: undefined,
    videoStreams: [],
    audioStreams: [audioStream],
    bytesRead: buffer.length,
  };
}
