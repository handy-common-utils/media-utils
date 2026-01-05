import { expect } from '@jest/globals';

import { GetMediaInfoTestCase } from '../test-utils';

export const largeMovTestCases: GetMediaInfoTestCase[] = [
  {
    filename: 'large_TearsOfSteel.mov',
    expectedMediaInfo: {
      bytesRead: 583774083, // moov after [mdat] size=583171118
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
    },
  },
];
