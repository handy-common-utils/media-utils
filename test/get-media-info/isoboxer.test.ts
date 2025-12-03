import { describe, expect, it } from '@jest/globals';

import { getMediaInfoFromFile } from '../../src/get-media-info';
import { MediaInfo } from '../../src/media-info';
import { sampleFile } from '../test-utils';

describe('getMediaInfo with isoboxer parser', () => {
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

  it.each([
    'engine-start.mjpeg.pcms16le.avi',
    'engine-start.h264.pcms16le.avi',
    'engine-start.mpeg2video.mp2.m2ts',
    'engine-start.vp9.opus.webm',
    'engine-start.vp8.vorbis.webm',
    'engine-start.vp9.vorbis.webm',
    'engine-start.av1.opus.webm',
    'engine-start.wmv2.wmav2.wmv',
    'large_matroska-test-files1.mkv',
    'large_matroska-test-files2.mkv',
    'large_matroska-test-files3.mkv',
    'engine-start.aac',
    'engine-start.mp3',
    'engine-start.opus.ogg',
    'engine-start.vorbis.ogg',
    'engine-start.pcms16le.wav',
    'engine-start.wmav2.wma',
  ])('should fail to parse %s', async (filename) => {
    try {
      await getMediaInfoFromFile(sampleFile(filename), { useParser: 'isoboxer' });
      expect('').toBe('should fail to parse');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty('isUnsupportedFormatError', true);
    }
  });
});
