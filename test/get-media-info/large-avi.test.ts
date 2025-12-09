import { describe } from '@jest/globals';

import { runGetMediaInfoTestCases } from '../test-utils';
import { largeAviTestCases } from './large-avi.config';

describe('getMediaInfo with large AVI files', () => {
  runGetMediaInfoTestCases(largeAviTestCases, 'media-utils');
});
