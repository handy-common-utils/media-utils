import { describe, expect, it, jest } from '@jest/globals';
import fs from 'node:fs';
import { TransformStream } from 'node:stream/web';

import { extractAudio, extractAudioFromFileToFile } from '../../src/extract-audio';
import { getMediaInfoFromFile } from '../../src/get-media-info';
import { createReadableStreamFromFile } from '../../src/utils';
import { outputFile, sampleFile, setupCleanup, trackFileForCleanup } from '../test-utils';

setupCleanup();

describe('Extract audio from MP4', () => {
  it('should extract AAC audio from MP4 file with AAC codec', async () => {
    const inputFile = sampleFile('engine-start.h264.aac.mp4');
    const outputFilePath = outputFile('extracted-aac-from-mp4.aac');

    // Extract audio to file (first audio track, index 0)
    await extractAudioFromFileToFile(inputFile, outputFilePath);

    // Verify the file was created and has content
    expect(fs.existsSync(outputFilePath)).toBe(true);
    const stats = fs.statSync(outputFilePath);
    expect(stats.size).toBeGreaterThan(0);

    // Verify the extracted audio can be parsed by remotion
    const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath);

    // Verify it's recognized as AAC
    expect(extractedAudioInfo).toEqual({
      container: 'aac',
      containerDetail: 'aac',
      parser: 'media-utils',
      durationInSeconds: undefined,
      videoStreams: [],
      audioStreams: [
        {
          id: 1,
          codec: 'aac',
          codecDetail: 'mp4a.40.2',
          profile: 'LC',
          channelCount: 2,
          sampleRate: 44100,
          durationInSeconds: undefined,
        },
      ],
    });

    trackFileForCleanup(outputFilePath);
  });

  it('should extract MP3 audio from MP4 file with MP3 codec', async () => {
    const inputFile = sampleFile('engine-start.h264.mp3.mp4');
    const outputFilePath = outputFile('extracted-mp3-from-mp4.mp3');

    // Extract audio to file (first audio track, index 0)
    await extractAudioFromFileToFile(inputFile, outputFilePath);

    // Verify the file was created and has content
    expect(fs.existsSync(outputFilePath)).toBe(true);
    const stats = fs.statSync(outputFilePath);
    expect(stats.size).toBeGreaterThan(0);

    // Verify the extracted audio can be parsed by remotion
    const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath);

    // Verify it's recognized as MP3
    expect(extractedAudioInfo).toEqual({
      container: 'mp3',
      containerDetail: 'mp3',
      parser: 'media-utils',
      durationInSeconds: undefined,
      videoStreams: [],
      audioStreams: [
        {
          id: 1,
          codec: 'mp3',
          codecDetail: 'mp3',
          channelCount: 2,
          sampleRate: 44100,
          bitrate: 128000,
          durationInSeconds: undefined,
        },
      ],
    });

    trackFileForCleanup(outputFilePath);
  });

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
