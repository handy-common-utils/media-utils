import { describe } from '@jest/globals';

import { runExtractAudioTestCases } from '../test-utils';

describe('Extract audio from MKV', () => {
  runExtractAudioTestCases([
    {
      filename: 'large_matroska-test-files1.mkv',
      expectedMediaInfo: {
        bytesRead: 65536,
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
        bytesRead: 65536,
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
    {
      filename: 'engine-start.h264.aac-mono.mkv',
      expectedMediaInfo: {
        bytesRead: 54420,
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
      filename: 'engine-start.h264.mp3-mono.mkv',
      expectedMediaInfo: {
        bytesRead: 48692,
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
            channelCount: 1,
            sampleRate: 44100,
            bitrate: 64000,
            durationInSeconds: undefined,
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
