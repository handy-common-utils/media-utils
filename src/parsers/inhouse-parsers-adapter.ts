import { delayedResolve, withRetry } from '@handy-common-utils/promise-utils';

import { GetMediaInfoOptions, GetMediaInfoResult } from '../get-media-info';
import { createRandomAccessInput } from '../input-streams';
import { isBlobInput, MediaInput, ParsingError } from '../utils';
import { parseAac } from './aac';
import { MediaParserAdapter } from './adapter';
import { parseAsf } from './asf';
import { parseAvi } from './avi';
import { parseMkv } from './mkv';
import { parseMp3 } from './mp3';
import { parseMp4 } from './mp4';
import { parseMpegTs } from './mpegts';
import { parseMxf } from './mxf';
import { parseOgg } from './ogg';
import { parseWav } from './wav';

/**
 * In-house parser adapter for audio files with simple headers.
 * Currently supports:
 * - AAC files with ADTS headers
 * - MP3 files with frame headers
 * - MKV/WebM files with EBML headers
 * - WAV files with RIFF headers
 * - OGG files with page headers (Vorbis, Opus)
 * - AVI files with RIFF headers
 * - ASF/WMA/WMV files with ASF headers
 * - MPEG-TS files with TS packets
 * - MP4 files with ISO BMFF atoms
 */
export class InhouseParserAdapter implements MediaParserAdapter {
  private readonly parsers = [parseMp4, parseMp3, parseAac, parseMkv, parseWav, parseOgg, parseAvi, parseAsf, parseMxf, parseMpegTs];

  async parse(input: MediaInput, options?: GetMediaInfoOptions): Promise<GetMediaInfoResult> {
    if (isBlobInput(input)) {
      return this.parseBlob(input, options);
    }
    let stream = input;
    let i = 0;
    try {
      const info = await withRetry(
        () => {
          const [s1, s2] = stream.tee();
          stream = s1;
          return this.parsers[i++](s2, options);
        },
        () => 0,
        (error) => i < this.parsers.length && (error as ParsingError)?.isUnsupportedFormatError === true,
      );
      return {
        ...info,
        parser: 'media-utils',
      };
    } finally {
      // Node.js could keep pumping data to the stream for a very short period after the reader has been cancelled.
      // Let's wait for a while to ensure that data pumping has actually stopped.
      delayedResolve(800, () => stream.cancel().catch(() => {}));
    }
  }

  /**
   * Parses a Blob. Every parsing attempt opens its own stream(s) from the Blob, so nothing needs to be teed or buffered.
   * Parsers that support random access (currently the MP4/MOV parser) can skip data without reading it.
   * @param blob The input Blob
   * @param options Options for the parsers
   * @returns The media information
   */
  private async parseBlob(blob: Blob, options?: GetMediaInfoOptions): Promise<GetMediaInfoResult> {
    let i = 0;
    const info = await withRetry(
      async () => {
        // The limit applies to each attempt
        const randomAccess = createRandomAccessInput(blob, { bytesRead: 0, maxBytesToRead: options?.maxBytesToRead });
        try {
          return await this.parsers[i++](randomAccess.streamFrom(0), { ...options, randomAccess } as GetMediaInfoOptions);
        } finally {
          // Not all parsers cancel their streams
          randomAccess.close();
        }
      },
      () => 0,
      (error) => i < this.parsers.length && (error as ParsingError)?.isUnsupportedFormatError === true,
    );
    return {
      ...info,
      parser: 'media-utils',
    };
  }
}
