import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import crypto from 'node:crypto';
import fs from 'node:fs';

import { extractAudio, ExtractAudioOptions } from '../../src/extract-audio';
import { getMediaInfo } from '../../src/get-media-info';
import { createReadableStreamFromFile, MaxBytesExceededError, MediaInput } from '../../src/utils';
import { sampleFile } from '../test-utils';

const FIXTURES = [
  'engine-start.h264.aac.mp4',
  'engine-start.h264.mp3-mono.mp4',
  'engine-start.h264.aac.mov',
  'engine-start.h264.pcms16le.mov',
  'engine-start.h264.pcms32be.mov',
  'engine-start.h264.aac-mono.mkv',
  'engine-start.vp9.opus.webm',
  'engine-start.h264.pcms16le.avi',
  'engine-start.h264.adpcm_ms.avi',
  'engine-start.h264.aac.m2ts',
  'engine-start.mpeg2video.mp2.m2ts',
  'engine-start.wmv2.wmav2.wmv',
  'sample.h264.pcm24le.8ch.mxf',
  'large_matroska-test-files1.mkv',
  'large_BigBuckBunny.mp4',
];

/**
 * Creates a writable stream that collects what is written, and a function for getting the digest of it
 * @returns The writable stream, and a function returning the size and the SHA-256 of the content
 */
function collector() {
  const hash = crypto.createHash('sha256');
  let size = 0;
  const stream = new WritableStream<Uint8Array>({
    write(chunk) {
      hash.update(chunk);
      size += chunk.length;
    },
  });
  return { stream, digest: () => ({ size, sha256: hash.digest('hex') }) };
}

/**
 * Wraps a stream to count the bytes pulled from it
 * @param stream The stream
 * @returns The wrapped stream and the statistics
 */
function counted(stream: ReadableStream<Uint8Array>) {
  const stats = { pulledBytes: 0, teeCalled: false, cancelled: false };
  const reader = stream.getReader();
  const wrapped = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        stats.pulledBytes += value.length;
        controller.enqueue(value);
      },
      cancel(reason) {
        stats.cancelled = true;
        return reader.cancel(reason);
      },
    },
    { highWaterMark: 0 },
  );
  const originalTee = wrapped.tee.bind(wrapped);
  wrapped.tee = () => {
    stats.teeCalled = true;
    return originalTee();
  };
  return { stream: wrapped, stats };
}

async function extract(input: MediaInput, options?: ExtractAudioOptions) {
  const output = collector();
  await extractAudio(input, output.stream, { useParser: 'media-utils', ...options });
  return output.digest();
}

describe('extractAudio gives the same output with Blob input and with the mediaInfo option', () => {
  // The Ogg writer uses a random stream serial number, make it deterministic for comparing outputs
  beforeAll(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });

  for (const filename of FIXTURES) {
    it(`should extract the same audio from ${filename}`, async () => {
      const path = sampleFile(filename);
      const fromStream = await extract(await createReadableStreamFromFile(path));
      expect(fromStream.size).toBeGreaterThan(0);

      const fromBlob = await extract(await fs.openAsBlob(path));
      expect(fromBlob).toEqual(fromStream);

      const mediaInfo = await getMediaInfo(await fs.openAsBlob(path), { useParser: 'media-utils', sampleTableInfo: true });
      const fromBlobWithMediaInfo = await extract(await fs.openAsBlob(path), { mediaInfo });
      expect(fromBlobWithMediaInfo).toEqual(fromStream);

      const input = counted(await createReadableStreamFromFile(path));
      const fromStreamWithMediaInfo = await extract(input.stream, { mediaInfo });
      expect(fromStreamWithMediaInfo).toEqual(fromStream);
      // With mediaInfo, the stream is not teed
      expect(input.stats.teeCalled).toBe(false);
    }, 30000);
  }
});

describe('extractAudio with the mediaInfo option', () => {
  it('should reject media info without sample tables for MP4', async () => {
    const path = sampleFile('engine-start.h264.aac.mp4');
    const mediaInfo = await getMediaInfo(await fs.openAsBlob(path), { useParser: 'media-utils' });
    await expect(extract(await fs.openAsBlob(path), { mediaInfo })).rejects.toThrow(/sampleTableInfo: true/);
  });

  it('should reject media info from another parser', async () => {
    const path = sampleFile('engine-start.h264.aac.mp4');
    const mediaInfo = await getMediaInfo(await fs.openAsBlob(path), { useParser: 'mp4box' });
    await expect(extract(await fs.openAsBlob(path), { mediaInfo })).rejects.toThrow(/useParser 'media-utils'/);
  });

  it('should report progress', async () => {
    const path = sampleFile('engine-start.h264.aac.mp4');
    const mediaInfo = await getMediaInfo(await fs.openAsBlob(path), { useParser: 'media-utils', sampleTableInfo: true });
    const progress: number[] = [];
    await extract(await fs.openAsBlob(path), {
      mediaInfo,
      onProgress: (p) => {
        progress.push(p);
      },
    });
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(100);
  });
});

describe('extractAudio with a stream input and without the mediaInfo option', () => {
  it('should cancel the detection branch before extracting', async () => {
    const events: string[] = [];
    const input = await createReadableStreamFromFile(sampleFile('large_matroska-test-files1.mkv'));
    const originalTee = input.tee.bind(input);
    input.tee = () => {
      const [detectBranch, extractBranch] = originalTee();
      const detectReader = detectBranch.getReader();
      const observedDetectBranch = new ReadableStream<Uint8Array>(
        {
          async pull(controller) {
            const { done, value } = await detectReader.read();
            if (done) controller.close();
            else controller.enqueue(value);
          },
          cancel(reason) {
            events.push('detection branch cancelled');
            return detectReader.cancel(reason);
          },
        },
        { highWaterMark: 0 },
      );
      return [observedDetectBranch, extractBranch];
    };
    const output = new WritableStream<Uint8Array>({
      write() {
        if (events.at(-1) !== 'output written') events.push('output written');
      },
    });
    await extractAudio(input, output, { useParser: 'media-utils' });
    expect(events[0]).toBe('detection branch cancelled');
    expect(events).toContain('output written');
  });

  it('should reject invalid options, closing the output and cancelling the input', async () => {
    const { stream, stats } = counted(await createReadableStreamFromFile(sampleFile('engine-start.h264.aac.mp4')));
    let outputClosed = false;
    const output = new WritableStream<Uint8Array>({
      close() {
        outputClosed = true;
      },
    });
    await expect(extractAudio(stream, output, { maxBytesToReadForMediaInfo: -1 })).rejects.toBeInstanceOf(RangeError);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(outputClosed).toBe(true);
    expect(stats.cancelled).toBe(true);
  });
});

describe('extractAudio with maxBytesToReadForMediaInfo', () => {
  it('should work with a small limit for a moov-first MP4 stream', async () => {
    const path = sampleFile('engine-start.h264.aac.mp4');
    const unlimited = await extract(await createReadableStreamFromFile(path));
    const limited = await extract(await createReadableStreamFromFile(path), { maxBytesToReadForMediaInfo: 128 * 1024 });
    expect(limited).toEqual(unlimited);
  });

  it('should fail for a stream when detection needs more than the limit', async () => {
    const input = await createReadableStreamFromFile(sampleFile('large_BigBuckBunny.mp4'));
    const output = collector();
    const promise = extractAudio(input, output.stream, { maxBytesToReadForMediaInfo: 1024 * 1024 });
    await expect(promise).rejects.toBeInstanceOf(MaxBytesExceededError);
  });

  it('should work for a Blob of the same file, because media data is skipped during detection', async () => {
    const path = sampleFile('large_BigBuckBunny.mp4');
    const result = await extract(await fs.openAsBlob(path), { maxBytesToReadForMediaInfo: 1024 * 1024 });
    expect(result.size).toBeGreaterThan(1024 * 1024);
  });

  it('should not limit the extraction itself', async () => {
    const path = sampleFile('large_matroska-test-files1.mkv');
    const unlimited = await extract(await createReadableStreamFromFile(path));
    const limited = await extract(await createReadableStreamFromFile(path), { maxBytesToReadForMediaInfo: 1024 * 1024 });
    expect(limited).toEqual(unlimited);
  });
});
