import { withRetry } from '@handy-common-utils/promise-utils';

import { GetMediaInfoOptions } from '../get-media-info';
import { MediaInfo } from '../media-info';
import { ParsingError } from '../utils';
import { parseAac } from './aac';
import { MediaParserAdapter } from './adapter';
import { parseAsf } from './asf';
import { parseMkv } from './mkv';
import { parseMp3 } from './mp3';
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
 * - WMA/WMV files with ASF headers
 */
export class InhouseParserAdapter implements MediaParserAdapter {
  private readonly parsers = [parseMp3, parseAac, parseMkv, parseWav, parseOgg, parseAsf];

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
