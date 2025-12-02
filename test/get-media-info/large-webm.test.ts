import { describe, expect, it } from '@jest/globals';

import { getMediaInfoFromFile } from '../../src/get-media-info';
import { MediaInfo } from '../../src/media-info';
import { sampleFile } from '../test-utils';

describe('getMediaInfo with large WebM files', () => {
  it('should parse large_TearsOfSteel.webm with vp8 video and vorbis audio', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_TearsOfSteel.webm'));

    expect(info).toEqual({
      parser: 'media-utils',
      container: 'webm',
      containerDetail: 'webm',
      durationInSeconds: expect.closeTo(734, 0) as any,
      videoStreams: [
        {
          id: 1,
          codec: 'vp8',
          codecDetail: 'V_VP8',
          width: 1920,
          height: 800,
          durationInSeconds: expect.closeTo(734, 0) as any,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'vorbis',
          codecDetail: 'A_VORBIS',
          channelCount: 2,
          sampleRate: 48000,
          bitsPerSample: undefined,
          durationInSeconds: expect.closeTo(734, 0) as any,
        },
      ],
    } as MediaInfo);
  }, 10000); // 10 second timeout for large file
});
