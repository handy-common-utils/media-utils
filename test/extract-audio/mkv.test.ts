import { describe, expect } from '@jest/globals';

import { runExtractAudioTestCases } from '../test-utils';

describe('Extract audio from MKV', () => {
  runExtractAudioTestCases([
    {
      filename: 'large_matroska-test-files1.mkv',
      expectedMediaInfo: {
        bytesRead: 2646816,
        audioStreams: [
          {
            id: 0,
            bitrate: expect.closeTo(242449, -3) as any,
            channelCount: 2,
            codec: 'mp3',
            codecDetail: 'MPEG-1 Layer III',
            durationInSeconds: expect.closeTo(87.3, 0.1) as any,
            sampleRate: 48000,
            codecDetails: {
              layer: 3,
              padding: 0,
            },
          },
        ],
        container: 'mp3',
        containerDetail: 'mp3',
        durationInSeconds: expect.closeTo(87.3, 0.1) as any,
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
        durationInSeconds: expect.closeTo(6.1, 0.1) as any,
        videoStreams: [],
        audioStreams: [
          {
            id: 0,
            codec: 'mp3',
            codecDetail: 'MPEG-1 Layer III',
            channelCount: 1,
            sampleRate: 44100,
            bitrate: 64000,
            durationInSeconds: expect.closeTo(6.1, 0.1) as any,
            codecDetails: {
              layer: 3,
              padding: 0,
            },
          },
        ],
      },
    },
    // This file contains junk elements (elements not defined in the specs) either at the beginning or the end of Clusters. These elements should be skipped. There is also an invalid element at 451417 that should be skipped until the next valid Cluster is found.
    {
      filename: 'large_matroska-test-files7.mkv',
      expectedMediaInfo: {
        bytesRead: 25117,
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
            sampleRate: 48000,
          },
        ],
      },
    },
  ]);
});
