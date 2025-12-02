import { describe, expect, it } from '@jest/globals';

import { getMediaInfoFromFile } from '../../src/get-media-info';
import { sampleFile } from '../test-utils';

describe('getMediaInfo with auto parser (default)', () => {
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
