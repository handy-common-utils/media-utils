import { describe, expect, it, jest } from '@jest/globals';

import { extractAudioFromFileToFile } from '../../src/extract-audio';
import { outputFile, runExtractAudioTestCases, sampleFile, trackFileForCleanup } from '../test-utils';

describe('Extract audio from ASF/WMV', () => {
  runExtractAudioTestCases([
    {
      filename: 'engine-start.wmv2.wmav2.wmv',
      expectedMediaInfo: {
        bytesRead: 65536,
        parser: 'media-utils',
        container: 'asf',
        containerDetail: 'wma',
        durationInSeconds: 6,
        videoStreams: [],
        audioStreams: [
          {
            id: 2,
            codec: 'wmav2',
            codecDetail: 'WMAv2',
            channelCount: 2,
            sampleRate: 44100,
            bitrate: 128000,
            durationInSeconds: 6,
            bitsPerSample: 16,
          },
        ],
        fileProperties: expect.any(Object) as any,
        additionalStreamInfo: expect.any(Map) as any,
      },
    },
    {
      filename: 'engine-start.wmv2.wmav2-mono.wmv',
      expectedMediaInfo: {
        bytesRead: 65536,
        parser: 'media-utils',
        container: 'asf',
        containerDetail: 'wma',
        durationInSeconds: 6,
        videoStreams: [],
        audioStreams: [
          {
            id: 2,
            codec: 'wmav2',
            codecDetail: 'WMAv2',
            channelCount: 1,
            sampleRate: 44100,
            bitrate: 128000,
            durationInSeconds: 6,
            bitsPerSample: 16,
          },
        ],
        fileProperties: expect.any(Object) as any,
        additionalStreamInfo: expect.any(Map) as any,
      },
    },
  ]);

  it('should report progress when extracting from ASF', async () => {
    const inputFile = sampleFile('engine-start.wmv2.wmav2.wmv');
    const outputFilePath = outputFile('progress-test-asf.wma');
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
