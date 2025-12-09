import { describe } from '@jest/globals';

import { runGetMediaInfoTestCases } from '../test-utils';
import { largeMkvTestCases } from './large-mkv.config';

describe('getMediaInfo with large MKV files', () => {
  runGetMediaInfoTestCases(largeMkvTestCases, 'media-utils');
});
