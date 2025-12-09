import { describe, expect, it } from '@jest/globals';

import { getMediaInfoFromFile } from '../../src/get-media-info';
import { sampleFile } from '../test-utils';
import { isoboxerTestCases } from './isoboxer.config';
import { mp4boxTestCases } from './mp4box.config';
import { remotionTestCases } from './remotion.config';

describe('getMediaInfo with auto parser (default)', () => {
  const fixtures: Record<string, 'mp4box' | 'isoboxer' | 'remotion' | 'media-utils'> = Object.fromEntries(
    [...isoboxerTestCases.map((tc) => tc.filename), ...mp4boxTestCases.map((tc) => tc.filename), ...remotionTestCases.map((tc) => tc.filename)].map(
      (filename) => [filename, 'media-utils'],
    ),
  );

  it.each(Object.entries(fixtures))('should successfully parse %s using %s parser', async (filename, expectedParser) => {
    const info = await getMediaInfoFromFile(sampleFile(filename));

    // Verify the correct parser was used
    expect(info.parser).toBe(expectedParser);

    // Verify basic structure
    expect(info.container).toBeDefined();
    expect(info.audioStreams.length).toBeGreaterThan(0);
  });
});
