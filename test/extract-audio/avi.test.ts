import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';

import { extractAudioFromFileToFile, getMediaInfoFromFile } from '../../src';
import { outputFile, sampleFile, setupCleanup } from '../test-utils';

setupCleanup();

describe('Extract audio from AVI', () => {
  it('should extract PCM from engine-start.mjpeg.pcms16le.avi (MJPEG/PCM)', async () => {
    const inputFile = sampleFile('engine-start.mjpeg.pcms16le.avi');
    const outputFilePath = outputFile('extracted-pcm-from-avi-mjpeg.wav');

    await extractAudioFromFileToFile(inputFile, outputFilePath);

    // Verify the output file exists and has content
    const stats = fs.statSync(outputFilePath);
    expect(stats.size).toBeGreaterThan(0);

    // Verify the extracted audio can be parsed
    const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath, { useParser: 'media-utils' });

    expect(extractedAudioInfo).toEqual({
      audioStreams: [
        {
          bitrate: 1411200,
          bitsPerSample: 16,
          channelCount: 2,
          codec: 'pcm_s16le',
          codecDetail: 'pcm_s16le',
          durationInSeconds: expect.closeTo(6, 1),
          id: 1,
          sampleRate: 44100,
          codecDetails: {
            formatTag: 1,
            blockAlign: 4,
            samplesPerBlock: undefined,
          },
        },
      ],
      container: 'wav',
      containerDetail: 'wav',
      durationInSeconds: expect.closeTo(6, 1),
      parser: 'media-utils',
      videoStreams: [],
    });
  });

  it('should extract PCM from engine-start.h264.pcms16le.avi (H.264/PCM)', async () => {
    const inputFile = sampleFile('engine-start.h264.pcms16le.avi');
    const outputFilePath = outputFile('extracted-pcm-from-avi-h264.wav');

    await extractAudioFromFileToFile(inputFile, outputFilePath);

    // Verify the output file exists and has content
    const stats = fs.statSync(outputFilePath);
    expect(stats.size).toBeGreaterThan(0);

    // Verify the extracted audio can be parsed
    const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath, { useParser: 'media-utils' });

    expect(extractedAudioInfo).toEqual({
      audioStreams: [
        {
          bitrate: 1411200,
          bitsPerSample: 16,
          channelCount: 2,
          codec: 'pcm_s16le',
          codecDetail: 'pcm_s16le',
          durationInSeconds: expect.closeTo(6, 1),
          id: 1,
          sampleRate: 44100,
          codecDetails: {
            formatTag: 1,
            blockAlign: 4,
            samplesPerBlock: undefined,
          },
        },
      ],
      container: 'wav',
      containerDetail: 'wav',
      durationInSeconds: expect.closeTo(6, 1),
      parser: 'media-utils',
      videoStreams: [],
    });
  });
  it('should extract PCM u8 from engine-start.h264.pcmu_8.avi', async () => {
    const inputFile = sampleFile('engine-start.h264.pcm_u8.avi');
    const outputFilePath = outputFile('extracted-pcm_u8-from-avi.wav');

    await extractAudioFromFileToFile(inputFile, outputFilePath);

    // Verify the output file exists and has content
    const stats = fs.statSync(outputFilePath);
    expect(stats.size).toBeGreaterThan(0);

    // Verify the extracted audio can be parsed
    const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath, { useParser: 'media-utils' });

    expect(extractedAudioInfo).toEqual({
      audioStreams: [
        {
          bitrate: 705600,
          bitsPerSample: 8,
          channelCount: 2,
          codec: 'pcm_u8',
          codecDetail: 'pcm_u8',
          durationInSeconds: expect.closeTo(6, 1),
          id: 1,
          sampleRate: 44100,
          codecDetails: {
            formatTag: 1,
            blockAlign: 2,
            samplesPerBlock: undefined,
          },
        },
      ],
      container: 'wav',
      containerDetail: 'wav',
      durationInSeconds: expect.closeTo(6, 1),
      parser: 'media-utils',
      videoStreams: [],
    });
  });

  it('should extract ADPCM from engine-start.h264.adpcm_ms.avi', async () => {
    const inputFile = sampleFile('engine-start.h264.adpcm_ms.avi');
    const outputFilePath = outputFile('extracted-adpcm-from-avi.wav');

    await extractAudioFromFileToFile(inputFile, outputFilePath);

    // Verify the output file exists and has content
    const stats = fs.statSync(outputFilePath);
    expect(stats.size).toBeGreaterThan(0);

    // Verify the extracted audio can be parsed
    const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath, { useParser: 'media-utils' });

    expect(extractedAudioInfo).toEqual({
      audioStreams: [
        {
          bitrate: expect.any(Number), // ADPCM bitrate might vary slightly or be calculated differently
          bitsPerSample: 4,
          channelCount: 2,
          codec: 'adpcm_ms',
          codecDetail: 'adpcm_ms',
          durationInSeconds: expect.closeTo(6, 1),
          id: 1,
          sampleRate: 44100,
          codecDetails: {
            formatTag: 2,
            blockAlign: 1024,
            samplesPerBlock: 1012,
          },
        },
      ],
      container: 'wav',
      containerDetail: 'wav',
      durationInSeconds: expect.closeTo(6, 1),
      parser: 'media-utils',
      videoStreams: [],
    });
  });
});
