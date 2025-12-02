import { describe, expect, it } from '@jest/globals';

import { getMediaInfoFromFile } from '../../src/get-media-info';
import { MediaInfo } from '../../src/media-info';
import { sampleFile } from '../test-utils';

describe('getMediaInfo with large AVI files', () => {
  it('should parse large_BigBuckBunny_surround.avi file with MPEG-4 video and AC-3 audio', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_BigBuckBunny_surround.avi'));
    expect(info).toEqual({
      parser: 'media-utils',
      container: 'avi',
      containerDetail: 'avi',
      durationInSeconds: expect.closeTo(596, 0) as any,
      videoStreams: [
        {
          id: 1,
          codec: 'mpeg4',
          codecDetail: 'FMP4',
          width: 1280,
          height: 720,
          fps: expect.closeTo(24, 0) as any,
          durationInSeconds: expect.closeTo(596, 0) as any,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'ac3',
          codecDetail: 'AC-3 (0x2000)',
          channelCount: 5,
          sampleRate: 48000,
          bitrate: 448000,
          bitsPerSample: undefined,
          durationInSeconds: expect.closeTo(596, 0) as any,
        },
      ],
    } as MediaInfo);
  });
});
