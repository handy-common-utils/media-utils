import { describe } from '@jest/globals';

import { runGetMediaInfoTestCases } from '../test-utils';
import { mediaUtilsTestCases } from './media-utils.config';

describe('getMediaInfo with media-utils parser', () => {
  runGetMediaInfoTestCases(mediaUtilsTestCases, 'media-utils');
});
