import { describe } from '@jest/globals';

import { getGetMediaInfoTestCases, runGetMediaInfoTestCases } from '../test-utils';
import { largeMkvTestCases } from './large-mkv.config';
import { mediaUtilsTestCases } from './media-utils.config';
import { remotionTestCases } from './remotion.config';

describe('getMediaInfo with remotion parser', () => {
  runGetMediaInfoTestCases(remotionTestCases, 'remotion');
  runGetMediaInfoTestCases(
    [
      ...getGetMediaInfoTestCases(
        mediaUtilsTestCases,
        'engine-start.h264.mp3.mov',
        'engine-start.mjpeg.pcms16le.avi',
        'engine-start.h264.pcms16le.avi',
        'engine-start.mpeg2video.mp2.m2ts',
        'engine-start.wmv2.wmav2.wmv',
        'engine-start.av1.opus.webm',
        'engine-start.opus.ogg',
        'engine-start.vorbis.ogg',
        'engine-start.wmav2.wma',
      ),
      ...getGetMediaInfoTestCases(largeMkvTestCases, 'large_matroska-test-files1.mkv', 'large_matroska-test-files4.mkv'),
    ].map((testCase) => ({ ...testCase, shouldFail: true })),
    'remotion',
  );
});
