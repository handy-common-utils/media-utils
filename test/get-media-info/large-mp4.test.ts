import { describe, expect, it } from '@jest/globals';

import { getMediaInfoFromFile } from '../../src/get-media-info';
import { MediaInfo } from '../../src/media-info';
import { sampleFile } from '../test-utils';

describe('getMediaInfo with large MP4 files', () => {
  it('should parse large_TearsOfSteel.mp4 with h264 video and aac audio', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_TearsOfSteel.mp4'));

    expect(info).toEqual({
      parser: 'media-utils',
      container: 'mp4',
      containerDetail: 'mp42, isom, mp42',
      durationInSeconds: expect.closeTo(734, 0) as any,
      videoStreams: [
        {
          id: 1,
          codec: 'h264',
          codecDetail: 'avc1.64001f',
          width: 1280,
          height: 534,
          fps: 24,
          bitrate: expect.closeTo(1830000, -4) as any,
          durationInSeconds: expect.closeTo(734, 0) as any,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'aac',
          codecDetail: 'mp4a.40.02',
          profile: 'LC',
          channelCount: 2,
          sampleRate: 44100,
          bitrate: expect.closeTo(192000, -3) as any,
          durationInSeconds: expect.closeTo(734, 0) as any,
        },
      ],
    } as MediaInfo);
  });
});
