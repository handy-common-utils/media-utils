import { parseADTSHeader } from '../codecs/aac';
import { GetMediaInfoOptions, GetMediaInfoResult } from '../get-media-info';
import { readBeginning, setupGlobalLogger, UnsupportedFormatError } from '../utils';

/**
 * Parses AAC file from a stream and extracts media information.
 * Note: The returned MediaInfo does not include the 'parser' field,
 * which should be set by the adapter.
 *
 * @param stream The input media stream
 * @param options Optional options for the parser
 * @returns Media information without the parser field
 * @throws UnsupportedFormatError if the stream is not a valid AAC file
 */
export async function parseAac(stream: ReadableStream<Uint8Array>, options?: GetMediaInfoOptions): Promise<Omit<GetMediaInfoResult, 'parser'>> {
  // Read the first chunk to parse the ADTS header
  const logger = setupGlobalLogger(options);
  if (logger.isDebug) logger.debug('Starting parsing AAC');
  // Read the first chunk to parse the ADTS header
  const reader = stream.getReader();
  const buffer = await readBeginning(reader);

  if (!buffer) {
    throw new UnsupportedFormatError('Not an AAC file: insufficient data');
  }

  // Parse ADTS header using the AAC-specific parser
  const audioStream = parseADTSHeader(buffer);

  return {
    container: 'aac',
    containerDetail: 'aac',
    durationInSeconds: undefined,
    videoStreams: [],
    audioStreams: [
      {
        ...audioStream,
        id: 0,
      },
    ],
    bytesRead: buffer.length,
  };
}
