import { describe } from '@jest/globals';

import { runGetMediaInfoTestCases } from '../test-utils';
import { largeWebmTestCases } from './large-webm.config';

describe('getMediaInfo with large WebM files', () => {
  runGetMediaInfoTestCases(largeWebmTestCases, 'media-utils');
});
