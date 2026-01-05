import { expect } from '@jest/globals';

import { GetMediaInfoTestCase } from '../test-utils';

export const largeMkvTestCases: GetMediaInfoTestCase[] = [
  {
    filename: 'large_matroska-test-files1.mkv',
    expectedMediaInfo: {
      bytesRead: 5824,
      parser: 'media-utils',
      container: 'mkv',
      containerDetail: 'matroska',
      durationInSeconds: expect.closeTo(87, 0) as any,
      videoStreams: [
        {
          id: 1,
          codec: 'msmpeg4v2',
          codecDetail: 'V_MS/VFW/FOURCC',
          width: 854,
          height: 480,
          durationInSeconds: expect.closeTo(87, 0) as any,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'mp3',
          codecDetail: 'A_MPEG/L3',
          channelCount: 2,
          sampleRate: 48000,
          bitsPerSample: undefined,
          durationInSeconds: expect.closeTo(87, 0) as any,
        },
      ],
    },
  },
  {
    filename: 'large_matroska-test-files2.mkv',
    expectedMediaInfo: {
      bytesRead: 5312,
      parser: 'media-utils',
      container: 'mkv',
      containerDetail: 'matroska',
      durationInSeconds: expect.closeTo(48, 0) as any,
      videoStreams: [
        {
          id: 1,
          codec: 'h264',
          codecDetail: 'V_MPEG4/ISO/AVC',
          width: 1024,
          height: 576,
          durationInSeconds: expect.closeTo(48, 0) as any,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'aac',
          codecDetail: 'A_AAC',
          channelCount: 2,
          sampleRate: 48000,
          bitsPerSample: undefined,
          durationInSeconds: expect.closeTo(48, 0) as any,
        },
      ],
    },
  },
  {
    filename: 'large_matroska-test-files3.mkv',
    expectedMediaInfo: {
      bytesRead: 5460,
      parser: 'media-utils',
      container: 'mkv',
      containerDetail: 'matroska',
      durationInSeconds: expect.closeTo(49, 0) as any,
      videoStreams: [
        {
          id: 1,
          codec: 'h264',
          codecDetail: 'V_MPEG4/ISO/AVC',
          width: 1024,
          height: 576,
          durationInSeconds: expect.closeTo(49, 0) as any,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'mp3',
          codecDetail: 'A_MPEG/L3',
          channelCount: 2,
          sampleRate: 48000,
          bitsPerSample: undefined,
          durationInSeconds: expect.closeTo(49, 0) as any,
        },
      ],
    },
  },
  {
    filename: 'large_matroska-test-files4.mkv',
    fileRemark: 'streaming',
    expectedMediaInfo: {
      bytesRead: 34,
      parser: 'media-utils',
      container: 'mkv',
      containerDetail: 'matroska',
      durationInSeconds: 0,
      videoStreams: [],
      audioStreams: [],
    },
  },
  {
    filename: 'large_matroska-test-files5.mkv',
    expectedMediaInfo: {
      bytesRead: 91703,
      parser: 'media-utils',
      container: 'mkv',
      containerDetail: 'matroska',
      durationInSeconds: expect.closeTo(47, 0) as any,
      videoStreams: [
        {
          id: 1,
          codec: 'h264',
          codecDetail: 'V_MPEG4/ISO/AVC',
          width: 1024,
          height: 576,
          durationInSeconds: expect.closeTo(47, 0) as any,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'aac',
          codecDetail: 'A_AAC',
          channelCount: 2,
          sampleRate: 48000,
          bitsPerSample: undefined,
          durationInSeconds: expect.closeTo(47, 0) as any,
        },
        {
          id: 10,
          codec: 'aac',
          codecDetail: 'A_AAC',
          channelCount: 0, // How could it be 0?
          sampleRate: 22050,
          bitsPerSample: undefined,
          durationInSeconds: expect.closeTo(47, 0) as any,
        },
      ],
    },
  },
  {
    filename: 'large_matroska-test-files6.mkv',
    expectedMediaInfo: {
      bytesRead: 5684,
      parser: 'media-utils',
      container: 'mkv',
      containerDetail: 'matroska',
      durationInSeconds: expect.closeTo(87, 0) as any,
      videoStreams: [
        {
          id: 1,
          codec: 'msmpeg4v2',
          codecDetail: 'V_MS/VFW/FOURCC',
          width: 854,
          height: 480,
          durationInSeconds: expect.closeTo(87, 0) as any,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'mp3',
          codecDetail: 'A_MPEG/L3',
          channelCount: 2,
          sampleRate: 48000,
          bitsPerSample: undefined,
          durationInSeconds: expect.closeTo(87, 0) as any,
        },
      ],
    },
  },
  {
    filename: 'large_matroska-test-files7.mkv',
    expectedMediaInfo: {
      bytesRead: 5832,
      parser: 'media-utils',
      container: 'mkv',
      containerDetail: 'matroska',
      durationInSeconds: expect.closeTo(37, 0) as any,
      videoStreams: [
        {
          id: 1,
          codec: 'h264',
          codecDetail: 'V_MPEG4/ISO/AVC',
          width: 1024,
          height: 576,
          durationInSeconds: expect.closeTo(37, 0) as any,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'aac',
          codecDetail: 'A_AAC',
          channelCount: 2,
          sampleRate: 48000,
          bitsPerSample: undefined,
          durationInSeconds: expect.closeTo(37, 0) as any,
        },
      ],
    },
  },
  {
    filename: 'large_matroska-test-files8.mkv',
    expectedMediaInfo: {
      bytesRead: 5480,
      parser: 'media-utils',
      container: 'mkv',
      containerDetail: 'matroska',
      durationInSeconds: expect.closeTo(47, 0) as any,
      videoStreams: [
        {
          id: 1,
          codec: 'h264',
          codecDetail: 'V_MPEG4/ISO/AVC',
          width: 1024,
          height: 576,
          durationInSeconds: expect.closeTo(47, 0) as any,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'aac',
          codecDetail: 'A_AAC',
          channelCount: 2,
          sampleRate: 48000,
          bitsPerSample: undefined,
          durationInSeconds: expect.closeTo(47, 0) as any,
        },
      ],
    },
  },
];
