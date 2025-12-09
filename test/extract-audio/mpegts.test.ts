import { describe, expect, it } from '@jest/globals';

import { extractAudioFromFileToFile } from '../../src/extract-audio';
import { getMediaInfoFromFile } from '../../src/get-media-info';
import { assertFileSize, outputFile, sampleFile } from '../test-utils';

describe('Extract Audio from MPEG-TS', () => {
  it('should extract MP2 audio from MPEG-TS file', async () => {
    const inputFile = sampleFile('engine-start.mpeg2video.mp2.m2ts');
    const outputPath = outputFile('extracted-mp2-from-mpegts.mp2');

    await extractAudioFromFileToFile(inputFile, outputPath, { useParser: 'media-utils' });
    assertFileSize(outputPath);

    // Verify the extracted file
    const info = await getMediaInfoFromFile(outputPath, { useParser: 'media-utils' });
    expect(info).toEqual({
      container: 'mp3',
      containerDetail: 'mp3',
      durationInSeconds: undefined,
      parser: 'media-utils',
      videoStreams: [],
      audioStreams: [
        {
          codec: 'mp2',
          codecDetail: 'MPEG-1 Layer II',
          sampleRate: 44100,
          bitrate: 384000,
          channelCount: 2,
          durationInSeconds: undefined,
          id: 0,
          codecDetails: {
            layer: 2,
            padding: 0,
          },
        },
      ],
    });
  }, 20000);

  it('should extract AAC audio from MPEG-TS file', async () => {
    const inputFile = sampleFile('engine-start.h264.aac.m2ts');
    const outputPath = outputFile('extracted-aac-from-mpegts.aac');

    await extractAudioFromFileToFile(inputFile, outputPath, { useParser: 'media-utils' });
    assertFileSize(outputPath);

    // Verify the extracted file
    const info = await getMediaInfoFromFile(outputPath, { useParser: 'media-utils' });
    expect(info).toEqual({
      container: 'aac',
      containerDetail: 'aac',
      durationInSeconds: undefined,
      parser: 'media-utils',
      videoStreams: [],
      audioStreams: [
        {
          codec: 'aac',
          codecDetail: 'mp4a.40.2',
          profile: 'LC',
          sampleRate: 44100,
          channelCount: 2,
          id: 0,
        },
      ],
    });
  });

  it('should extract MP3 audio from MPEG-TS file', async () => {
    const inputFile = sampleFile('engine-start.h264.mp3.m2ts');
    const outputPath = outputFile('extracted-mp3-from-mpegts.mp3');

    await extractAudioFromFileToFile(inputFile, outputPath, { useParser: 'media-utils' });
    assertFileSize(outputPath);

    // Verify the extracted file exists and has content
    const info = await getMediaInfoFromFile(outputPath, { useParser: 'media-utils' });
    expect(info).toEqual({
      container: 'mp3',
      containerDetail: 'mp3',
      durationInSeconds: undefined,
      parser: 'media-utils',
      videoStreams: [],
      audioStreams: [
        {
          codec: 'mp3',
          codecDetail: 'MPEG-1 Layer III',
          sampleRate: 44100,
          bitrate: 128000,
          channelCount: 2,
          durationInSeconds: undefined,
          id: 0,
          codecDetails: {
            layer: 3,
            padding: 0,
          },
        },
      ],
    });
  });
});
