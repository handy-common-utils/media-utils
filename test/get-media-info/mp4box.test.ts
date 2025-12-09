import { describe } from '@jest/globals';

import { getGetMediaInfoTestCases, runGetMediaInfoTestCases } from '../test-utils';
import { largeMkvTestCases } from './large-mkv.config';
import { mediaUtilsTestCases } from './media-utils.config';
import { mp4boxTestCases } from './mp4box.config';

describe('getMediaInfo with mp4box parser', () => {
  runGetMediaInfoTestCases(mp4boxTestCases, 'mp4box');
  runGetMediaInfoTestCases(
    [
      ...getGetMediaInfoTestCases(
        mediaUtilsTestCases,
        'engine-start.h264.pcms16le.avi',
        'engine-start.mpeg2video.mp2.m2ts',
        'engine-start.vp9.opus.webm',
        'engine-start.vp8.vorbis.webm',
        'engine-start.vp9.vorbis.webm',
        'engine-start.av1.opus.webm',
        'engine-start.wmv2.wmav2.wmv',
        'engine-start.aac',
        'engine-start.mp3',
        'engine-start.opus.ogg',
        'engine-start.vorbis.ogg',
        'engine-start.pcms16le.wav',
        'engine-start.wmav2.wma',
      ),
      ...getGetMediaInfoTestCases(
        largeMkvTestCases,
        'large_matroska-test-files1.mkv',
        'large_matroska-test-files2.mkv',
        'large_matroska-test-files3.mkv',
      ),
    ].map((testCase) => ({ ...testCase, shouldFail: true })),
    'mp4box',
  );
});
