import { expect } from '@jest/globals';

import { GetMediaInfoTestCase } from '../test-utils';

export const mediaUtilsTestCases: GetMediaInfoTestCase[] = [
  {
    filename: 'engine-start.aac',
    expectedMediaInfo: {
      audioStreams: [
        {
          id: 0,
          channelCount: 2,
          codec: 'aac',
          codecDetail: 'mp4a.40.2',
          sampleRate: 44100,
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
    filename: 'engine-start.mp3',
    expectedMediaInfo: {
      parser: 'media-utils',
      audioStreams: [
        {
          id: 0,
          bitrate: expect.closeTo(128273, -2) as any,
          channelCount: 2,
          codec: 'mp3',
          codecDetail: 'MPEG-1 Layer III',
          durationInSeconds: expect.closeTo(6, 0.1) as any,
          sampleRate: 44100,
          codecDetails: {
            layer: 3,
            padding: 0,
          },
        },
      ],
      container: 'mp3',
      containerDetail: 'mp3',
      durationInSeconds: expect.closeTo(6, 0.1) as any,
      videoStreams: [],
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
          codecDetail: 'A_OPUS',
          durationInSeconds: 6.008,
          sampleRate: 48000,
          bitsPerSample: 32,
        },
      ],
      container: 'webm',
      containerDetail: 'webm',
      durationInSeconds: 6.008,
      parser: 'media-utils',
      videoStreams: [
        {
          id: 1,
          codec: 'vp9',
          codecDetail: 'V_VP9',
          durationInSeconds: 6.008,
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
          codecDetail: 'A_VORBIS',
          durationInSeconds: 6.007,
          sampleRate: 48000,
          bitsPerSample: 32,
        },
      ],
      container: 'webm',
      containerDetail: 'webm',
      durationInSeconds: 6.007,
      parser: 'media-utils',
      videoStreams: [
        {
          id: 1,
          codec: 'vp8',
          codecDetail: 'V_VP8',
          durationInSeconds: 6.007,
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
          codecDetail: 'A_VORBIS',
          durationInSeconds: 6.007,
          sampleRate: 48000,
          bitsPerSample: 32,
        },
      ],
      container: 'webm',
      containerDetail: 'webm',
      durationInSeconds: 6.007,
      parser: 'media-utils',
      videoStreams: [
        {
          id: 1,
          codec: 'vp9',
          codecDetail: 'V_VP9',
          durationInSeconds: 6.007,
          height: 534,
          width: 1280,
        },
      ],
    },
  },
  {
    filename: 'engine-start.av1.opus.webm',
    expectedMediaInfo: {
      audioStreams: [
        {
          id: 2,
          channelCount: 2,
          codec: 'opus',
          codecDetail: 'A_OPUS',
          durationInSeconds: 6.008,
          sampleRate: 48000,
          bitsPerSample: 32,
        },
      ],
      container: 'webm',
      containerDetail: 'webm',
      durationInSeconds: 6.008,
      parser: 'media-utils',
      videoStreams: [
        {
          id: 1,
          codec: 'av1',
          codecDetail: 'V_AV1',
          durationInSeconds: 6.008,
          height: 534,
          width: 1280,
        },
      ],
    },
  },
  {
    filename: 'engine-start.h264.aac.mp4',
    expectedMediaInfo: {
      parser: 'media-utils',
      container: 'mp4',
      containerDetail: 'isom, isom, iso2, avc1, mp41',
      durationInSeconds: expect.closeTo(6, 0) as any,
      videoStreams: [
        {
          codec: 'h264',
          codecDetail: 'avc1.64001f',
          durationInSeconds: expect.closeTo(6, 0) as any,
          id: 1,
          width: 1280,
          height: 534,
          fps: 24,
          bitrate: 349083,
        },
      ],
      audioStreams: [
        {
          codec: 'aac',
          codecDetail: 'mp4a.40.02',
          durationInSeconds: expect.closeTo(6, 0) as any,
          id: 2,
          sampleRate: 44100,
          bitrate: expect.closeTo(127930, -3) as any,
          channelCount: 2,
          profile: 'LC',
        },
      ],
    },
  },
  {
    filename: 'engine-start.h264.mp3.mp4',
    expectedMediaInfo: {
      parser: 'media-utils',
      container: 'mp4',
      containerDetail: 'isom, isom, iso2, avc1, mp41',
      durationInSeconds: expect.closeTo(6, 0) as any,
      videoStreams: [
        {
          codec: 'h264',
          codecDetail: 'avc1.64001f',
          durationInSeconds: expect.closeTo(6, 0) as any,
          id: 1,
          width: 1280,
          height: 534,
          fps: 24,
          bitrate: 349083,
        },
      ],
      audioStreams: [
        {
          codec: 'mp3',
          codecDetail: 'mp4a.6b',
          durationInSeconds: expect.closeTo(6, 0) as any,
          id: 2,
          sampleRate: 44100,
          bitrate: expect.closeTo(128452, -3) as any,
          channelCount: 2,
        },
      ],
    },
  },
  {
    filename: 'engine-start.h264.aac.mov',
    expectedMediaInfo: {
      parser: 'media-utils',
      container: 'mov',
      containerDetail: 'qt  , qt  ',
      durationInSeconds: expect.closeTo(6, 0) as any,
      videoStreams: [
        {
          codec: 'h264',
          width: 1280,
          height: 534,
          id: 1,
          codecDetail: 'avc1.4d401f',
          durationInSeconds: expect.closeTo(6, 0) as any,
          fps: expect.closeTo(22.1, 1) as any,
          bitrate: 939149,
        },
      ],
      audioStreams: [
        {
          codec: 'aac',
          id: 2,
          codecDetail: 'mp4a',
          channelCount: 2,
          sampleRate: 44100,
          bitrate: expect.closeTo(131692, -3) as any,
          durationInSeconds: expect.closeTo(6, 0) as any,
        },
      ],
    },
  },
  {
    filename: 'engine-start.h264.mp3.mov',
    expectedMediaInfo: {
      parser: 'media-utils',
      container: 'mov',
      containerDetail: 'qt  , qt  ',
      durationInSeconds: expect.closeTo(6, 0) as any,
      videoStreams: [
        {
          codec: 'h264',
          codecDetail: 'avc1.4d401f',
          id: 1,
          width: 1280,
          height: 534,
          durationInSeconds: expect.closeTo(6, 0) as any,
          fps: expect.closeTo(22, 0) as any,
          bitrate: expect.closeTo(939149, -4) as any,
        },
      ],
      audioStreams: [
        {
          codec: 'mp3',
          codecDetail: '.mp3',
          id: 2,
          channelCount: 2,
          sampleRate: 44100,
          bitrate: expect.closeTo(192000, -4) as any,
          durationInSeconds: expect.closeTo(6, 0) as any,
        },
      ],
    },
  },
  {
    filename: 'engine-start.mjpeg.pcms16le.avi',
    expectedMediaInfo: {
      parser: 'media-utils',
      container: 'avi',
      containerDetail: 'avi',
      durationInSeconds: expect.closeTo(6, 0) as any,
      videoStreams: [
        {
          codec: 'mjpeg',
          codecDetail: 'MJPG',
          id: 1,
          width: 1280,
          height: 534,
          durationInSeconds: expect.closeTo(6, 0) as any,
          fps: expect.closeTo(24, 1) as any,
        },
      ],
      audioStreams: [
        {
          codec: 'pcm_s16le',
          codecDetail: 'pcm_s16le',
          id: 2,
          channelCount: 2,
          sampleRate: 44100,
          bitsPerSample: 16,
          bitrate: 44100 * 2 * 16, // ≈ 1.4 Mbps raw PCM
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
    filename: 'engine-start.h264.pcms16le.avi',
    expectedMediaInfo: {
      parser: 'media-utils',
      container: 'avi',
      containerDetail: 'avi',
      durationInSeconds: expect.closeTo(6, 0) as any,
      videoStreams: [
        {
          codec: 'h264',
          codecDetail: 'H264',
          id: 1,
          width: 1280,
          height: 534,
          durationInSeconds: expect.closeTo(6, 0) as any,
          fps: expect.closeTo(24, 1) as any,
        },
      ],
      audioStreams: [
        {
          codec: 'pcm_s16le',
          codecDetail: 'pcm_s16le',
          id: 2,
          channelCount: 2,
          sampleRate: 44100,
          bitsPerSample: 16,
          bitrate: 44100 * 2 * 16,
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
    filename: 'engine-start.mpeg2video.mp2.m2ts',
    expectedMediaInfo: {
      parser: 'media-utils',
      container: 'mpegts',
      containerDetail: 'mpegts',
      videoStreams: [
        {
          id: 256,
          codec: 'mpeg2video',
          width: 1280,
          height: 534,
          fps: expect.closeTo(24, 1) as any,
        },
      ],
      audioStreams: [
        {
          id: 257,
          codec: 'mp2',
          codecDetail: 'MPEG-1 Layer II',
          channelCount: 2,
          sampleRate: 44100,
          bitrate: 384000,
          codecDetails: {
            layer: 2,
            padding: 0,
          },
          language: 'eng',
        },
      ],
    },
  },
  {
    filename: 'engine-start.wmv2.wmav2.wmv',
    expectedMediaInfo: {
      parser: 'media-utils',
      container: 'asf',
      containerDetail: 'wmv',
      durationInSeconds: expect.closeTo(6, 0) as any,
      videoStreams: [
        {
          id: 1,
          codec: 'wmv2',
          codecDetail: 'WMV2',
          width: 1280,
          height: 534,
          durationInSeconds: expect.closeTo(6, 0) as any,
          fps: undefined,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'wmav2',
          codecDetail: 'WMAv2',
          channelCount: 2,
          sampleRate: 44100,
          bitrate: 128000,
          bitsPerSample: 16,
          durationInSeconds: expect.closeTo(6, 0) as any,
        },
      ],
      fileProperties: expect.any(Object) as any,
      additionalStreamInfo: expect.any(Map) as any,
    },
  },
  {
    filename: 'engine-start.opus.ogg',
    expectedMediaInfo: {
      parser: 'media-utils',
      container: 'ogg',
      containerDetail: 'ogg',
      durationInSeconds: undefined,
      videoStreams: [],
      audioStreams: [
        {
          id: 1,
          codec: 'opus',
          codecDetail: 'opus',
          channelCount: 2,
          sampleRate: 48000,
          durationInSeconds: undefined,
        },
      ],
    },
  },
  {
    filename: 'engine-start.vorbis.ogg',
    expectedMediaInfo: {
      parser: 'media-utils',
      container: 'ogg',
      containerDetail: 'ogg',
      durationInSeconds: undefined,
      videoStreams: [],
      audioStreams: [
        {
          id: 1,
          codec: 'vorbis',
          codecDetail: 'vorbis',
          channelCount: 2,
          sampleRate: 48000,
          durationInSeconds: undefined,
        },
      ],
    },
  },
  {
    filename: 'engine-start.wmav2.wma',
    expectedMediaInfo: {
      parser: 'media-utils',
      container: 'asf',
      containerDetail: 'wma',
      durationInSeconds: expect.closeTo(6, 0) as any,
      videoStreams: [],
      audioStreams: [
        {
          id: 1,
          codec: 'wmav2',
          codecDetail: 'WMAv2',
          channelCount: 2,
          sampleRate: 44100,
          bitrate: 128000,
          bitsPerSample: 16,
          durationInSeconds: expect.closeTo(6, 0) as any,
        },
      ],
      additionalStreamInfo: expect.any(Map) as any,
      fileProperties: expect.any(Object) as any,
    },
  },
  {
    filename: 'engine-start.pcms16le.wav',
    expectedMediaInfo: {
      parser: 'media-utils',
      container: 'wav',
      containerDetail: 'wav',
      durationInSeconds: expect.closeTo(6, 0) as any,
      videoStreams: [],
      audioStreams: [
        {
          id: 1,
          codec: 'pcm_s16le',
          codecDetail: 'pcm_s16le',
          channelCount: 2,
          sampleRate: 44100,
          bitsPerSample: 16,
          bitrate: 44100 * 2 * 16,
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
];
