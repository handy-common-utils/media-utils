import { describe, expect } from '@jest/globals';

import { runExtractAudioTestCases } from '../test-utils';

describe('Extract audio from AVI', () => {
  runExtractAudioTestCases([
    {
      filename: 'engine-start.mjpeg.pcms16le.avi',
      expectedMediaInfo: {
        audioStreams: [
          {
            bitrate: 1411200,
            bitsPerSample: 16,
            channelCount: 2,
            codec: 'pcm_s16le',
            codecDetail: 'pcm_s16le',
            durationInSeconds: expect.closeTo(6, 0) as any,
            id: 1,
            sampleRate: 44100,
            codecDetails: {
              formatTag: 1,
              blockAlign: 4,
              samplesPerBlock: undefined,
            },
          },
        ],
        container: 'wav',
        containerDetail: 'wav',
        durationInSeconds: expect.closeTo(6, 0) as any,
        parser: 'media-utils',
        videoStreams: [],
      },
    },
    {
      filename: 'engine-start.h264.pcms16le.avi',
      expectedMediaInfo: {
        audioStreams: [
          {
            bitrate: 1411200,
            bitsPerSample: 16,
            channelCount: 2,
            codec: 'pcm_s16le',
            codecDetail: 'pcm_s16le',
            durationInSeconds: expect.closeTo(6, 0) as any,
            id: 1,
            sampleRate: 44100,
            codecDetails: {
              formatTag: 1,
              blockAlign: 4,
              samplesPerBlock: undefined,
            },
          },
        ],
        container: 'wav',
        containerDetail: 'wav',
        durationInSeconds: expect.closeTo(6, 0) as any,
        parser: 'media-utils',
        videoStreams: [],
      },
    },
    {
      filename: 'engine-start.h264.pcm_u8.avi',
      expectedMediaInfo: {
        audioStreams: [
          {
            bitrate: 705600,
            bitsPerSample: 8,
            channelCount: 2,
            codec: 'pcm_u8',
            codecDetail: 'pcm_u8',
            durationInSeconds: expect.closeTo(6, 0) as any,
            id: 1,
            sampleRate: 44100,
            codecDetails: {
              formatTag: 1,
              blockAlign: 2,
              samplesPerBlock: undefined,
            },
          },
        ],
        container: 'wav',
        containerDetail: 'wav',
        durationInSeconds: expect.closeTo(6, 0) as any,
        parser: 'media-utils',
        videoStreams: [],
      },
    },
    {
      filename: 'engine-start.h264.adpcm_ms.avi',
      expectedMediaInfo: {
        audioStreams: [
          {
            bitrate: expect.closeTo(356976, -3) as any,
            bitsPerSample: 4,
            channelCount: 2,
            codec: 'adpcm_ms',
            codecDetail: 'adpcm_ms',
            durationInSeconds: expect.closeTo(6, 0) as any,
            id: 1,
            sampleRate: 44100,
            codecDetails: {
              formatTag: 2,
              blockAlign: 1024,
              samplesPerBlock: 1012,
            },
          },
        ],
        container: 'wav',
        containerDetail: 'wav',
        durationInSeconds: expect.closeTo(6, 0) as any,
        parser: 'media-utils',
        videoStreams: [],
      },
    },
  ]);
});
