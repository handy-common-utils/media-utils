import { expect } from '@jest/globals';

import { GetMediaInfoTestCase } from '../test-utils';

export const isoboxerTestCases: GetMediaInfoTestCase[] = [
  {
    filename: 'engine-start.h264.aac.mp4',
    expectedMediaInfo: {
      audioStreams: [
        {
          id: 2,
          channelCount: 2,
          codec: 'aac',
          codecDetail: 'mp4a.40',
          durationInSeconds: 6,
          sampleRate: 44100,
        },
      ],
      container: 'mp4',
      containerDetail: 'isom, isom, iso2, avc1, mp41',
      durationInSeconds: 6,
      parser: 'isoboxer',
      videoStreams: [
        {
          id: 1,
          codec: 'h264',
          codecDetail: 'avc1',
          durationInSeconds: 6,
          height: 534,
          width: 1280,
        },
      ],
    },
  },
];
