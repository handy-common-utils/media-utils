import { afterAll, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { TransformStream } from 'node:stream/web';

import { extractAudio, extractAudioFromFileToFile } from '../src/extract-audio';
import { getMediaInfoFromFile } from '../src/get-media-info';
import { MediaInfo } from '../src/media-info';
import { createReadableStreamFromFile } from '../src/utils';

// eslint-disable-next-line unicorn/prefer-module
const SAMPLE_DIR = path.join(__dirname, 'sample-media-files');
// eslint-disable-next-line unicorn/prefer-module
const OUTPUT_DIR = path.join(__dirname, 'output');

function sampleFile(filename: string) {
  return path.join(SAMPLE_DIR, filename);
}

function outputFile(filename: string) {
  return path.join(OUTPUT_DIR, filename);
}

// Track files to clean up after tests
const filesToCleanup: string[] = [];

afterAll(() => {
  // Clean up generated test files
  for (const file of filesToCleanup) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
});

describe('extractAudio', () => {
  describe('AAC extraction', () => {
    it.only('should extract AAC audio from MP4 file with AAC codec', async () => {
      const inputFile = sampleFile('engine-start.h264.aac.mp4');
      const outputFilePath = outputFile('extracted-aac-from-mp4.aac');

      // Extract audio to file (first audio track, index 0)
      await extractAudioFromFileToFile(inputFile, outputFilePath, { streamIndex: 0 });

      // Verify the file was created and has content
      expect(fs.existsSync(outputFilePath)).toBe(true);
      const stats = fs.statSync(outputFilePath);
      expect(stats.size).toBeGreaterThan(0);

      // Verify the extracted audio can be parsed by remotion
      const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath, {
        useParser: 'remotion',
      });

      // Verify it's recognized as AAC
      expect(extractedAudioInfo).toEqual({
        container: 'aac',
        containerDetail: 'aac',
        mimeType: undefined,
        parser: 'remotion',
        durationInSeconds: 6,
        videoStreams: [],
        audioStreams: [
          {
            id: 0,
            codec: 'aac',
            codecDetail: 'mp4a.40.2',
            channelCount: 2,
            sampleRate: 44100,
            durationInSeconds: 6,
          },
        ],
      } as MediaInfo);

      filesToCleanup.push(outputFilePath);
    });

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
      const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath, {
        useParser: 'remotion',
      });

      // Verify it's recognized as AAC
      expect(extractedAudioInfo).toEqual({
        container: 'aac',
        containerDetail: 'aac',
        mimeType: undefined,
        parser: 'remotion',
        durationInSeconds: 6,
        videoStreams: [],
        audioStreams: [
          {
            id: 0,
            codec: 'aac',
            codecDetail: 'mp4a.40.2',
            channelCount: 2,
            sampleRate: 44100,
            durationInSeconds: 6,
          },
        ],
      } as MediaInfo);

      filesToCleanup.push(outputFilePath);
    });
  });

  describe('MP3 extraction', () => {
    it('should extract MP3 audio from MP4 file with MP3 codec', async () => {
      const inputFile = sampleFile('engine-start.h264.mp3.mp4');
      const outputFilePath = outputFile('extracted-mp3-from-mp4.mp3');

      // Extract audio to file (first audio track, index 0)
      await extractAudioFromFileToFile(inputFile, outputFilePath, { streamIndex: 0 });

      // Verify the file was created and has content
      expect(fs.existsSync(outputFilePath)).toBe(true);
      const stats = fs.statSync(outputFilePath);
      expect(stats.size).toBeGreaterThan(0);

      // Verify the extracted audio can be parsed by remotion
      const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath, {
        useParser: 'remotion',
      });

      // Verify it's recognized as AAC
      expect(extractedAudioInfo).toEqual({
        container: 'mp3',
        containerDetail: 'mp3',
        mimeType: undefined,
        parser: 'remotion',
        durationInSeconds: 6,
        videoStreams: [],
        audioStreams: [
          {
            id: 0,
            codec: 'mp3',
            codecDetail: 'mp4a.40.2',
            channelCount: 2,
            sampleRate: 44100,
            durationInSeconds: 6,
          },
        ],
      } as MediaInfo);

      filesToCleanup.push(outputFilePath);
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
      const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath, {
        useParser: 'remotion',
      });

      // Verify it's recognized as AAC
      expect(extractedAudioInfo).toEqual({
        container: 'mp3',
        containerDetail: 'mp3',
        mimeType: undefined,
        parser: 'remotion',
        durationInSeconds: 6,
        videoStreams: [],
        audioStreams: [
          {
            id: 0,
            codec: 'mp3',
            codecDetail: 'mp4a.40.2',
            channelCount: 2,
            sampleRate: 44100,
            durationInSeconds: 6,
          },
        ],
      } as MediaInfo);

      filesToCleanup.push(outputFilePath);
    });
  });

  describe('error handling', () => {
    it('should throw error when audio track index is out of bounds', async () => {
      const inputFile = sampleFile('engine-start.h264.aac.mp4');
      const inputStream = await createReadableStreamFromFile(inputFile);

      // Try to extract a non-existent audio track (index 5)
      const { writable } = new TransformStream();
      await expect(extractAudio(inputStream, writable, { streamIndex: 5 })).rejects.toThrow(/Audio stream\/track index 5 not found/);
    });
  });
});
