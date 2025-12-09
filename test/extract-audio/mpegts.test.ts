import { describe } from '@jest/globals';

import { runExtractAudioTestCases } from '../test-utils';

describe('Extract Audio from MPEG-TS', () => {
  runExtractAudioTestCases([
    {
      filename: 'engine-start.mpeg2video.mp2.m2ts',
      expectedMediaInfo: {
        container: 'mp3',
        containerDetail: 'mp3',
        durationInSeconds: undefined,
        parser: 'media-utils',
        videoStreams: [],
        audioStreams: [
          {
            codec: 'mp2',
            codecDetail: 'MPEG-1 Layer II',
            sampleRate: 44100,
            bitrate: 384000,
            channelCount: 2,
            durationInSeconds: undefined,
            id: 0,
            codecDetails: {
              layer: 2,
              padding: 0,
            },
          },
        ],
      },
    },
    {
      filename: 'engine-start.h264.aac.m2ts',
      expectedMediaInfo: {
        container: 'aac',
        containerDetail: 'aac',
        durationInSeconds: undefined,
        parser: 'media-utils',
        videoStreams: [],
        audioStreams: [
          {
            codec: 'aac',
            codecDetail: 'mp4a.40.2',
            profile: 'LC',
            sampleRate: 44100,
            channelCount: 2,
            id: 0,
          },
        ],
      },
    },
    {
      filename: 'engine-start.h264.mp3.m2ts',
      expectedMediaInfo: {
        container: 'mp3',
        containerDetail: 'mp3',
        durationInSeconds: undefined,
        parser: 'media-utils',
        videoStreams: [],
        audioStreams: [
          {
            codec: 'mp3',
            codecDetail: 'MPEG-1 Layer III',
            sampleRate: 44100,
            bitrate: 128000,
            channelCount: 2,
            durationInSeconds: undefined,
            id: 0,
            codecDetails: {
              layer: 3,
              padding: 0,
            },
          },
        ],
      },
    },
  ]);
});
