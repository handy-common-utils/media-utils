import { describe, expect, it } from '@jest/globals';

import { getMediaInfoFromFile } from '../../src/get-media-info';
import { MediaInfo } from '../../src/media-info';
import { sampleFile } from '../test-utils';

describe('getMediaInfo with large MOV files', () => {
  it('should parse large_TearsOfSteel.mov with h264 video and mp3 audio', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_TearsOfSteel.mov'));

    expect(info).toEqual({
      parser: 'media-utils',
      container: 'mov',
      containerDetail: 'qt  , qt  ',
      durationInSeconds: expect.closeTo(734, 0) as any,
      videoStreams: [
        {
          id: 1,
          codec: 'h264',
          codecDetail: 'avc1.4d4028',
          width: 1920,
          height: 800,
          fps: 24,
          bitrate: expect.closeTo(6162664, -4) as any,
          durationInSeconds: expect.closeTo(734, 0) as any,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'mp3',
          codecDetail: '.mp3',
          channelCount: 2,
          sampleRate: 44100,
          bitrate: expect.closeTo(192000, -3) as any,
          durationInSeconds: expect.closeTo(734, 0) as any,
        },
      ],
    } as MediaInfo);
  }, 10000);
});
