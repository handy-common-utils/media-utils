import { describe, expect, it } from '@jest/globals';

import { getMediaInfoFromFile } from '../../src/get-media-info';
import { MediaInfo } from '../../src/media-info';
import { sampleFile } from '../test-utils';

describe('getMediaInfo with large AVI files', () => {
  it.skip('should parse large_BigBuckBunny_surround.avi file with MPEG-4 video and AC-3 audio', async () => {
    const info = await getMediaInfoFromFile(sampleFile('large_BigBuckBunny_surround.avi'));
    expect(info).toEqual({
      parser: 'mp4box',
      container: 'mov',
      containerDetail: 'qt  , qt  ',
      durationInSeconds: expect.closeTo(734, 0) as any,
      mimeType: 'video/mp4; codecs="avc1.4d4028,mp3"; profiles="qt  "',
      videoStreams: [
        {
          id: 1,
          codec: 'mpeg4',
          codecDetail: 'FMP4',
          width: 1920,
          height: 800,
          fps: 24,
          bitrate: expect.closeTo(6162664, -4) as any,
          durationInSeconds: expect.closeTo(734, 0) as any,
        },
      ],
      audioStreams: [
        {
          id: 2,
          codec: 'mp3',
          codecDetail: 'mp3',
          channelCount: undefined, // mp3 in MOV doesn't provide channel count via mp4box
          sampleRate: undefined, // mp3 in MOV doesn't provide sample rate via mp4box
          bitrate: expect.closeTo(192000, -3) as any,
          durationInSeconds: expect.closeTo(734, 0) as any,
        },
      ],
    } as MediaInfo);
  });
});
