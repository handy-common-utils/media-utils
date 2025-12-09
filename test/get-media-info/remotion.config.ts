import { expect } from '@jest/globals';

import { GetMediaInfoTestCase } from '../test-utils';

export const remotionTestCases: GetMediaInfoTestCase[] = [
  {
    filename: 'engine-start.h264.aac.mp4',
    expectedMediaInfo: {
      audioStreams: [
        {
          id: 2,
          channelCount: 2,
          codec: 'aac',
          codecDetail: 'mp4a.40.02',
          durationInSeconds: 6,
          sampleRate: 44100,
        },
      ],
      container: 'mp4',
      containerDetail: 'mp4',
      durationInSeconds: 6,
      mimeType: undefined,
      parser: 'remotion',
      videoStreams: [
        {
          id: 1,
          codec: 'h264',
          codecDetail: 'avc1.64001f',
          durationInSeconds: 6,
          height: 534,
          width: 1280,
        },
      ],
    },
  },
  {
    filename: 'engine-start.h264.mp3.mp4',
    expectedMediaInfo: {
      audioStreams: [
        {
          id: 2,
          channelCount: 2,
          codec: 'mp3',
          codecDetail: 'mp3',
          durationInSeconds: expect.closeTo(6, 0) as any,
          sampleRate: 44100,
        },
      ],
      container: 'mp4',
      containerDetail: 'mp4',
      durationInSeconds: expect.closeTo(6, 0) as any,
      mimeType: undefined,
      parser: 'remotion',
      videoStreams: [
        {
          id: 1,
          codec: 'h264',
          codecDetail: 'avc1.64001f',
          durationInSeconds: expect.closeTo(6, 0) as any,
          height: 534,
          width: 1280,
        },
      ],
    },
  },
  {
    filename: 'engine-start.h264.aac.mov',
    expectedMediaInfo: {
      audioStreams: [
        {
          id: 2,
          channelCount: 2,
          codec: 'aac',
          codecDetail: 'mp4a.40.02',
          durationInSeconds: expect.closeTo(6, 0) as any,
          sampleRate: 44100,
        },
      ],
      container: 'mp4',
      containerDetail: 'mp4',
      durationInSeconds: expect.closeTo(6, 0) as any,
      mimeType: undefined,
      parser: 'remotion',
      videoStreams: [
        {
          id: 1,
          codec: 'h264',
          codecDetail: 'avc1.4d401f',
          durationInSeconds: expect.closeTo(6, 0) as any,
          height: 534,
          width: 1280,
        },
      ],
    },
  },
  {
    filename: 'engine-start.vp9.opus.webm',
    expectedMediaInfo: {
      audioStreams: [
        {
          id: 2,
          channelCount: 2,
          codec: 'opus',
          codecDetail: 'opus',
          durationInSeconds: expect.closeTo(6, 0) as any,
          sampleRate: 48000,
        },
      ],
      container: 'webm',
      containerDetail: 'webm',
      durationInSeconds: expect.closeTo(6, 0) as any,
      mimeType: undefined,
      parser: 'remotion',
      videoStreams: [
        {
          id: 1,
          codec: 'vp9',
          codecDetail: 'vp09.00.10.08',
          durationInSeconds: expect.closeTo(6, 0) as any,
          height: 534,
          width: 1280,
        },
      ],
    },
  },
  {
    filename: 'engine-start.vp8.vorbis.webm',
    expectedMediaInfo: {
      audioStreams: [
        {
          id: 2,
          channelCount: 2,
          codec: 'vorbis',
          codecDetail: 'vorbis',
          durationInSeconds: expect.closeTo(6, 0) as any,
          sampleRate: 48000,
        },
      ],
      container: 'webm',
      containerDetail: 'webm',
      durationInSeconds: expect.closeTo(6, 0) as any,
      mimeType: undefined,
      parser: 'remotion',
      videoStreams: [
        {
          id: 1,
          codec: 'vp8',
          codecDetail: 'vp8',
          durationInSeconds: expect.closeTo(6, 0) as any,
          height: 534,
          width: 1280,
        },
      ],
    },
  },
  {
    filename: 'engine-start.vp9.vorbis.webm',
    expectedMediaInfo: {
      audioStreams: [
        {
          id: 2,
          channelCount: 2,
          codec: 'vorbis',
          codecDetail: 'vorbis',
          durationInSeconds: expect.closeTo(6, 0) as any,
          sampleRate: 48000,
        },
      ],
      container: 'webm',
      containerDetail: 'webm',
      durationInSeconds: expect.closeTo(6, 0) as any,
      mimeType: undefined,
      parser: 'remotion',
      videoStreams: [
        {
          id: 1,
          codec: 'vp9',
          codecDetail: 'vp09.00.10.08',
          durationInSeconds: expect.closeTo(6, 0) as any,
          height: 534,
          width: 1280,
        },
      ],
    },
  },
  {
    filename: 'large_matroska-test-files2.mkv',
    expectedMediaInfo: {
      audioStreams: [
        {
          id: 2,
          channelCount: 2,
          codec: 'aac',
          codecDetail: 'mp4a.40.02',
          durationInSeconds: expect.closeTo(4751, 0) as any,
          sampleRate: 48000,
        },
      ],
      container: 'webm',
      containerDetail: 'webm',
      durationInSeconds: expect.closeTo(4751, 0) as any,
      mimeType: undefined,
      parser: 'remotion',
      videoStreams: [
        {
          id: 1,
          codec: 'h264',
          codecDetail: 'avc1.4d401f',
          durationInSeconds: expect.closeTo(4751, 0) as any,
          height: 576,
          width: 1354,
        },
      ],
    },
  },
  {
    filename: 'large_matroska-test-files3.mkv',
    expectedMediaInfo: {
      audioStreams: [
        {
          id: 2,
          channelCount: 2,
          codec: 'mp3',
          codecDetail: 'mp3',
          sampleRate: 48000,
        },
      ],
      container: 'webm',
      containerDetail: 'webm',
      mimeType: undefined,
      parser: 'remotion',
      videoStreams: [
        {
          id: 1,
          codec: 'h264',
          codecDetail: 'avc1.4d401f',
          height: 576,
          width: 1024,
        },
      ],
    },
  },
];
