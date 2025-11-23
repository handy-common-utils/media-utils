import { describe, expect, it } from '@jest/globals';
import path from 'node:path';

import { getMediaInfoFromFile } from '../src/get-media-info';
import { MediaInfo } from '../src/media-info';

// eslint-disable-next-line unicorn/prefer-module
const SAMPLE_DIR = path.join(__dirname, 'sample-media-files');
function sampleFile(filename: string) {
  return path.join(SAMPLE_DIR, filename);
}

describe('getMediaInfo with real files', () => {
  describe('mp4box parser', () => {
    it('should parse entine-start.h264.aac.mp4 file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.aac.mp4'), { useParser: 'mp4box' });
      expect(info.container).toBe('mp4');
      expect(info.videoStreams.length).toBeGreaterThan(0);
      expect(info.audioStreams.length).toBeGreaterThan(0);
      expect(info).toEqual({
        audioStreams: [
          {
            bitrate: 128127.0481418919,
            channelCount: 2,
            codec: 'aac',
            codecDetail: 'mp4a.40.2',
            durationInSeconds: 6,
            sampleRate: 44100,
          },
        ],
        container: 'mp4',
        containerDetail: 'isom, isom, iso2, avc1, mp41',
        durationInSeconds: 6,
        mimeType: 'video/mp4; codecs="avc1.64001f,mp4a.40.2"; profiles="isom,iso2,avc1,mp41"',
        parser: 'mp4box',
        videoStreams: [
          {
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

    it('should parse entine-start.h264.mp3.mp4 file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.mp3.mp4'), { useParser: 'mp4box' });
      expect(info.container).toBe('mp4');
      expect(info.videoStreams.length).toBeGreaterThan(0);
      expect(info.audioStreams.length).toBeGreaterThan(0);
      expect(info).toEqual({
        audioStreams: [
          {
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
      expect(info.container).toBe('mp4'); // mp4box reports mov as mp4 usually or compatible
      expect(info.videoStreams.length).toBeGreaterThan(0);
      expect(info.audioStreams.length).toBeGreaterThan(0);
      expect(info).toEqual({
        audioStreams: [
          {
            bitrate: 131500.0999273256,
            channelCount: 2,
            codec: 'aac',
            codecDetail: 'mp4a',
            durationInSeconds: 5.98204081632653,
            sampleRate: 44100,
          },
        ],
        container: 'mp4',
        containerDetail: 'qt  , qt  ',
        durationInSeconds: 6.02,
        mimeType: 'video/mp4; codecs="avc1.4d401f,mp4a"; profiles="qt  "',
        parser: 'mp4box',
        videoStreams: [
          {
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
      expect(info.container).toBe('mp4'); // mp4box reports mov as mp4 usually or compatible
      expect(info.videoStreams.length).toBeGreaterThan(0);
      // expect(info.audioStreams.length).toBeGreaterThan(0); // it doesn't seem to recognise mp3 audio in mov
      expect(info).toEqual({
        audioStreams: [
          // {
          //   bitrate: 128127.0481418919,
          //   channelCount: 2,
          //   codec: 'aac',
          //   codecDetail: 'mp4a.40.2',
          //   durationInSeconds: 6,
          //   sampleRate: 44100,
          // },
        ],
        container: 'mp4',
        containerDetail: 'qt  , qt  ',
        durationInSeconds: 6.042,
        mimeType: 'video/mp4; codecs="avc1.4d401f,mp3"; profiles="qt  "',
        parser: 'mp4box',
        videoStreams: [
          {
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

  describe('remotion parser', () => {
    it('should parse entine-start.h264.aac.mp4 file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.aac.mp4'), { useParser: 'remotion' });
      expect(info.container).toBe('mp4');
      expect(info.videoStreams.length).toBeGreaterThan(0);
      expect(info.audioStreams.length).toBeGreaterThan(0);
      expect(info).toEqual({
        audioStreams: [
          {
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
            codec: 'h264',
            codecDetail: 'avc1.64001f',
            durationInSeconds: 6,
            height: 534,
            width: 1280,
          },
        ],
      } as MediaInfo);
    });

    it('should parse entine-start.h264.mp3.mp4 file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.mp3.mp4'), { useParser: 'remotion' });
      expect(info.container).toBe('mp4');
      expect(info.videoStreams.length).toBeGreaterThan(0);
      expect(info.audioStreams.length).toBeGreaterThan(0);
      expect(info).toEqual({
        audioStreams: [
          {
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
            codec: 'h264',
            codecDetail: 'avc1.64001f',
            durationInSeconds: 6.014,
            height: 534,
            width: 1280,
          },
        ],
      } as MediaInfo);
    });

    it('should parse entine-start.h264.aac.mov file', async () => {
      const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.aac.mov'), { useParser: 'remotion' });
      expect(info.container).toBe('mp4');
      expect(info.videoStreams.length).toBeGreaterThan(0);
      expect(info.audioStreams.length).toBeGreaterThan(0);
      expect(info).toEqual({
        audioStreams: [
          {
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
      expect(info.container).toBe('webm');
      expect(info.videoStreams.length).toBeGreaterThan(0);
      expect(info.audioStreams.length).toBeGreaterThan(0);
      expect(info).toEqual({
        audioStreams: [
          {
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

  /*
  describe('auto parser (default)', () => {
    const allFiles = [mp4File, movFile, ...otherFiles];

    it.each(allFiles)('should parse %s', async (filename) => {
      const info = await getMediaInfoFromFile(filename, { useParser: 'auto' });
      expect(info.videoStreams.length).toBeGreaterThan(0);
      expect(info.audioStreams.length).toBeGreaterThan(0);
    });
  });

  describe('Consistency check', () => {
    it('should return consistent MediaInfo for .mp4 file between parsers', async () => {
      const mp4boxInfo = await getMediaInfoFromFile(mp4File, {
        useParser: 'mp4box',
      });

      const remotionInfo = await getMediaInfoFromFile(mp4File, {
        useParser: 'remotion',
      });

      // Compare key fields. Note: Exact equality might fail due to floating point differences or minor parsing variations.
      // We check for "reasonable" equality.

      expect(mp4boxInfo.container).toBe('mp4');
      // Remotion might report 'mov' or 'mp4' depending on implementation, but for .mp4 file it should be mp4
      expect(remotionInfo.container).toBe('mp4');

      expect(mp4boxInfo.videoStreams.length).toBe(remotionInfo.videoStreams.length);
      expect(mp4boxInfo.audioStreams.length).toBe(remotionInfo.audioStreams.length);

      // Duration might slightly differ due to timescale
      expect(Math.abs((mp4boxInfo.durationInSeconds || 0) - (remotionInfo.durationInSeconds || 0))).toBeLessThan(0.1);

      // Video codec
      expect(mp4boxInfo.videoStreams[0].codec).toBeDefined();
      expect(remotionInfo.videoStreams[0].codec).toBeDefined();

      // Dimensions
      expect(mp4boxInfo.videoStreams[0].width).toBe(remotionInfo.videoStreams[0].width);
      expect(mp4boxInfo.videoStreams[0].height).toBe(remotionInfo.videoStreams[0].height);
    });
  });
*/
});
