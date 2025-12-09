import { describe } from '@jest/globals';

import { getGetMediaInfoTestCase, runGetMediaInfoTestCases } from '../test-utils';
import { isoboxerTestCases } from './isoboxer.config';
import { largeMkvTestCases } from './large-mkv.config';
import { mediaUtilsTestCases } from './media-utils.config';

describe('getMediaInfo with isoboxer parser', () => {
  runGetMediaInfoTestCases(
    [
      ...isoboxerTestCases,
      // Failure cases
      ...[
        // 'engine-start.mjpeg.pcms16le.avi',
        // 'engine-start.h264.pcms16le.avi',
        // 'engine-start.mpeg2video.mp2.m2ts',
        'engine-start.vp9.opus.webm',
        'engine-start.vp8.vorbis.webm',
        'engine-start.vp9.vorbis.webm',
        'engine-start.av1.opus.webm',
        // 'engine-start.wmv2.wmav2.wmv',
        'engine-start.aac',
        'engine-start.mp3',
        // 'engine-start.opus.ogg',
        // 'engine-start.vorbis.ogg',
        // 'engine-start.pcms16le.wav',
        // 'engine-start.wmav2.wma',
      ].map((filename) => ({
        ...getGetMediaInfoTestCase(mediaUtilsTestCases, filename),
        shouldFail: true,
      })),
      ...['large_matroska-test-files1.mkv', 'large_matroska-test-files2.mkv', 'large_matroska-test-files3.mkv'].map((filename) => ({
        ...getGetMediaInfoTestCase(largeMkvTestCases, filename),
        shouldFail: true,
      })),
    ],
    'isoboxer',
  );
});
