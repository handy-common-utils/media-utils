import { describe } from '@jest/globals';

import { runGetMediaInfoTestCases } from '../test-utils';
import { largeMovTestCases } from './large-mov.config';

describe('getMediaInfo with large MOV files', () => {
  runGetMediaInfoTestCases(largeMovTestCases, 'media-utils');
});
