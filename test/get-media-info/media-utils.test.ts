import { describe, expect, it } from '@jest/globals';

import { getMediaInfoFromFile } from '../../src/get-media-info';
import { MediaInfo } from '../../src/media-info';
import { AsfMediaInfo, parseAsf } from '../../src/parsers/asf';
import { createReadableStreamFromFile } from '../../src/utils';
import { sampleFile } from '../test-utils';

describe('getMediaInfo with media-utils parser', () => {
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
