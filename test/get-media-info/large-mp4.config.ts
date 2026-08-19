import { expect } from '@jest/globals';

import { GetMediaInfoTestCase } from '../test-utils';

export const largeMp4TestCases: GetMediaInfoTestCase[] = [
  {
    filename: 'large_BigBuckBunny.mp4',
    expectedMediaInfo: {
      bytesRead: 64657027,
      parser: 'media-utils',
      container: 'mp4',
      containerDetail: 'isom, mp41',
      durationInSeconds: expect.closeTo(596, 0) as any,
      videoStreams: [
        {
          id: 1,
          codec: 'h264',
          codecDetail: 'avc1.42c00d',
          width: 320,
          height: 180,
          fps: 24,
          bitrate: expect.closeTo(702655, -3) as any,
          durationInSeconds: expect.closeTo(596, 0) as any,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'aac',
          codecDetail: 'mp4a.40.02',
          profile: 'LC',
          channelCount: 2,
          sampleRate: 48000,
          bitsPerSample: 16,
          bitrate: expect.closeTo(160000, -2) as any,
          durationInSeconds: expect.closeTo(596, 0) as any,
        },
      ],
    },
  },
];
