import { describe, expect, it } from '@jest/globals';

import { getMediaInfoFromFile } from '../../src/get-media-info';
import { MediaInfo } from '../../src/media-info';
import { sampleFile } from '../test-utils';

describe('getMediaInfo with remotion parser', () => {
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
    } as MediaInfo);
  });

  it('should parse engine-start.vp8.vorbis.webm file', async () => {
    const info = await getMediaInfoFromFile(sampleFile('engine-start.vp8.vorbis.webm'), { useParser: 'remotion' });
    expect(info).toEqual({
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
    } as MediaInfo);
  });

  it('should parse engine-start.vp9.vorbis.webm file', async () => {
    const info = await getMediaInfoFromFile(sampleFile('engine-start.vp9.vorbis.webm'), { useParser: 'remotion' });
    expect(info).toEqual({
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
    } as MediaInfo);
  });

  it('should parse large_matroska-test-files2.mkv with h264 video and aac audio', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_matroska-test-files2.mkv'), { useParser: 'remotion' });
    expect(info).toEqual({
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
    } as MediaInfo);
  }, 10000);

  it('should parse large_matroska-test-files3.mkv with h264 video and mp3 audio', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_matroska-test-files3.mkv'), { useParser: 'remotion' });
    expect(info).toEqual({
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
    } as MediaInfo);
  }, 10000);

  it.each([
    'engine-start.h264.mp3.mov',
    'engine-start.mjpeg.pcms16le.avi',
    'engine-start.h264.pcms16le.avi',
    'engine-start.mpeg2video.mp2.m2ts',
    'engine-start.wmv2.wmav2.wmv',
    'engine-start.av1.opus.webm',
    'engine-start.opus.ogg',
    'engine-start.vorbis.ogg',
    'engine-start.wmav2.wma',
    'large_matroska-test-files1.mkv',
    'large_matroska-test-files4.mkv',
  ])('should fail to parse %s', async (filename) => {
    try {
      await getMediaInfoFromFile(sampleFile(filename), { useParser: 'remotion' });
      expect('').toBe('should fail to parse');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if ((error as any).isUnsupportedFormatError !== true) {
        console.error(error);
      }
      expect(error).toHaveProperty('isUnsupportedFormatError', true);
    }
  });
});
