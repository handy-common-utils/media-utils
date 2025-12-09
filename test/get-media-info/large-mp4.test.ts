import { describe } from '@jest/globals';

import { runGetMediaInfoTestCases } from '../test-utils';
import { largeMp4TestCases } from './large-mp4.config';

describe('getMediaInfo with large MP4 files', () => {
  runGetMediaInfoTestCases(largeMp4TestCases, 'media-utils');
});
