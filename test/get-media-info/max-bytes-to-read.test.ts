import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';

import { getMediaInfo, getMediaInfoFromFile } from '../../src/get-media-info';
import { createLimitedStream } from '../../src/input-streams';
import { createReadableStreamFromFile, MaxBytesExceededError } from '../../src/utils';
import { sampleFile } from '../test-utils';
import { largeWebmTestCases } from './large-webm.config';
import { mediaUtilsTestCases } from './media-utils.config';


/**
 * Creates a stream of the given chunk sizes, which records how many bytes have been pulled from it
 * @param chunkSizes Sizes of the chunks
 * @returns The stream and the statistics
 */
function countingStream(chunkSizes: number[]) {
  const stats = { pulledBytes: 0, cancelled: false };
  let i = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (i >= chunkSizes.length) {
          controller.close();
          return;
        }
        const chunk = new Uint8Array(chunkSizes[i++]);
        stats.pulledBytes += chunk.length;
        controller.enqueue(chunk);
      },
      cancel() {
        stats.cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, stats };
}

/**
 * Wraps a stream to count the bytes pulled from it
 * @param stream The stream
 * @returns The wrapped stream and the statistics
 */
function countingWrapper(stream: ReadableStream<Uint8Array>) {
  const stats = { pulledBytes: 0 };
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
        return reader.cancel(reason);
      },
    },
    { highWaterMark: 0 },
  );
  return { stream: wrapped, stats };
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<number> {
  const reader = stream.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return total;
    total += value.length;
  }
}

describe('createLimitedStream', () => {
  it('should pass everything through without a limit', async () => {
    const { stream } = countingStream([3, 3, 3]);
    const counter = { bytesRead: 0 };
    expect(await readAll(createLimitedStream(stream, counter).stream)).toBe(9);
    expect(counter.bytesRead).toBe(9);
  });

  it('should not fail when the limit equals the total size', async () => {
    const { stream } = countingStream([3, 3, 3]);
    expect(await readAll(createLimitedStream(stream, { bytesRead: 0, maxBytesToRead: 9 }).stream)).toBe(9);
  });

  it('should deliver bytes up to the limit and then fail', async () => {
    const { stream, stats } = countingStream([3, 3, 3]);
    const counter = { bytesRead: 0, maxBytesToRead: 8 };
    const reader = createLimitedStream(stream, counter).stream.getReader();
    const sizes: number[] = [];
    let error: unknown;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        sizes.push(value.length);
      }
    } catch (error_) {
      error = error_;
    }
    expect(sizes).toEqual([3, 3, 2]);
    expect(error).toBeInstanceOf(MaxBytesExceededError);
    expect(error).toHaveProperty('isMaxBytesExceededError', true);
    expect(error).toHaveProperty('maxBytesToRead', 8);
    expect(counter.bytesRead).toBe(8);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stats.cancelled).toBe(true);
  });

  it('should fail at a chunk boundary only if there is more data', async () => {
    const { stream } = countingStream([3, 3, 3]);
    await expect(readAll(createLimitedStream(stream, { bytesRead: 0, maxBytesToRead: 6 }).stream)).rejects.toBeInstanceOf(MaxBytesExceededError);
  });

  it('should not read ahead', async () => {
    const { stream, stats } = countingStream([3, 3, 3]);
    const reader = createLimitedStream(stream, { bytesRead: 0 }).stream.getReader();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(stats.pulledBytes).toBe(0);
    await reader.read();
    expect(stats.pulledBytes).toBe(3);
    reader.releaseLock();
  });

  it('should share the limit among streams using the same counter', async () => {
    const counter = { bytesRead: 0, maxBytesToRead: 10 };
    expect(await readAll(createLimitedStream(countingStream([3, 3]).stream, counter).stream)).toBe(6);
    await expect(readAll(createLimitedStream(countingStream([3, 3]).stream, counter).stream)).rejects.toBeInstanceOf(MaxBytesExceededError);
    expect(counter.bytesRead).toBe(10);
  });

  it('should propagate errors from the source', async () => {
    const source = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('source failure'));
      },
    });
    await expect(readAll(createLimitedStream(source, { bytesRead: 0, maxBytesToRead: 10 }).stream)).rejects.toThrow('source failure');
  });

  it('should pass cancellation by the consumer to the source', async () => {
    const { stream, stats } = countingStream([3, 3, 3]);
    await createLimitedStream(stream, { bytesRead: 0 }).stream.cancel();
    expect(stats.cancelled).toBe(true);
  });

  it('should end a pending read when cancelSource() is called', async () => {
    let pullCalled = false;
    const source = new ReadableStream<Uint8Array>(
      {
        pull() {
          pullCalled = true;
          return new Promise(() => {}); // never resolves
        },
      },
      { highWaterMark: 0 },
    );
    const limited = createLimitedStream(source, { bytesRead: 0 });
    const reader = limited.stream.getReader();
    const pending = reader.read();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(pullCalled).toBe(true);
    limited.cancelSource();
    const { done } = await pending;
    expect(done).toBe(true);
  });

  it('should reject a non-integer limit', async () => {
    const { stream } = countingStream([1]);
    await expect(getMediaInfo(stream, { maxBytesToRead: 1.5 })).rejects.toBeInstanceOf(RangeError);
  });

  it('should close and cancel the source when cancelSource() is called', async () => {
    const { stream, stats } = countingStream([3, 3, 3]);
    const limited = createLimitedStream(stream, { bytesRead: 0 });
    const reader = limited.stream.getReader();
    await reader.read();
    limited.cancelSource();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stats.cancelled).toBe(true);
    const { done } = await reader.read();
    expect(done).toBe(true);
  });
});

describe('getMediaInfo with maxBytesToRead', () => {
  it.each([0, -1, NaN])('should reject invalid value %p', async (maxBytesToRead) => {
    const { stream } = countingStream([1]);
    await expect(getMediaInfo(stream, { useParser: 'media-utils', maxBytesToRead })).rejects.toBeInstanceOf(RangeError);
  });

  it('should treat Infinity as no limit', async () => {
    const info = await getMediaInfoFromFile(sampleFile('engine-start.h264.aac.mp4'), { useParser: 'media-utils', maxBytesToRead: Infinity });
    expect(info.container).toBe('mp4');
  });

  it('should fail with MaxBytesExceededError for an MP4 stream with moov after mdat', async () => {
    const stream = await createReadableStreamFromFile(sampleFile('large_BigBuckBunny.mp4'));
    const promise = getMediaInfo(stream, { useParser: 'media-utils', maxBytesToRead: 1024 * 1024 });
    await expect(promise).rejects.toBeInstanceOf(MaxBytesExceededError);
    await expect(promise).rejects.toHaveProperty('isMaxBytesExceededError', true);
    await expect(promise).rejects.not.toHaveProperty('isUnsupportedFormatError', true);
  });

  it.each([...largeWebmTestCases, ...mediaUtilsTestCases.filter((tc) => !tc.shouldFail)].map((tc) => [tc.filename, tc] as const))(
    'should give the same result when the limit is not reached: %s',
    async (filename, testCase) => {
      // The limit is never below the file size, so it is never exceeded, even by the parsers that read the whole file.
      // (The case of exceeding it is tested separately.)
      const fileSize = fs.statSync(sampleFile(filename)).size;
      const info = await getMediaInfoFromFile(sampleFile(filename), {
        useParser: 'media-utils',
        maxBytesToRead: Math.max(fileSize, 4 * 1024 * 1024),
      });
      expect(info).toEqual({
        ...testCase.expectedMediaInfo,
        bytesRead: expect.any(Number),
      });
      const expectedBytesRead = testCase.expectedMediaInfo.bytesRead;
      // Since the fixture could be based on stream input, but getMediaInfoFromFile now uses Blob input, the bytesRead may be less than the expected value, but not more.
      expect(info.bytesRead).toBeLessThanOrEqual(expectedBytesRead == null ? Infinity : typeof expectedBytesRead === 'number' ? expectedBytesRead : (expectedBytesRead as any).sample);
    },
  );

  it('should fail for an MXF stream that would need to be read beyond the limit', async () => {
    const stream = await createReadableStreamFromFile(sampleFile('sample.h264.pcm24le.8ch.mxf'));
    await expect(getMediaInfo(stream, { useParser: 'media-utils', maxBytesToRead: 4 * 1024 * 1024 })).rejects.toBeInstanceOf(MaxBytesExceededError);
  });

  it.each(['large_BigBuckBunny.mp4', 'sample.h264.pcm24le.8ch.mxf'])(
    'should never pull much more than the limit from the input stream of %s',
    async (filename) => {
      const input = countingWrapper(await createReadableStreamFromFile(sampleFile(filename)));
      const maxBytesToRead = 1024 * 1024;
      await expect(getMediaInfo(input.stream, { useParser: 'media-utils', maxBytesToRead })).rejects.toBeInstanceOf(MaxBytesExceededError);
      // at most one extra chunk may be pulled
      expect(input.stats.pulledBytes).toBeGreaterThanOrEqual(maxBytesToRead);
      expect(input.stats.pulledBytes).toBeLessThanOrEqual(maxBytesToRead + 64 * 1024);
    },
  );

  it('should stop the auto parser chain when the limit is exceeded', async () => {
    const stream = await createReadableStreamFromFile(sampleFile('large_BigBuckBunny.mp4'));
    await expect(getMediaInfo(stream, { useParser: 'auto', maxBytesToRead: 2 * 1024 * 1024 })).rejects.toBeInstanceOf(MaxBytesExceededError);
  });

  it('should apply the limit to Blob input too', async () => {
    // The MXF parser reads the whole file
    const blob = await fs.openAsBlob(sampleFile('sample.h264.pcm24le.8ch.mxf'));
    await expect(getMediaInfo(blob, { useParser: 'media-utils', maxBytesToRead: 1024 * 1024 })).rejects.toBeInstanceOf(MaxBytesExceededError);
    const info = await getMediaInfo(blob, { useParser: 'media-utils', maxBytesToRead: blob.size });
    expect(info.container).toBe('mxf');
  });

  it('should allow third-party parsers to parse what is within the limit', async () => {
    // remotion and isoboxer normally read a 1 MB probe
    const blob = await fs.openAsBlob(sampleFile('engine-start.h264.aac.mp4'));
    for (const useParser of ['remotion', 'isoboxer'] as const) {
      const info = await getMediaInfo(blob, { useParser, maxBytesToRead: 128 * 1024 });
      expect(info.container).toBe('mp4');
    }
  });

  it('should work with a small limit for a moov-first MP4 stream even with sampleTableInfo', async () => {
    const filename = 'engine-start.h264.aac.mp4';
    const maxBytesToRead = 128 * 1024;
    expect(fs.statSync(sampleFile(filename)).size).toBeGreaterThan(2 * maxBytesToRead);
    const info = await getMediaInfo(await createReadableStreamFromFile(sampleFile(filename)), {
      useParser: 'media-utils',
      sampleTableInfo: true,
      maxBytesToRead,
    });
    expect(info.bytesRead).toBeLessThan(maxBytesToRead);
    expect((info.audioStreams[0] as any).sampleTableInfo.chunkOffsets.length).toBeGreaterThan(0);
  });
});
