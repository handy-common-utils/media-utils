import { describe, expect, it } from '@jest/globals';

import { getMediaInfoFromFile } from '../../src/get-media-info';
import { MediaInfo } from '../../src/media-info';
import { sampleFile } from '../test-utils';

describe('getMediaInfo with large MKV files', () => {
  it.skip('should parse large_matroska-test-files1.mkv with msmpeg4v2 video and mp3 audio', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_matroska-test-files1.mkv'));

    expect(info).toEqual({
      parser: 'media-utils',
      container: 'mkv',
      containerDetail: 'matroska',
      durationInSeconds: expect.closeTo(87, 0) as any,
      videoStreams: [
        {
          id: 1,
          codec: 'mpeg4',
          codecDetail: '',
          width: 854,
          height: 480,
          durationInSeconds: expect.closeTo(87, 0) as any,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'mp3',
          codecDetail: '',
          channelCount: 2,
          sampleRate: 48000,
          bitsPerSample: 1,
          durationInSeconds: expect.closeTo(87, 0) as any,
        },
      ],
    } as MediaInfo);
  }, 10000); // 10 second timeout for large file

  it('should parse large_matroska-test-files2.mkv with h264 video and aac audio', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_matroska-test-files2.mkv'));

    expect(info).toEqual({
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
    } as MediaInfo);
  }, 10000);

  it('should parse large_matroska-test-files3.mkv with h264 video and mp3 audio', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_matroska-test-files3.mkv'));

    expect(info).toEqual({
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
    } as MediaInfo);
  }, 10000);

  it.skip('should parse large_matroska-test-files4.mkv with theora video and vorbis audio', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_matroska-test-files4.mkv'));

    expect(info).toEqual({
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
    } as MediaInfo);
  }, 10000);

  it('should parse large_matroska-test-files5.mkv with h264 video, multiple aac audio tracks and subtitles', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_matroska-test-files5.mkv'));
    expect(info).toEqual({
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
    } as MediaInfo);
  }, 10000);

  it.skip('should parse large_matroska-test-files6.mkv with msmpeg4v2 video and mp3 audio', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_matroska-test-files6.mkv'));
    expect(info).toEqual({
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
    } as MediaInfo);
  }, 10000);

  it('should parse large_matroska-test-files7.mkv with h264 video and aac audio', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_matroska-test-files7.mkv'));
    expect(info).toEqual({
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
    } as MediaInfo);
  }, 10000);

  it('should parse large_matroska-test-files8.mkv with h264 video and aac audio', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_matroska-test-files8.mkv'));
    expect(info).toEqual({
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
    } as MediaInfo);
  }, 10000);
});
