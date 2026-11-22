import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';

import { getMediaInfo, GetMediaInfoResult } from '../../src/get-media-info';
import { GetMediaInfoTestCase, sampleFile } from '../test-utils';
import { largeAviTestCases } from './large-avi.config';
import { largeMkvTestCases } from './large-mkv.config';
import { largeMovTestCases } from './large-mov.config';
import { largeMp4TestCases } from './large-mp4.config';
import { largeWebmTestCases } from './large-webm.config';
import { mediaUtilsTestCases } from './media-utils.config';

/**
 * Opens a sample file as a Blob that reads from the disk
 * @param filename The name of the sample file
 * @returns The Blob
 */
async function sampleBlob(filename: string): Promise<Blob> {
  return fs.openAsBlob(sampleFile(filename));
}

/**
 * The result from a Blob is the same as from a stream,
 * except that bytesRead of MP4/MOV files with moov after mdat doesn't include the bytes skipped without being read.
 * (For moov-first files, bytesRead is small and nothing is skipped, so it must be the same.)
 * @param expected The expected result for a stream input
 * @returns The expected result for a Blob input
 */
function expectedForBlob(expected: GetMediaInfoTestCase['expectedMediaInfo']) {
  const result = { ...expected } as GetMediaInfoResult;
  const isSmall = typeof result.bytesRead === 'number' && result.bytesRead < 256 * 1024;
  if (!isSmall && result.bytesRead !== undefined && (result.container === 'mp4' || result.container === 'mov')) {
    result.bytesRead = expect.any(Number) as any;
  }
  return result;
}

describe('getMediaInfo with Blob input gives the same results as with stream input', () => {
  const testCases = [
    ...mediaUtilsTestCases,
    ...largeAviTestCases,
    ...largeMkvTestCases,
    ...largeMovTestCases,
    ...largeMp4TestCases,
    ...largeWebmTestCases,
  ];
  for (const { filename, options, expectedMediaInfo, shouldFail } of testCases) {
    it(`should ${shouldFail ? 'fail' : 'work'} with Blob of ${filename}`, async () => {
      const blob = await sampleBlob(filename);
      if (shouldFail) {
        await expect(getMediaInfo(blob, { ...options, useParser: 'media-utils' })).rejects.toHaveProperty('isUnsupportedFormatError', true);
      } else {
        const info = await getMediaInfo(blob, { ...options, useParser: 'media-utils' });
        expect(info).toEqual(expectedForBlob(expectedMediaInfo));
      }
    }, 10000);
  }
});

describe('getMediaInfo with Blob input skips media data in MP4/MOV files with moov after mdat', () => {
  it.each([
    ['large_BigBuckBunny.mp4', 64657027],
    ['large_TearsOfSteel.mov', 583774083],
  ])('should read only a small part of %s', async (filename, fileSize) => {
    const blob = await sampleBlob(filename);
    expect(blob.size).toBe(fileSize);
    const info = await getMediaInfo(blob, { useParser: 'media-utils' });
    expect(info.audioStreams.length).toBeGreaterThan(0);
    expect(info.videoStreams.length).toBeGreaterThan(0);
    expect(info.bytesRead).toBeGreaterThan(0);
    // moov is about 100 KB - 1 MB for these files, the rest is skipped
    expect(info.bytesRead).toBeLessThan(2 * 1024 * 1024);
  });

  it('should still find the info with a small maxBytesToRead', async () => {
    const blob = await sampleBlob('large_TearsOfSteel.mov');
    const info = await getMediaInfo(blob, { useParser: 'media-utils', maxBytesToRead: 2 * 1024 * 1024 });
    expect(info.container).toBe('mov');
    expect(info.audioStreams.length).toBeGreaterThan(0);
  });

  it('should return sample tables when sampleTableInfo is true', async () => {
    const blob = await sampleBlob('large_BigBuckBunny.mp4');
    const info = await getMediaInfo(blob, { useParser: 'media-utils', sampleTableInfo: true });
    const audio = info.audioStreams[0] as any;
    expect(audio.sampleTableInfo).toBeDefined();
    expect(audio.sampleTableInfo.chunkOffsets.length).toBeGreaterThan(0);
    expect(audio.sampleTableInfo.mdatStart).toBeGreaterThan(0);
  });
});

describe('getMediaInfo with Blob input and other parsers', () => {
  it.each(['mp4box', 'remotion', 'isoboxer', 'auto'] as const)('should work with %s parser', async (useParser) => {
    const blob = await sampleBlob('engine-start.h264.aac.mp4');
    const info = await getMediaInfo(blob, { useParser });
    expect(info.container).toBe('mp4');
    expect(info.audioStreams[0].codec).toBe('aac');
  });
});
