import { describe } from '@jest/globals';

import { runExtractAudioTestCases } from '../test-utils';

describe('Extract audio from MOV', () => {
  runExtractAudioTestCases([
    {
      filename: 'engine-start.h264.aac.mov',
      expectedMediaInfo: {
        bytesRead: 65536,
        container: 'aac',
        containerDetail: 'aac',
        parser: 'media-utils',
        durationInSeconds: undefined,
        videoStreams: [],
        audioStreams: [
          {
            id: 0,
            codec: 'aac',
            codecDetail: 'mp4a.40.2',
            profile: 'LC',
            channelCount: 2,
            sampleRate: 44100,
          },
        ],
      },
    },
    {
      filename: 'engine-start.h264.aac-mono.mov',
      expectedMediaInfo: {
        bytesRead: 59232,
        container: 'aac',
        containerDetail: 'aac',
        parser: 'media-utils',
        durationInSeconds: undefined,
        videoStreams: [],
        audioStreams: [
          {
            id: 0,
            codec: 'aac',
            codecDetail: 'mp4a.40.2',
            profile: 'LC',
            channelCount: 1,
            sampleRate: 44100,
          },
        ],
      },
    },
    {
      filename: 'engine-start.h264.mp3.mov',
      expectedMediaInfo: {
        bytesRead: 65536,
        container: 'mp3',
        containerDetail: 'mp3',
        parser: 'media-utils',
        durationInSeconds: undefined,
        videoStreams: [],
        audioStreams: [
          {
            id: 0,
            codec: 'mp3',
            codecDetail: 'MPEG-1 Layer III',
            channelCount: 2,
            sampleRate: 44100,
            bitrate: 192000,
            durationInSeconds: undefined,
            codecDetails: {
              layer: 3,
              padding: 1,
            },
          },
        ],
      },
    },
  ]);
});
