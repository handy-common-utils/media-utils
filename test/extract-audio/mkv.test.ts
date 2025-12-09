import { describe } from '@jest/globals';

import { runExtractAudioTestCases } from '../test-utils';

describe('Extract audio from MKV', () => {
  runExtractAudioTestCases([
    {
      filename: 'large_matroska-test-files1.mkv',
      expectedMediaInfo: {
        audioStreams: [
          {
            id: 0,
            bitrate: 160000,
            channelCount: 2,
            codec: 'mp3',
            codecDetail: 'MPEG-1 Layer III',
            durationInSeconds: undefined,
            sampleRate: 48000,
            codecDetails: {
              layer: 3,
              padding: 0,
            },
          },
        ],
        container: 'mp3',
        containerDetail: 'mp3',
        durationInSeconds: undefined,
        parser: 'media-utils',
        videoStreams: [],
      },
    },
    {
      filename: 'large_matroska-test-files2.mkv',
      expectedMediaInfo: {
        audioStreams: [
          {
            id: 0,
            channelCount: 2,
            codec: 'aac',
            codecDetail: 'mp4a.40.2',
            durationInSeconds: undefined,
            sampleRate: 48000,
            profile: 'LC',
          },
        ],
        container: 'aac',
        containerDetail: 'aac',
        durationInSeconds: undefined,
        parser: 'media-utils',
        videoStreams: [],
      },
    },
  ]);
});
