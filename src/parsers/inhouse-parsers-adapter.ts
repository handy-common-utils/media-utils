import { MediaInfo } from '../media-info';
import { parseAac } from './aac';
import { MediaParserAdapter, ParsingError } from './adapter';

/**
 * In-house parser adapter for AAC files with ADTS headers.
 * This adapter parses ADTS (Audio Data Transport Stream) formatted AAC files
 * and extracts metadata from the ADTS header.
 */
export class InhouseParserAdapter implements MediaParserAdapter {
  async parse(stream: ReadableStream<Uint8Array>): Promise<MediaInfo> {
    try {
      const mediaInfo = await parseAac(stream);
      return {
        ...mediaInfo,
        parser: 'inhouse',
      };
    } catch (error) {
      const msg = (error as Error)?.message;
      if (msg && /^(Unsupported format|Invalid ADTS|Not an AAC)/.test(msg)) {
        (error as ParsingError).isUnsupportedFormatError = true;
      }
      throw error;
    }
  }
}
