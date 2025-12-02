import { describe, expect, it, jest } from '@jest/globals';
import fs from 'node:fs';

import { extractAudioFromFileToFile } from '../../src/extract-audio';
import { getMediaInfoFromFile } from '../../src/get-media-info';
import { outputFile, sampleFile, setupCleanup, trackFileForCleanup } from '../test-utils';

setupCleanup();

describe('Extract audio from WebM', () => {
  it('should extract Opus audio from WebM file', async () => {
    const inputFile = sampleFile('engine-start.vp9.opus.webm');
    const outputFilePath = outputFile('extracted-opus-from-webm.ogg');

    // Extract audio to file
    await extractAudioFromFileToFile(inputFile, outputFilePath);

    // Verify the file was created and has content
    expect(fs.existsSync(outputFilePath)).toBe(true);
    const stats = fs.statSync(outputFilePath);
    expect(stats.size).toBeGreaterThan(0);

    await extractAudioFromFileToFile(inputFile, outputFilePath);

    expect(fs.existsSync(outputFilePath)).toBe(true);

    // Verify the extracted audio can be parsed
    const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath);

    // Verify it's recognized as Opus in OGG container
    expect(extractedAudioInfo).toEqual({
      container: 'ogg',
      containerDetail: 'ogg',
      parser: 'media-utils',
      durationInSeconds: undefined,
      videoStreams: [],
      audioStreams: [
        {
          id: 1,
          codec: 'opus',
          codecDetail: 'opus',
          channelCount: 2,
          sampleRate: 48000,
          durationInSeconds: undefined,
        },
      ],
    });

    trackFileForCleanup(outputFilePath);
  });

  it('should extract Vorbis audio from WebM file', async () => {
    const inputFile = sampleFile('engine-start.vp9.vorbis.webm');
    const outputFilePath = outputFile('extracted-vorbis-from-webm.ogg');

    await extractAudioFromFileToFile(inputFile, outputFilePath);

    expect(fs.existsSync(outputFilePath)).toBe(true);

    // Verify the extracted audio can be parsed
    const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath);

    // Verify it's recognized as Vorbis in OGG container
    expect(extractedAudioInfo).toEqual({
      container: 'ogg',
      containerDetail: 'ogg',
      parser: 'media-utils',
      durationInSeconds: undefined,
      videoStreams: [],
      audioStreams: [
        {
          id: 1,
          codec: 'vorbis',
          codecDetail: 'vorbis',
          channelCount: 2,
          sampleRate: 48000,
          durationInSeconds: undefined,
        },
      ],
    });

    trackFileForCleanup(outputFilePath);
  });

  it('should report progress when extracting from WebM', async () => {
    const inputFile = sampleFile('engine-start.vp9.opus.webm');
    const outputFilePath = outputFile('progress-test-webm.ogg');
    const onProgress = jest.fn();

    await extractAudioFromFileToFile(inputFile, outputFilePath, { onProgress });

    expect(onProgress).toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(expect.any(Number));
    const fistProgress = onProgress.mock.calls.at(0)?.[0];
    expect(fistProgress).toEqual(0);
    const lastProgress = onProgress.mock.calls.at(-1)?.[0];
    expect(lastProgress).toEqual(100);

    trackFileForCleanup(outputFilePath);
  });
});
