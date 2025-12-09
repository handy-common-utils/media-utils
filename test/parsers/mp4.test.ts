import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';

import { getMediaInfoFromFile } from '../../src/get-media-info';
import { parseMp4 } from '../../src/parsers/mp4';
import { sampleFile } from '../test-utils';

describe('MP4 Parser', () => {
  it('should parse engine-start.h264.aac.mp4 file directly', async () => {
    const stream = fs.createReadStream(sampleFile('engine-start.h264.aac.mp4'));
    const readableStream = new ReadableStream<Uint8Array>({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });

    const info = await parseMp4(readableStream);
    expect(info).toEqual({
      container: 'mp4',
      containerDetail: 'isom, isom, iso2, avc1, mp41',
      durationInSeconds: expect.closeTo(6, 0),
      videoStreams: [
        {
          codec: 'h264',
          codecDetail: 'avc1.64001f',
          durationInSeconds: expect.closeTo(6, 0),
          id: 1,
          width: 1280,
          height: 534,
          fps: 24,
          bitrate: 349083,
        },
      ],
      audioStreams: [
        {
          codec: 'aac',
          codecDetail: 'mp4a.40.02',
          durationInSeconds: expect.closeTo(6, 0),
          id: 2,
          sampleRate: 44100,
          bitrate: expect.closeTo(127930, -3) as any,
          channelCount: 2,
          profile: 'LC',
        },
      ],
    });
    expect(info.videoStreams[0].durationInSeconds).toBeCloseTo(6, 0);
  });

  it('should parse engine-start.h264.mp3.mp4 file using adapter strategy', async () => {
    const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.mp3.mp4'), { useParser: 'media-utils' });
    expect(info).toEqual({
      parser: 'media-utils',
      container: 'mp4',
      containerDetail: 'isom, isom, iso2, avc1, mp41',
      durationInSeconds: expect.closeTo(6, 0),
      videoStreams: [
        {
          codec: 'h264',
          codecDetail: 'avc1.64001f',
          durationInSeconds: expect.closeTo(6, 0),
          id: 1,
          width: 1280,
          height: 534,
          fps: 24,
          bitrate: 349083,
        },
      ],
      audioStreams: [
        {
          codec: 'mp3',
          codecDetail: 'mp4a.6b',
          durationInSeconds: expect.closeTo(6, 0),
          id: 2,
          sampleRate: 44100,
          bitrate: expect.closeTo(128452, -3) as any,
          channelCount: 2,
        },
      ],
    });
  });

  it('should parse engine-start.h264.aac.mov file (QuickTime)', async () => {
    const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.aac.mov'), { useParser: 'media-utils' });
    expect(info).toEqual({
      parser: 'media-utils',
      container: 'mov',
      containerDetail: 'qt  , qt  ',
      durationInSeconds: expect.closeTo(6, 0),
      videoStreams: [
        {
          codec: 'h264',
          width: 1280,
          height: 534,
          id: 1,
          codecDetail: 'avc1.4d401f',
          durationInSeconds: expect.closeTo(6, 0),
          fps: expect.closeTo(22.1, 1),
          bitrate: 939149,
        },
      ],
      audioStreams: [
        {
          codec: 'aac',
          id: 2,
          codecDetail: 'mp4a',
          channelCount: 2,
          sampleRate: 44100,
          bitrate: expect.closeTo(131692, -3) as any,
          durationInSeconds: expect.closeTo(6, 0),
        },
      ],
    });
  });

  it('should extract audio samples from engine-start.h264.aac.mp4', async () => {
    const samples: Uint8Array[] = [];
    const stream = fs.createReadStream(sampleFile('engine-start.h264.aac.mp4'));
    const readableStream = new ReadableStream<Uint8Array>({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });

    await parseMp4(readableStream, {
      onSamples: (_trackId, trackSamples) => {
        samples.push(...trackSamples);
      },
    });

    expect(samples.length).toBeGreaterThan(200);
  });
});
