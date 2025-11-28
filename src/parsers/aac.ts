import { parseADTSHeader } from '../codecs/aac';
import { GetMediaInfoOptions } from '../get-media-info';
import { MediaInfo } from '../media-info';
import { UnsupportedFormatError } from '../utils';

/**
 * Parses AAC file from a stream and extracts media information.
 * Note: The returned MediaInfo does not include the 'parser' field,
 * which should be set by the adapter.
 *
 * @param stream The input media stream
 * @param _options Optional options for the parser
 * @returns Media information without the parser field
 * @throws UnsupportedFormatError if the stream is not a valid AAC file
 */
export async function parseAac(stream: ReadableStream<Uint8Array>, _options?: GetMediaInfoOptions): Promise<Omit<MediaInfo, 'parser'>> {
  // Read the first chunk to parse the ADTS header
  const reader = stream.getReader();
  const { value } = await reader.read();
  reader.cancel();

  if (!value) {
    throw new UnsupportedFormatError('Not an AAC file: insufficient data');
  }

  // Parse ADTS header using the AAC-specific parser
  const audioStream = parseADTSHeader(value);

  return {
    container: 'aac',
    containerDetail: 'aac',
    durationInSeconds: undefined,
    videoStreams: [],
    audioStreams: [audioStream],
  };
}
