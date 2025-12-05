import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';

import { extractAudioFromFileToFile } from '../../src/extract-audio';
import { getMediaInfoFromFile } from '../../src/get-media-info';
import { outputFile, sampleFile, setupCleanup, trackFileForCleanup } from '../test-utils';

setupCleanup();

describe('Extract audio from MKV', () => {
  it('should extract MP3 from large_matroska-test-files1.mkv (MSMPEG4v2/MP3)', async () => {
    const inputFile = sampleFile('large_matroska-test-files1.mkv');
    const outputFilePath = outputFile('extracted-mp3-from-mkv.mp3');

    // Extract audio to file
    await extractAudioFromFileToFile(inputFile, outputFilePath);

    // Verify the file was created and has content
    expect(fs.existsSync(outputFilePath)).toBe(true);
    const stats = fs.statSync(outputFilePath);
    expect(stats.size).toBeGreaterThan(0);

    // Verify the extracted audio can be parsed
    const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath, { useParser: 'media-utils' });

    expect(extractedAudioInfo).toEqual({
      audioStreams: [
        {
          id: 0,
          bitrate: 160000,
          channelCount: 2,
          codec: 'mp3',
          codecDetail: 'MPEG-1 Layer III',
          durationInSeconds: undefined,
          sampleRate: 48000,
          codecDetails: {
            layer: 3,
            padding: 0,
          },
        },
      ],
      container: 'mp3',
      containerDetail: 'mp3',
      durationInSeconds: undefined,
      parser: 'media-utils',
      videoStreams: [],
    });

    trackFileForCleanup(outputFilePath);
  }, 60000);

  it('should extract AAC from large_matroska-test-files2.mkv (H264/AAC)', async () => {
    const inputFile = sampleFile('large_matroska-test-files2.mkv');
    const outputFilePath = outputFile('extracted-aac-from-mkv.aac');

    // Extract audio to file
    await extractAudioFromFileToFile(inputFile, outputFilePath);

    // Verify the file was created and has content
    expect(fs.existsSync(outputFilePath)).toBe(true);
    const stats = fs.statSync(outputFilePath);
    expect(stats.size).toBeGreaterThan(0);

    // Verify the extracted audio can be parsed
    const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath);

    expect(extractedAudioInfo).toEqual({
      audioStreams: [
        {
          id: 0,
          channelCount: 2,
          codec: 'aac',
          codecDetail: 'mp4a.40.2',
          durationInSeconds: undefined,
          sampleRate: 48000,
          profile: 'LC',
        },
      ],
      container: 'aac',
      containerDetail: 'aac',
      durationInSeconds: undefined,
      parser: 'media-utils',
      videoStreams: [],
    });

    trackFileForCleanup(outputFilePath);
  }, 60000);
});
