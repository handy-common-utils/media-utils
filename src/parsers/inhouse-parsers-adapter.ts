import { withRetry } from '@handy-common-utils/promise-utils';

import { GetMediaInfoOptions } from '../get-media-info';
import { MediaInfo } from '../media-info';
import { parseAac } from './aac';
import { MediaParserAdapter, ParsingError } from './adapter';
import { parseMp3 } from './mp3';
import { parseWebm } from './webm';

/**
 * In-house parser adapter for audio files with simple headers.
 * Currently supports:
 * - AAC files with ADTS headers
 * - MP3 files with frame headers
 */
export class InhouseParserAdapter implements MediaParserAdapter {
  private readonly parsers = [parseMp3, parseAac, parseWebm];

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
