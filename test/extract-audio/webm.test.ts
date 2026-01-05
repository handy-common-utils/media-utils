import { describe, expect, it, jest } from '@jest/globals';

import { extractAudioFromFileToFile } from '../../src/extract-audio';
import { outputFile, runExtractAudioTestCases, sampleFile, trackFileForCleanup } from '../test-utils';

describe('Extract audio from WebM', () => {
  runExtractAudioTestCases([
    {
      filename: 'engine-start.vp9.opus.webm',
      expectedMediaInfo: {
        bytesRead: 65536,
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
      },
    },
    {
      filename: 'engine-start.vp9.vorbis.webm',
      expectedMediaInfo: {
        bytesRead: 65536,
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
      },
    },
  ]);

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
