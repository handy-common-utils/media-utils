import { describe, expect } from '@jest/globals';

import { runGetMediaInfoTestCases } from '../test-utils';

describe('getMediaInfo with media-utils parser', () => {
  runGetMediaInfoTestCases([
    {
      filename: 'engine-start.aac',
      options: { useParser: 'media-utils' },
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
      options: { useParser: 'media-utils' },
      expectedMediaInfo: {
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
        parser: 'media-utils',
        videoStreams: [],
      },
    },
    {
      filename: 'engine-start.vp9.opus.webm',
      options: { useParser: 'media-utils' },
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
      options: { useParser: 'media-utils' },
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
      options: { useParser: 'media-utils' },
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
      options: { useParser: 'media-utils' },
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
      filename: 'engine-start.pcms16le.wav',
      options: { useParser: 'media-utils' },
      expectedMediaInfo: {
        audioStreams: [
          {
            id: 1,
            bitrate: 1411200,
            bitsPerSample: 16,
            channelCount: 2,
            codec: 'pcm_s16le',
            codecDetail: 'pcm_s16le',
            durationInSeconds: expect.closeTo(6, 1) as any,
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
        durationInSeconds: expect.closeTo(6, 1) as any,
        parser: 'media-utils',
        videoStreams: [],
      },
    },
    {
      filename: 'engine-start.vorbis.ogg',
      options: { useParser: 'media-utils' },
      expectedMediaInfo: {
        audioStreams: [
          {
            id: 1,
            channelCount: 2,
            codec: 'vorbis',
            codecDetail: 'vorbis',
            durationInSeconds: undefined,
            sampleRate: 48000,
          },
        ],
        container: 'ogg',
        containerDetail: 'ogg',
        durationInSeconds: undefined,
        parser: 'media-utils',
        videoStreams: [],
      },
    },
    {
      filename: 'engine-start.opus.ogg',
      options: { useParser: 'media-utils' },
      expectedMediaInfo: {
        audioStreams: [
          {
            id: 1,
            channelCount: 2,
            codec: 'opus',
            codecDetail: 'opus',
            durationInSeconds: undefined,
            sampleRate: 48000,
          },
        ],
        container: 'ogg',
        containerDetail: 'ogg',
        durationInSeconds: undefined,
        parser: 'media-utils',
        videoStreams: [],
      },
    },
    {
      filename: 'engine-start.wmav2.wma',
      options: { useParser: 'media-utils' },
      expectedMediaInfo: {
        audioStreams: [
          {
            id: 1,
            channelCount: 2,
            codec: 'wmav2',
            codecDetail: 'WMAv2',
            bitrate: 128000,
            durationInSeconds: 6,
            sampleRate: 44100,
            bitsPerSample: 16,
          },
        ],
        container: 'asf',
        containerDetail: 'wma',
        durationInSeconds: 6,
        parser: 'media-utils',
        videoStreams: [],
        fileProperties: {
          playDuration: 91360000,
          sendDuration: 60360000,
          preroll: 3100,
          packetSize: 3200,
        },
        additionalStreamInfo: expect.any(Map) as any,
      },
    },
    {
      filename: 'engine-start.wmv2.wmav2.wmv',
      options: { useParser: 'media-utils' },
      expectedMediaInfo: {
        audioStreams: [
          {
            id: 2,
            channelCount: 2,
            codec: 'wmav2',
            codecDetail: 'WMAv2',
            bitrate: 128000,
            durationInSeconds: 6,
            sampleRate: 44100,
            bitsPerSample: 16,
          },
        ],
        container: 'asf',
        containerDetail: 'wmv',
        durationInSeconds: 6,
        parser: 'media-utils',
        videoStreams: [
          {
            id: 1,
            codec: 'wmv2',
            codecDetail: 'WMV2',
            width: 1280,
            height: 534,
            durationInSeconds: 6,
            fps: undefined,
          },
        ],
        fileProperties: {
          playDuration: 91460000,
          sendDuration: 60460000,
          preroll: 3100,
          packetSize: 3200,
        },
        additionalStreamInfo: expect.any(Map) as any,
      },
    },
    {
      filename: 'engine-start.mjpeg.pcms16le.avi',
      options: { useParser: 'media-utils' },
      expectedMediaInfo: {
        audioStreams: [
          {
            id: 2,
            channelCount: 2,
            codec: 'pcm_s16le',
            codecDetail: 'pcm_s16le',
            durationInSeconds: 6,
            sampleRate: 44100,
            bitsPerSample: 16,
            bitrate: expect.closeTo(1411200, -3) as any,
            codecDetails: {
              formatTag: 1,
              blockAlign: 4,
              samplesPerBlock: undefined,
            },
          },
        ],
        container: 'avi',
        containerDetail: 'avi',
        durationInSeconds: expect.closeTo(6, 0) as any,
        parser: 'media-utils',
        videoStreams: [
          {
            id: 1,
            codec: 'mjpeg',
            codecDetail: 'MJPG',
            width: 1280,
            height: 534,
            durationInSeconds: 6,
            fps: 24,
          },
        ],
      },
    },
    {
      filename: 'engine-start.h264.pcms16le.avi',
      options: { useParser: 'media-utils' },
      expectedMediaInfo: {
        audioStreams: [
          {
            id: 2,
            channelCount: 2,
            codec: 'pcm_s16le',
            codecDetail: 'pcm_s16le',
            durationInSeconds: 6,
            sampleRate: 44100,
            bitsPerSample: 16,
            bitrate: expect.closeTo(1411200, -3) as any,
            codecDetails: {
              formatTag: 1,
              blockAlign: 4,
              samplesPerBlock: undefined,
            },
          },
        ],
        container: 'avi',
        containerDetail: 'avi',
        durationInSeconds: expect.closeTo(6, 0) as any,
        parser: 'media-utils',
        videoStreams: [
          {
            id: 1,
            codec: 'h264',
            codecDetail: 'H264',
            width: 1280,
            height: 534,
            durationInSeconds: 6,
            fps: 24,
          },
        ],
      },
    },
    {
      filename: 'engine-start.mpeg2video.mp2.m2ts',
      options: { useParser: 'media-utils' },
      expectedMediaInfo: {
        audioStreams: [
          {
            id: 257,
            codec: 'mp2',
            codecDetail: 'MPEG-1 Layer II',
            sampleRate: 44100,
            channelCount: 2,
            bitrate: 384000,
            language: 'eng',
            codecDetails: {
              layer: 2,
              padding: 0,
            },
          },
        ],
        container: 'mpegts',
        containerDetail: 'mpegts',
        parser: 'media-utils',
        videoStreams: [
          {
            id: 256,
            codec: 'mpeg2video',
            width: 1280,
            height: 534,
            fps: 24,
          },
        ],
      },
    },
    {
      filename: 'engine-start.h264.aac.m2ts',
      options: { useParser: 'media-utils' },
      expectedMediaInfo: {
        container: 'mpegts',
        containerDetail: 'mpegts',
        parser: 'media-utils',
        audioStreams: [
          {
            id: 4352,
            codec: 'aac',
            codecDetail: 'AAC in ADTS',
            sampleRate: 44100,
            language: 'eng',
            channelCount: 2,
          },
        ],
        videoStreams: [
          {
            id: 4113,
            codec: 'h264',
            codecDetail: 'avc1.64001f',
            width: 1280,
            height: 534,
          },
        ],
      },
    },
    {
      filename: 'engine-start.h264.mp3.m2ts',
      options: { useParser: 'media-utils' },
      expectedMediaInfo: {
        container: 'mpegts',
        containerDetail: 'mpegts',
        parser: 'media-utils',
        audioStreams: [
          {
            id: 4352,
            codec: 'mp3',
            codecDetail: 'MPEG-1 Layer III',
            sampleRate: 44100,
            channelCount: 2,
            bitrate: 128000,
            durationInSeconds: undefined,
            language: 'eng',
            codecDetails: {
              layer: 3,
              padding: 0,
            },
          },
        ],
        videoStreams: [
          {
            id: 4113,
            codec: 'h264',
            codecDetail: 'avc1.64001f',
            width: 1280,
            height: 534,
          },
        ],
      },
    },
    {
      filename: 'engine-start.h264.aac.mp4',
      options: { useParser: 'media-utils' },
      expectedMediaInfo: {
        container: 'mp4',
        containerDetail: 'isom, isom, iso2, avc1, mp41',
        parser: 'media-utils',
        durationInSeconds: 6,
        audioStreams: [
          {
            id: 2,
            codec: 'aac',
            codecDetail: 'mp4a.40.02',
            sampleRate: 44100,
            channelCount: 2,
            bitrate: 127930,
            profile: 'LC',
            durationInSeconds: 6,
          },
        ],
        videoStreams: [
          {
            id: 1,
            codec: 'h264',
            codecDetail: 'avc1.64001f',
            width: 1280,
            height: 534,
            durationInSeconds: 6,
            bitrate: 349083,
            fps: 24,
          },
        ],
      },
    },
    {
      filename: 'engine-start.h264.aac.mov',
      options: { useParser: 'media-utils' },
      expectedMediaInfo: {
        container: 'mov',
        containerDetail: 'qt  , qt  ',
        parser: 'media-utils',
        durationInSeconds: 6.02,
        audioStreams: [
          {
            id: 2,
            codec: 'aac',
            codecDetail: 'mp4a',
            sampleRate: 44100,
            channelCount: 2,
            bitrate: 131692,
            durationInSeconds: 5.98204081632653,
          },
        ],
        videoStreams: [
          {
            id: 1,
            codec: 'h264',
            codecDetail: 'avc1.4d401f',
            width: 1280,
            height: 534,
            bitrate: 939149,
            durationInSeconds: 6.019694010416667,
            fps: 22.0941462755171,
          },
        ],
      },
    },
    {
      filename: 'engine-start.h264.mp3.mov',
      options: { useParser: 'media-utils' },
      expectedMediaInfo: {
        container: 'mov',
        containerDetail: 'qt  , qt  ',
        parser: 'media-utils',
        durationInSeconds: 6.042,
        audioStreams: [
          {
            id: 2,
            codec: 'mp3',
            codecDetail: '.mp3',
            sampleRate: 44100,
            channelCount: 2,
            bitrate: 191269,
            durationInSeconds: 6.0048979591836735,
          },
        ],
        videoStreams: [
          {
            id: 1,
            codec: 'h264',
            codecDetail: 'avc1.4d401f',
            width: 1280,
            height: 534,
            bitrate: 935734,
            durationInSeconds: 6.041666666666667,
            fps: 22.013793103448275,
          },
        ],
      },
    },
  ]);
});
