import { withRetry } from '@handy-common-utils/promise-utils';

import { GetMediaInfoOptions } from '../get-media-info';
import { MediaInfo } from '../media-info';
import { ParsingError } from '../utils';
import { parseAac } from './aac';
import { MediaParserAdapter } from './adapter';
import { parseAsf } from './asf';
import { parseAvi } from './avi';
import { parseMkv } from './mkv';
import { parseMp3 } from './mp3';
import { parseMp4 } from './mp4';
import { parseMpegTs } from './mpegts';
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
  private readonly parsers = [parseMp4, parseMp3, parseAac, parseMkv, parseWav, parseOgg, parseAvi, parseAsf, parseMpegTs];

  async parse(stream: ReadableStream<Uint8Array>, options?: GetMediaInfoOptions): Promise<MediaInfo> {
    let i = 0;
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
  }
}
