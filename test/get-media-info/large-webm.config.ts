import { expect } from '@jest/globals';

import { GetMediaInfoTestCase } from '../test-utils';

export const largeWebmTestCases: GetMediaInfoTestCase[] = [
  {
    filename: 'large_TearsOfSteel.webm',
    expectedMediaInfo: {
      bytesRead: 12094,
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
    },
  },
];
