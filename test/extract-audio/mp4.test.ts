import { describe, expect, it, jest } from '@jest/globals';
import { TransformStream } from 'node:stream/web';

import { extractAudio, extractAudioFromFileToFile } from '../../src/extract-audio';
import { createReadableStreamFromFile } from '../../src/utils';
import { outputFile, runExtractAudioTestCases, sampleFile, setupCleanup, trackFileForCleanup } from '../test-utils';

setupCleanup();

describe('Extract audio from MP4', () => {
  runExtractAudioTestCases([
    {
      filename: 'engine-start.h264.aac.mp4',
      expectedMediaInfo: {
        container: 'aac',
        containerDetail: 'aac',
        parser: 'media-utils',
        durationInSeconds: undefined,
        videoStreams: [],
        audioStreams: [
          {
            id: 0,
            codec: 'aac',
            codecDetail: 'mp4a.40.2',
            profile: 'LC',
            channelCount: 2,
            sampleRate: 44100,
          },
        ],
      },
    },
    {
      filename: 'engine-start.h264.mp3.mp4',
      expectedMediaInfo: {
        container: 'mp3',
        containerDetail: 'mp3',
        parser: 'media-utils',
        durationInSeconds: undefined,
        videoStreams: [],
        audioStreams: [
          {
            id: 0,
            codec: 'mp3',
            codecDetail: 'MPEG-1 Layer III',
            channelCount: 2,
            sampleRate: 44100,
            bitrate: 128000,
            durationInSeconds: undefined,
            codecDetails: {
              layer: 3,
              padding: 0,
            },
          },
        ],
      },
    },
  ]);

  it('should report progress when extracting from MP4', async () => {
    const inputFile = sampleFile('engine-start.h264.aac.mp4');
    const outputFilePath = outputFile('progress-test-mp4.aac');
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

  it('should throw error when audio track index is out of bounds', async () => {
    const inputFile = sampleFile('engine-start.h264.aac.mp4');
    const inputStream = await createReadableStreamFromFile(inputFile);

    // Try to extract a non-existent audio track (index 5)
    const { writable } = new TransformStream();
    await expect(extractAudio(inputStream, writable, { streamIndex: 5 })).rejects.toThrow(/Audio stream\/track index 5 not found/);
  });
});
