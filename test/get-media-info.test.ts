import { describe, expect, it } from '@jest/globals';
import path from 'node:path';

import { getMediaInfoFromFile } from '../src/get-media-info';

// eslint-disable-next-line unicorn/prefer-module
const SAMPLE_DIR = path.join(__dirname, 'sample-media-files');

describe('getMediaInfo with real files', () => {
  const mp4File = path.join(SAMPLE_DIR, 'engine-start.mp4');
  const movFile = path.join(SAMPLE_DIR, 'engine-start.mov');
  const otherFiles = [
    path.join(SAMPLE_DIR, 'engine-start.avi'),
    path.join(SAMPLE_DIR, 'engine-start.m2ts'),
    path.join(SAMPLE_DIR, 'engine-start.webm'),
    path.join(SAMPLE_DIR, 'engine-start.wmv'),
  ];

  describe('mp4box parser', () => {
    it('should parse .mp4 file', async () => {
      const info = await getMediaInfoFromFile(mp4File, { useParser: 'mp4box' });
      expect(info.container).toBe('mp4');
      expect(info.videoStreams.length).toBeGreaterThan(0);
      expect(info.audioStreams.length).toBeGreaterThan(0);
      expect(info).toEqual({});
    });

    it('should parse .mov file (ISO BMFF)', async () => {
      const info = await getMediaInfoFromFile(movFile, { useParser: 'mp4box' });
      expect(info.container).toBe('mp4'); // mp4box reports mov as mp4 usually or compatible
      expect(info.videoStreams.length).toBeGreaterThan(0);
      expect(info.audioStreams.length).toBeGreaterThan(0);
      expect(info).toEqual({});
    });

    it.each(otherFiles)('should fail to parse %s', async (filename) => {
      try {
        await getMediaInfoFromFile(filename, { useParser: 'mp4box' });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty('isUnsupportedFormatError', true);
      }
    });
  });

  describe('remotion parser', () => {
    const allFiles = [mp4File, movFile, ...otherFiles];

    it.each(allFiles)('should parse %s', async (filename) => {
      const info = await getMediaInfoFromFile(filename, {
        useParser: 'remotion',
      });
      expect(info.videoStreams.length).toBeGreaterThan(0);
      expect(info.audioStreams.length).toBeGreaterThan(0);
      expect(info).toEqual({});
    });
  });

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
});
