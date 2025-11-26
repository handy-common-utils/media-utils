import { afterAll, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { TransformStream } from 'node:stream/web';

import { extractAudio, extractAudioFromFileToFile } from '../src/extract-audio';
import { getMediaInfoFromFile } from '../src/get-media-info';
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
      // fs.unlinkSync(file);
    }
  }
});

describe('extractAudio', () => {
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

      filesToCleanup.push(outputFilePath);
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

      filesToCleanup.push(outputFilePath);
    });
  });

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
            bitrate: 192000,
            durationInSeconds: undefined,
          },
        ],
      });

      filesToCleanup.push(outputFilePath);
    });
  });

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

      filesToCleanup.push(outputFilePath);
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

      filesToCleanup.push(outputFilePath);
    });
  });

  describe('Extract audio from ASF/WMV', () => {
    it('should extract WMAv2 audio from WMV file', async () => {
      const inputFile = sampleFile('engine-start.wmv2.wmav2.wmv');
      const outputFilePath = outputFile('extracted-wmav2-from-wmv.wma');

      await extractAudioFromFileToFile(inputFile, outputFilePath);

      expect(fs.existsSync(outputFilePath)).toBe(true);

      // Verify the extracted audio can be parsed
      const extractedAudioInfo = await getMediaInfoFromFile(outputFilePath);

      // Verify it's recognized as WMA in ASF container
      expect(extractedAudioInfo).toEqual({
        container: 'asf',
        containerDetail: 'wma',
        parser: 'media-utils',
        durationInSeconds: undefined,
        videoStreams: [],
        audioStreams: [
          {
            id: 1,
            codec: 'wmav2',
            codecDetail: 'wmav2',
            channelCount: 2,
            sampleRate: 44100,
            durationInSeconds: undefined,
          },
        ],
      });

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
