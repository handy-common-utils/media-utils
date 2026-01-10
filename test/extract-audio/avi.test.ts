import { describe, expect } from '@jest/globals';

import { runExtractAudioTestCases } from '../test-utils';

describe('Extract audio from AVI', () => {
  runExtractAudioTestCases([
    {
      filename: 'engine-start.mjpeg.pcms16le.avi',
      expectedMediaInfo: {
        bytesRead: 65536,
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
        bytesRead: 65536,
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
        bytesRead: 65536,
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
        bytesRead: 65536,
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
    {
      filename: 'engine-start.h264.pcms16le-mono.avi',
      expectedMediaInfo: {
        bytesRead: 65536,
        audioStreams: [
          {
            bitrate: 705600,
            bitsPerSample: 16,
            channelCount: 1,
            codec: 'pcm_s16le',
            codecDetail: 'pcm_s16le',
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
      filename: 'engine-start.h264.pcm_u8-mono.avi',
      expectedMediaInfo: {
        bytesRead: 65536,
        audioStreams: [
          {
            bitrate: 352800,
            bitsPerSample: 8,
            channelCount: 1,
            codec: 'pcm_u8',
            codecDetail: 'pcm_u8',
            durationInSeconds: expect.closeTo(6, 0) as any,
            id: 1,
            sampleRate: 44100,
            codecDetails: {
              formatTag: 1,
              blockAlign: 1,
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
      filename: 'engine-start.h264.adpcm_ms-mono.avi',
      expectedMediaInfo: {
        bytesRead: 65536,
        audioStreams: [
          {
            bitrate: 177432,
            bitsPerSample: 4,
            channelCount: 1,
            codec: 'adpcm_ms',
            codecDetail: 'adpcm_ms',
            durationInSeconds: expect.closeTo(6, 0) as any,
            id: 1,
            sampleRate: 44100,
            codecDetails: {
              formatTag: 2,
              blockAlign: 1024,
              samplesPerBlock: 2036,
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
      filename: 'engine-start.h264.mp3-mono.avi',
      expectedMediaInfo: {
        bytesRead: 48274,
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
