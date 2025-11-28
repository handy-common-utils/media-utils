import { GetMediaInfoOptions } from '../get-media-info';
import { AudioStreamInfo, MediaInfo } from '../media-info';
import { UnsupportedFormatError } from '../utils';

/**
 * Parses OGG file from a stream and extracts media information.
 * OGG files use page-based container format that can contain Vorbis, Opus, or other codecs.
 *
 * @param stream The input media stream
 * @param _options Optional options for the parser
 * @returns Media information without the parser field
 * @throws UnsupportedFormatError if the stream is not a valid OGG file
 */
export async function parseOgg(stream: ReadableStream<Uint8Array>, _options?: GetMediaInfoOptions): Promise<Omit<MediaInfo, 'parser'>> {
  const reader = stream.getReader();
  const { done, value } = await reader.read();
  reader.cancel();

  if (done || !value || value.length < 27) {
    throw new UnsupportedFormatError('Not an OGG file: insufficient data');
  }

  // Check OGG page header ("OggS")
  if (value[0] !== 0x4f || value[1] !== 0x67 || value[2] !== 0x67 || value[3] !== 0x53) {
    throw new UnsupportedFormatError('Not an OGG file: missing OggS signature');
  }

  // Version (should be 0)
  if (value[4] !== 0) {
    throw new UnsupportedFormatError('Not an OGG file: unsupported version');
  }

  // Skip to segment table
  const numSegments = value[26];
  if (value.length < 27 + numSegments) {
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
  if (value.length >= payloadOffset + 7) {
    const packetType = value[payloadOffset];
    // eslint-disable-next-line unicorn/prefer-code-point
    const codecStr = String.fromCharCode(
      value[payloadOffset + 1],
      value[payloadOffset + 2],
      value[payloadOffset + 3],
      value[payloadOffset + 4],
      value[payloadOffset + 5],
      value[payloadOffset + 6],
    );

    if (packetType === 1 && codecStr === 'vorbis') {
      codec = 'vorbis';
      codecDetail = 'vorbis';

      // Parse Vorbis identification header
      if (value.length >= payloadOffset + 30) {
        // Version (4 bytes, little-endian) at offset 7
        // Channels (1 byte) at offset 11
        channelCount = value[payloadOffset + 11];
        // Sample rate (4 bytes, little-endian) at offset 12
        sampleRate =
          value[payloadOffset + 12] | (value[payloadOffset + 13] << 8) | (value[payloadOffset + 14] << 16) | (value[payloadOffset + 15] << 24);
      }
    } else if (value.length >= payloadOffset + 8) {
      // Check for "OpusHead"  (8 bytes)
      // eslint-disable-next-line unicorn/prefer-code-point
      const opusHeader = String.fromCharCode(
        value[payloadOffset],
        value[payloadOffset + 1],
        value[payloadOffset + 2],
        value[payloadOffset + 3],
        value[payloadOffset + 4],
        value[payloadOffset + 5],
        value[payloadOffset + 6],
        value[payloadOffset + 7],
      );

      if (opusHeader === 'OpusHead') {
        codec = 'opus';
        codecDetail = 'opus';

        // Parse Opus identification header
        if (value.length >= payloadOffset + 19) {
          // Version (1 byte) at offset 8
          // Channel count (1 byte) at offset 9
          channelCount = value[payloadOffset + 9];
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
  };
}
