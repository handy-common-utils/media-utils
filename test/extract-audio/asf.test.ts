import { describe, expect, it, jest } from '@jest/globals';
import fs from 'node:fs';

import { extractAudioFromFileToFile } from '../../src/extract-audio';
import { AsfMediaInfo, parseAsf } from '../../src/parsers/asf';
import { createReadableStreamFromFile } from '../../src/utils';
import { outputFile, sampleFile, setupCleanup, trackFileForCleanup } from '../test-utils';

setupCleanup();

describe('Extract audio from ASF/WMV', () => {
  it('should extract WMAv2 audio from WMV file', async () => {
    const inputFile = sampleFile('engine-start.wmv2.wmav2.wmv');
    const outputFilePath = outputFile('extracted-wmav2-from-wmv.wma');

    await extractAudioFromFileToFile(inputFile, outputFilePath);

    expect(fs.existsSync(outputFilePath)).toBe(true);

    // Verify the extracted audio can be parsed
    const webStream = await createReadableStreamFromFile(outputFilePath);
    const extractedAudioInfo = await parseAsf(webStream, {
      extractStreams: [0, 1, 2],
      onPayload: (_streamNumber, _payloadData, _metadata) => {
        // console.error('onPayload:', streamNumber, payloadData.length, metadata);
      },
    });

    // Verify it's recognized as WMA (ASF container with audio only)
    expect(extractedAudioInfo).toEqual({
      container: 'asf',
      containerDetail: 'wma',
      durationInSeconds: 6,
      videoStreams: [],
      audioStreams: [
        {
          id: 2,
          codec: 'wmav2',
          codecDetail: 'WMAv2',
          channelCount: 2,
          sampleRate: 44100,
          bitrate: 128000,
          durationInSeconds: 6,
          bitsPerSample: 16,
        },
      ],
      fileProperties: {
        playDuration: 91460000,
        sendDuration: 60460000,
        packetSize: 1280,
        preroll: 3100,
      },
      additionalStreamInfo: expect.any(Map) as any,
    } as AsfMediaInfo);

    trackFileForCleanup(outputFilePath);
  });

  it('should report progress when extracting from ASF', async () => {
    const inputFile = sampleFile('engine-start.wmv2.wmav2.wmv');
    const outputFilePath = outputFile('progress-test-asf.wma');
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
});
