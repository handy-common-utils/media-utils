import { describe, expect } from '@jest/globals';

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
        bytesRead: 143569,
        container: 'mp3',
        containerDetail: 'mp3',
        parser: 'media-utils',
        durationInSeconds: expect.closeTo(6, 0.1) as any,
        videoStreams: [],
        audioStreams: [
          {
            id: 0,
            codec: 'mp3',
            codecDetail: 'MPEG-1 Layer III',
            channelCount: 2,
            sampleRate: 44100,
            bitrate: 192000,
            durationInSeconds: expect.closeTo(6, 0.1) as any,
            codecDetails: {
              layer: 3,
              padding: 1,
            },
          },
        ],
      },
    },
    {
      filename: 'engine-start.h264.pcms16le.mov',
      expectedMediaInfo: {
        bytesRead: 65536,
        container: 'wav',
        containerDetail: 'wav',
        parser: 'media-utils',
        durationInSeconds: expect.closeTo(6, 0) as any,
        videoStreams: [],
        audioStreams: [
          {
            id: 1,
            codec: 'pcm_s16le',
            codecDetail: 'pcm_s16le',
            channelCount: 2,
            sampleRate: 44100,
            bitrate: 1411200,
            bitsPerSample: 16,
            durationInSeconds: expect.closeTo(6, 0) as any,
            codecDetails: {
              blockAlign: 4,
              formatTag: 1,
              samplesPerBlock: undefined,
            },
          },
        ],
      },
    },
    {
      filename: 'engine-start.h264.pcms32be.mov',
      expectedMediaInfo: {
        bytesRead: 65536,
        container: 'wav',
        containerDetail: 'wav',
        parser: 'media-utils',
        durationInSeconds: expect.closeTo(6, 0) as any,
        videoStreams: [],
        audioStreams: [
          {
            id: 1,
            codec: 'pcm_s32le',
            codecDetail: 'pcm_s32le',
            channelCount: 2,
            sampleRate: 44100,
            bitrate: 2822400,
            bitsPerSample: 32,
            durationInSeconds: expect.closeTo(6, 0) as any,
            codecDetails: {
              blockAlign: 8,
              formatTag: 1,
              samplesPerBlock: undefined,
            },
          },
        ],
      },
    },
    {
      filename: 'test-tone.h264.pcms32be.mov',
      expectedMediaInfo: {
        bytesRead: 65536,
        container: 'wav',
        containerDetail: 'wav',
        parser: 'media-utils',
        durationInSeconds: expect.closeTo(3, 0) as any,
        videoStreams: [],
        audioStreams: [
          {
            id: 1,
            codec: 'pcm_s32le',
            codecDetail: 'pcm_s32le',
            channelCount: 2,
            sampleRate: 44100,
            bitrate: 2822400,
            bitsPerSample: 32,
            durationInSeconds: expect.closeTo(3, 0) as any,
            codecDetails: {
              blockAlign: 8,
              formatTag: 1,
              samplesPerBlock: undefined,
            },
          },
        ],
      },
    },
  ]);
});
