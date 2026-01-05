import { expect } from '@jest/globals';

import { GetMediaInfoTestCase } from '../test-utils';

export const largeMp4TestCases: GetMediaInfoTestCase[] = [
  {
    filename: 'large_TearsOfSteel.mp4',
    expectedMediaInfo: {
      bytesRead: 223084,
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
    },
  },
];
