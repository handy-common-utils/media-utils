import { expect } from '@jest/globals';

import { GetMediaInfoTestCase } from '../test-utils';

export const largeAviTestCases: GetMediaInfoTestCase[] = [
  {
    filename: 'large_BigBuckBunny_surround.avi',
    fileRemark: '5 channels',
    expectedMediaInfo: {
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
          codecDetail: 'AC-3',
          channelCount: 5,
          sampleRate: 48000,
          bitrate: 448000,
          bitsPerSample: undefined,
          durationInSeconds: expect.closeTo(596, 0) as any,
          codecDetails: {
            blockAlign: 1,
            formatTag: 8192,
            samplesPerBlock: undefined,
          },
        },
      ],
    },
  },
];
