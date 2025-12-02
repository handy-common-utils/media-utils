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
