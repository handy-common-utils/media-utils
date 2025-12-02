import { describe, expect, it } from '@jest/globals';
import path from 'node:path';

import { getMediaInfoFromFile } from '../src/get-media-info';
import { MediaInfo } from '../src/media-info';
import { AsfMediaInfo, parseAsf } from '../src/parsers/asf';
import { createReadableStreamFromFile } from '../src/utils';

// eslint-disable-next-line unicorn/prefer-module
const SAMPLE_DIR = path.join(__dirname, 'sample-media-files');
function sampleFile(filename: string) {
  return path.join(SAMPLE_DIR, filename);
}

describe('getMediaInfo with real files', () => {
  describe('mp4box parser', () => {
    it('should parse engine-start.h264.aac.mp4 file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.aac.mp4'), { useParser: 'mp4box' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 2,
            bitrate: 128127.0481418919,
            channelCount: 2,
            codec: 'aac',
            codecDetail: 'mp4a.40.2',
            durationInSeconds: 6,
            sampleRate: 44100,
            profile: 'LC',
          },
        ],
        container: 'mp4',
        containerDetail: 'isom, isom, iso2, avc1, mp41',
        durationInSeconds: 6,
        mimeType: 'video/mp4; codecs="avc1.64001f,mp4a.40.2"; profiles="isom,iso2,avc1,mp41"',
        parser: 'mp4box',
        videoStreams: [
          {
            id: 1,
            bitrate: 349082.6666666667,
            codec: 'h264',
            codecDetail: 'avc1.64001f',
            durationInSeconds: 6,
            fps: 24,
            height: 534,
            width: 1280,
          },
        ],
      } as MediaInfo);
    });

    it('should parse engine-start.h264.mp3.mp4 file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.mp3.mp4'), { useParser: 'mp4box' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 2,
            bitrate: 128553.40909090909,
            channelCount: 2,
            codec: 'mp3',
            codecDetail: 'mp4a.6b',
            durationInSeconds: 6.013968253968254,
            sampleRate: 44100,
          },
        ],
        container: 'mp4',
        containerDetail: 'isom, isom, iso2, avc1, mp41',
        durationInSeconds: 6.014,
        mimeType: 'video/mp4; codecs="avc1.64001f,mp4a.6b"; profiles="isom,iso2,avc1,mp41"',
        parser: 'mp4box',
        videoStreams: [
          {
            id: 1,
            bitrate: 349082.6666666667,
            codec: 'h264',
            codecDetail: 'avc1.64001f',
            durationInSeconds: 6,
            fps: 24,
            height: 534,
            width: 1280,
          },
        ],
      } as MediaInfo);
    });

    it('should parse engine-start.h264.aac.mov file (ISO BMFF)', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.aac.mov'), { useParser: 'mp4box' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 2,
            bitrate: 131500.0999273256,
            channelCount: 2,
            codec: 'aac',
            codecDetail: 'mp4a',
            durationInSeconds: 5.98204081632653,
            sampleRate: 44100,
            profile: 'LC',
          },
        ],
        container: 'mov',
        containerDetail: 'qt  , qt  ',
        durationInSeconds: 6.02,
        mimeType: 'video/mp4; codecs="avc1.4d401f,mp4a"; profiles="qt  "',
        parser: 'mp4box',
        videoStreams: [
          {
            id: 1,
            bitrate: 939149.3969987833,
            codec: 'h264',
            codecDetail: 'avc1.4d401f',
            durationInSeconds: 6.019694010416667,
            fps: 22.0941462755171,
            height: 534,
            width: 1280,
          },
        ],
      } as MediaInfo);
    });

    it('should partially parse engine-start.h264.mp3.mov file (ISO BMFF)', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.mp3.mov'), { useParser: 'mp4box' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 2,
            bitrate: 191269.19521479064,
            channelCount: undefined,
            codec: 'mp3',
            codecDetail: 'mp3',
            durationInSeconds: 6.0048979591836735,
            sampleRate: undefined,
          },
        ],
        container: 'mov',
        containerDetail: 'qt  , qt  ',
        durationInSeconds: 6.042,
        mimeType: 'video/mp4; codecs="avc1.4d401f,mp3"; profiles="qt  "',
        parser: 'mp4box',
        videoStreams: [
          {
            id: 1,
            bitrate: 935733.848275862,
            codec: 'h264',
            codecDetail: 'avc1.4d401f',
            durationInSeconds: 6.041666666666667,
            fps: 22.013793103448275,
            height: 534,
            width: 1280,
          },
        ],
      } as MediaInfo);
    });

    it.each([
      'engine-start.mjpeg.pcms16le.avi',
      'engine-start.h264.pcms16le.avi',
      'engine-start.mpeg2video.mp2.m2ts',
      'engine-start.vp9.opus.webm',
      'engine-start.wmv2.wmav2.wmv',
    ])('should fail to parse %s', async (filename) => {
      try {
        await getMediaInfoFromFile(sampleFile(filename), { useParser: 'mp4box' });
        expect('').toBe('should fail to parse');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty('isUnsupportedFormatError', true);
      }
    });
  });

  describe('isoboxer parser', () => {
    it('should parse engine-start.h264.aac.mp4 file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.aac.mp4'), { useParser: 'isoboxer' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 2,
            channelCount: 2,
            codec: 'aac',
            codecDetail: 'mp4a.40',
            durationInSeconds: 6,
            sampleRate: 44100,
          },
        ],
        container: 'mp4',
        containerDetail: 'isom, isom, iso2, avc1, mp41',
        durationInSeconds: 6,
        parser: 'isoboxer',
        videoStreams: [
          {
            id: 1,
            codec: 'h264',
            codecDetail: 'avc1',
            durationInSeconds: 6,
            height: 534,
            width: 1280,
          },
        ],
      } as MediaInfo);
    });

    it('should parse engine-start.h264.mp3.mp4 file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.mp3.mp4'), { useParser: 'isoboxer' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 2,
            channelCount: 2,
            codec: 'mp3',
            codecDetail: 'mp4a.6b',
            durationInSeconds: 6.013968253968254,
            sampleRate: 44100,
          },
        ],
        container: 'mp4',
        containerDetail: 'isom, isom, iso2, avc1, mp41',
        durationInSeconds: 6.014,
        parser: 'isoboxer',
        videoStreams: [
          {
            id: 1,
            codec: 'h264',
            codecDetail: 'avc1',
            durationInSeconds: 6,
            height: 534,
            width: 1280,
          },
        ],
      } as MediaInfo);
    });

    it('should parse engine-start.h264.aac.mov file (ISO BMFF)', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.aac.mov'), { useParser: 'isoboxer' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 2,
            channelCount: 2,
            codec: 'aac',
            codecDetail: 'mp4a.40',
            durationInSeconds: 5.98204081632653,
            sampleRate: 44100,
          },
        ],
        container: 'mov',
        containerDetail: 'qt  , qt  ',
        durationInSeconds: 6.02,
        parser: 'isoboxer',
        videoStreams: [
          {
            id: 1,
            codec: 'h264',
            codecDetail: 'avc1',
            durationInSeconds: 6.019694010416667,
            height: 534,
            width: 1280,
          },
        ],
      } as MediaInfo);
    });

    it('should partially parse engine-start.h264.mp3.mov file (ISO BMFF)', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.mp3.mov'), { useParser: 'isoboxer' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 2,
            channelCount: undefined, // can't be found in ESDS
            codec: 'mp3',
            codecDetail: '.mp3',
            durationInSeconds: 6.0048979591836735,
            sampleRate: undefined, // can't be found in ESDS
          },
        ],
        container: 'mov',
        containerDetail: 'qt  , qt  ',
        durationInSeconds: 6.042,
        parser: 'isoboxer',
        videoStreams: [
          {
            id: 1,
            codec: 'h264',
            codecDetail: 'avc1',
            durationInSeconds: 6.041666666666667,
            height: 534,
            width: 1280,
          },
        ],
      } as MediaInfo);
    });

    it.each(['engine-start.mjpeg.pcms16le.avi', 'engine-start.h264.pcms16le.avi', 'engine-start.mpeg2video.mp2.m2ts', 'engine-start.vp9.opus.webm'])(
      'should fail to parse %s',
      async (filename) => {
        try {
          await getMediaInfoFromFile(sampleFile(filename), { useParser: 'isoboxer' });
          expect('').toBe('should fail to parse');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty('isUnsupportedFormatError', true);
        }
      },
    );
  });

  describe('inhouse parser', () => {
    it('should parse engine-start.aac file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.aac'), { useParser: 'media-utils' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 1,
            channelCount: 2,
            codec: 'aac',
            codecDetail: 'mp4a.40.2',
            durationInSeconds: undefined,
            sampleRate: 44100,
            profile: 'LC',
          },
        ],
        container: 'aac',
        containerDetail: 'aac',
        durationInSeconds: undefined,
        parser: 'media-utils',
        videoStreams: [],
      } as MediaInfo);
    });

    it('should parse engine-start.mp3 file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.mp3'), { useParser: 'media-utils' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 1,
            bitrate: 64000,
            channelCount: 2,
            codec: 'mp3',
            codecDetail: 'mp3',
            durationInSeconds: expect.closeTo(6, 0.1),
            sampleRate: 44100,
          },
        ],
        container: 'mp3',
        containerDetail: 'mp3',
        durationInSeconds: expect.closeTo(6, 0.1),
        parser: 'media-utils',
        videoStreams: [],
      });
    });

    it('should parse engine-start.vp9.opus.webm file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.vp9.opus.webm'), { useParser: 'media-utils' });
      expect(info).toEqual({
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
      } as MediaInfo);
    });

    it('should parse engine-start.vp8.vorbis.webm file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.vp8.vorbis.webm'), { useParser: 'media-utils' });
      expect(info).toEqual({
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
      } as MediaInfo);
    });

    it('should parse engine-start.vp9.vorbis.webm file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.vp9.vorbis.webm'), { useParser: 'media-utils' });
      expect(info).toEqual({
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
      } as MediaInfo);
    });

    it('should parse engine-start.av1.opus.webm file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.av1.opus.webm'), { useParser: 'media-utils' });
      expect(info).toEqual({
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
      } as MediaInfo);
    });

    it('should parse engine-start.pcms16le.wav file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.pcms16le.wav'), { useParser: 'media-utils' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 1,
            channelCount: 2,
            codec: 'pcm_s16le',
            codecDetail: 'pcm_s16le',
            durationInSeconds: expect.closeTo(6, 0.1),
            sampleRate: 44100,
          },
        ],
        container: 'wav',
        containerDetail: 'wav',
        durationInSeconds: expect.closeTo(6, 0.1),
        parser: 'media-utils',
        videoStreams: [],
      });
    });

    it('should parse engine-start.vorbis.ogg file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.vorbis.ogg'), { useParser: 'media-utils' });
      expect(info).toEqual({
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
      } as MediaInfo);
    });

    it('should parse engine-start.opus.ogg file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.opus.ogg'), { useParser: 'media-utils' });
      expect(info).toEqual({
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
      } as MediaInfo);
    });

    it('should parse engine-start.wmav2.wma file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.wmav2.wma'), { useParser: 'media-utils' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 1,
            channelCount: 2,
            codec: 'wmav2',
            codecDetail: 'WMAv2',
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
      } as AsfMediaInfo);
    });

    it('should parse engine-start.wmv2.wmav2.wmv file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.wmv2.wmav2.wmv'), { useParser: 'media-utils' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 2,
            channelCount: 2,
            codec: 'wmav2',
            codecDetail: 'WMAv2',
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
      } as AsfMediaInfo);
    });

    it('should parse engine-start.wmv2.wmav2.wmv file and return additional information', async () => {
      const webStream = await createReadableStreamFromFile(sampleFile('engine-start.wmv2.wmav2.wmv'));
      const info = await parseAsf(webStream, { extractStreams: [2] });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 2,
            channelCount: 2,
            codec: 'wmav2',
            codecDetail: 'WMAv2',
            durationInSeconds: 6,
            sampleRate: 44100,
            bitsPerSample: 16,
          },
        ],
        container: 'asf',
        containerDetail: 'wmv',
        durationInSeconds: 6,
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
      } as AsfMediaInfo);
      const { additionalStreamInfo: extractedStreamInfo } = info;
      expect(extractedStreamInfo).toBeDefined();
      expect(extractedStreamInfo?.size).toEqual(2);
      expect(extractedStreamInfo?.get(1)).toEqual({
        codecPrivate: expect.any(Uint8Array),
        extendedStreamPropertiesObject: expect.any(Uint8Array),
      });
      expect(extractedStreamInfo?.get(2)).toEqual({
        codecPrivate: expect.any(Uint8Array),
        extendedStreamPropertiesObject: expect.any(Uint8Array),
      });
    });

    it.each(['engine-start.h264.aac.mp4', 'engine-start.mjpeg.pcms16le.avi', 'engine-start.h264.pcms16le.avi', 'engine-start.mpeg2video.mp2.m2ts'])(
      'should fail to parse %s',
      async (filename) => {
        try {
          await getMediaInfoFromFile(sampleFile(filename), { useParser: 'media-utils' });
          expect('').toBe('should fail to parse');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty('isUnsupportedFormatError', true);
        }
      },
    );
  });

  describe('remotion parser', () => {
    it('should parse engine-start.h264.aac.mp4 file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.aac.mp4'), { useParser: 'remotion' });
      expect(info).toEqual({
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
      } as MediaInfo);
    });

    it('should parse engine-start.h264.mp3.mp4 file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.mp3.mp4'), { useParser: 'remotion' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 2,
            channelCount: 2,
            codec: 'mp3',
            codecDetail: 'mp3',
            durationInSeconds: 6.014,
            sampleRate: 44100,
          },
        ],
        container: 'mp4',
        containerDetail: 'mp4',
        durationInSeconds: 6.014,
        mimeType: undefined,
        parser: 'remotion',
        videoStreams: [
          {
            id: 1,
            codec: 'h264',
            codecDetail: 'avc1.64001f',
            durationInSeconds: 6.014,
            height: 534,
            width: 1280,
          },
        ],
      } as MediaInfo);
    });

    it('should parse engine-start.h264.aac.mov file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.aac.mov'), { useParser: 'remotion' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 2,
            channelCount: 2,
            codec: 'aac',
            codecDetail: 'mp4a.40.02',
            durationInSeconds: 6.02,
            sampleRate: 44100,
          },
        ],
        container: 'mp4',
        containerDetail: 'mp4',
        durationInSeconds: 6.02,
        mimeType: undefined,
        parser: 'remotion',
        videoStreams: [
          {
            id: 1,
            codec: 'h264',
            codecDetail: 'avc1.4d401f',
            durationInSeconds: 6.02,
            height: 534,
            width: 1280,
          },
        ],
      } as MediaInfo);
    });

    it('should parse engine-start.vp9.opus.webm file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.vp9.opus.webm'), { useParser: 'remotion' });
      expect(info).toEqual({
        audioStreams: [
          {
            id: 2,
            channelCount: 2,
            codec: 'opus',
            codecDetail: 'opus',
            durationInSeconds: 6.008,
            sampleRate: 48000,
          },
        ],
        container: 'webm',
        containerDetail: 'webm',
        durationInSeconds: 6.008,
        mimeType: undefined,
        parser: 'remotion',
        videoStreams: [
          {
            id: 1,
            codec: 'vp9',
            codecDetail: 'vp09.00.10.08',
            durationInSeconds: 6.008,
            height: 534,
            width: 1280,
          },
        ],
      } as MediaInfo);
    });

    it.each([
      'engine-start.h264.mp3.mov',
      'engine-start.mjpeg.pcms16le.avi',
      'engine-start.h264.pcms16le.avi',
      'engine-start.mpeg2video.mp2.m2ts',
      'engine-start.wmv2.wmav2.wmv',
    ])('should fail to parse %s', async (filename) => {
      try {
        await getMediaInfoFromFile(sampleFile(filename), { useParser: 'remotion' });
        expect('').toBe('should fail to parse');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty('isUnsupportedFormatError', true);
        // expect(error).toHaveProperty('xx', true);
      }
    });
  });

  describe('auto parser (default)', () => {
    const fixtures: Record<string, 'mp4box' | 'isoboxer' | 'remotion' | 'media-utils'> = {
      'engine-start.h264.aac.mp4': 'mp4box',
      'engine-start.h264.mp3.mp4': 'mp4box',
      'engine-start.h264.aac.mov': 'mp4box',
      'engine-start.h264.mp3.mov': 'mp4box',
      'engine-start.vp9.opus.webm': 'media-utils',
      'engine-start.wmv2.wmav2.wmv': 'media-utils',
    };

    it.each(Object.entries(fixtures))('should successfully parse %s using %s parser', async (filename, expectedParser) => {
      const info = await getMediaInfoFromFile(sampleFile(filename));

      // Verify the correct parser was used
      expect(info.parser).toBe(expectedParser);

      // Verify basic structure
      expect(info.container).toBeDefined();
      expect(info.videoStreams.length).toBeGreaterThan(0);
    });

    it.each(['engine-start.mjpeg.pcms16le.avi', 'engine-start.h264.pcms16le.avi', 'engine-start.mpeg2video.mp2.m2ts'])(
      'should fail to parse %s',
      async (filename) => {
        try {
          await getMediaInfoFromFile(sampleFile(filename));
          expect('').toBe('should fail to parse');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty('isUnsupportedFormatError', true);
          // expect(error).toHaveProperty('xx', true);
        }
      },
    );
  });
});
