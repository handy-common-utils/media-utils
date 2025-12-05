import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';

import { extractAudioFromFileToFile } from '../../src/extract-audio';
import { getMediaInfoFromFile } from '../../src/get-media-info';
import { outputFile, sampleFile, setupCleanup, trackFileForCleanup } from '../test-utils';

setupCleanup();

describe('Extract audio from MOV', () => {
  it('should extract AAC audio from MOV file with AAC codec', async () => {
    const inputFile = sampleFile('engine-start.h264.aac.mov');
    const outputFilePath = outputFile('extracted-aac-from-mov.aac');

    // Extract audio to file
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
          id: 0,
          codec: 'aac',
          codecDetail: 'mp4a.40.2',
          profile: 'LC',
          channelCount: 2,
          sampleRate: 44100,
        },
      ],
    });

    trackFileForCleanup(outputFilePath);
  });

  it('should extract MP3 audio from MOV file with MP3 codec', async () => {
    const inputFile = sampleFile('engine-start.h264.mp3.mov');
    const outputFilePath = outputFile('extracted-mp3-from-mov.mp3');

    // Extract audio to file
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
          id: 0,
          codec: 'mp3',
          codecDetail: 'MPEG-1 Layer III',
          channelCount: 2,
          sampleRate: 44100,
          bitrate: 192000,
          durationInSeconds: undefined,
          codecDetails: {
            layer: 3,
            padding: 1,
          },
        },
      ],
    });

    trackFileForCleanup(outputFilePath);
  });
});
