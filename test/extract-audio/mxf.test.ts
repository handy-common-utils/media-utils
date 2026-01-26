import { describe, expect } from '@jest/globals';

import { runExtractAudioTestCases } from '../test-utils';

describe('Extract audio from MXF', () => {
  runExtractAudioTestCases([
    {
      filename: 'sample_960x400_ocean_with_audio.mxf',
      expectedMediaInfo: {
        bytesRead: 65536,
        parser: 'media-utils',
        container: 'wav',
        containerDetail: 'wav',
        durationInSeconds: expect.closeTo(46.55, 1) as any,
        videoStreams: [],
        audioStreams: [
          {
            id: 1,
            codec: 'pcm_s16le',
            codecDetail: 'pcm_s16le',
            channelCount: 2,
            sampleRate: 48000,
            bitrate: 1536000,
            durationInSeconds: expect.closeTo(46.55, 1) as any,
            bitsPerSample: 16,
            codecDetails: {
              blockAlign: 4,
              formatTag: 1,
              samplesPerBlock: undefined,
            },
          },
        ],
      },
    },
  ]);
});
