// import { expect } from '@jest/globals';

import { GetMediaInfoTestCase } from '../test-utils';

export const mp4boxTestCases: GetMediaInfoTestCase[] = [
  {
    filename: 'engine-start.h264.aac.mp4',
    expectedMediaInfo: {
      audioStreams: [
        {
          id: 2,
          bitrate: 128127.0481418919,
          channelCount: 2,
          codec: 'aac',
          codecDetail: 'mp4a.40.2',
          durationInSeconds: 6,
          sampleRate: 44100,
          profile: 'LC',
        },
      ],
      container: 'mp4',
      containerDetail: 'isom, isom, iso2, avc1, mp41',
      durationInSeconds: 6,
      mimeType: 'video/mp4; codecs="avc1.64001f,mp4a.40.2"; profiles="isom,iso2,avc1,mp41"',
      parser: 'mp4box',
      videoStreams: [
        {
          id: 1,
          bitrate: 349082.6666666667,
          codec: 'h264',
          codecDetail: 'avc1.64001f',
          durationInSeconds: 6,
          fps: 24,
          height: 534,
          width: 1280,
        },
      ],
    },
  },
  // ... (add all other test cases from mp4box.test.ts here, including failure cases)
];
