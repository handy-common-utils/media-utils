import { parseMP3Header, parseVBRHeader } from '../codecs/mp3';
import { GetMediaInfoOptions } from '../get-media-info';
import { MediaInfo } from '../media-info';
import { readBeginning, UnsupportedFormatError } from '../utils';

/**
 * Parses MP3 file from a stream and extracts media information.
 * Note: The returned MediaInfo does not include the 'parser' field,
 * which should be set by the adapter.
 *
 * @param stream The input media stream
 * @param _options Optional options for the parser
 * @returns Media information without the parser field
 * @throws UnsupportedFormatError if the stream is not a valid MP3 file
 */
export async function parseMp3(stream: ReadableStream<Uint8Array>, _options?: GetMediaInfoOptions): Promise<Omit<MediaInfo, 'parser'>> {
  // Read the first chunk to parse the MP3 frame header
  const reader = stream.getReader();
  const buffer = await readBeginning(reader);

  if (!buffer || buffer.length === 0) {
    throw new UnsupportedFormatError('Not an MP3 file: insufficient data');
  }

  // Skip ID3v2 tag if present
  let offset = 0;
  if (buffer.length >= 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    // ID3v2 tag found, calculate size and skip it
    // Size is stored in bytes 6-9 as synchsafe integer (7 bits per byte)
    const size = ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) | ((buffer[8] & 0x7f) << 7) | (buffer[9] & 0x7f);
    offset = 10 + size; // 10 byte header + tag size
  }

  if (offset >= buffer.length) {
    throw new UnsupportedFormatError('Not an MP3 file: no frame header found after ID3 tag');
  }

  // Parse MP3 frame header
  const audioStream = parseMP3Header(buffer.slice(offset));

  // Try to extract duration and bitrate from VBR header (Xing/Info/LAME or VBRI)
  let durationInSeconds: number | undefined = undefined;
  let averageBitrate: number | undefined = audioStream.bitrate; // Default to frame header bitrate

  const vbrInfo = parseVBRHeader(buffer.slice(offset));

  if (vbrInfo.totalFrames && audioStream.sampleRate) {
    // Calculate duration from total frames
    // Samples per frame depends on MPEG version and Layer
    // For Layer III:
    // MPEG1: 1152 samples/frame, MPEG2/2.5: 576 samples/frame
    let samplesPerFrame = 1152;
    // version: 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    // Layer: 1 = Layer III
    const header = buffer.slice(offset, offset + 4);
    const version = (header[1] >> 3) & 0x03;
    const layer = (header[1] >> 1) & 0x03;
    switch (layer) {
      case 1: {
        // Layer III
        // eslint-disable-next-line unicorn/prefer-ternary
        if (version === 3) {
          samplesPerFrame = 1152; // MPEG1
        } else {
          samplesPerFrame = 576; // MPEG2/2.5
        }
        break;
      }
      case 2: {
        // Layer II
        samplesPerFrame = 1152;
        break;
      }
      case 3: {
        // Layer I
        samplesPerFrame = 384;
        break;
      }
      // No default
    }
    const totalSamples = vbrInfo.totalFrames * samplesPerFrame;
    durationInSeconds = totalSamples / audioStream.sampleRate;

    // Calculate average bitrate if we have file size
    if (vbrInfo.fileSize && durationInSeconds > 0) {
      // bitrate = (fileSize * 8) / duration
      averageBitrate = Math.round((vbrInfo.fileSize * 8) / durationInSeconds);
    }
  }

  return {
    container: 'mp3',
    containerDetail: 'mp3',
    durationInSeconds,
    videoStreams: [],
    audioStreams: [
      {
        id: 0,
        ...audioStream,
        bitrate: averageBitrate,
        durationInSeconds,
      },
    ],
  };
}
