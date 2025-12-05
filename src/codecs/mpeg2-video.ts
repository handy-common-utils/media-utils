import { VideoStreamInfo } from '../media-info';
import { UnsupportedFormatError } from '../utils';

/**
 * Parses MPEG-2 Video Sequence Header
 * Start code: 0x000001B3
 *
 * @param data Data containing the sequence header (starting with 0x000001B3)
 * @returns Parsed video stream info
 */
export function parseMpeg2VideoSequenceHeader(data: Uint8Array): Partial<VideoStreamInfo> {
  if (data.length < 12) {
    return {};
  }

  // Check start code
  if (data[0] !== 0x00 || data[1] !== 0x00 || data[2] !== 0x01 || data[3] !== 0xb3) {
    throw new UnsupportedFormatError('Invalid MPEG-2 Video Sequence Header');
  }

  // Horizontal size (12 bits)
  const horizontalSize = (data[4] << 4) | (data[5] >> 4);

  // Vertical size (12 bits)
  const verticalSize = ((data[5] & 0x0f) << 8) | data[6];

  // Aspect ratio information (4 bits)
  // const aspectRatioInfo = data[7] >> 4;

  // Frame rate code (4 bits)
  const frameRateCode = data[7] & 0x0f;

  // Bit rate (18 bits)
  // const bitRateValue = (data[8] << 10) | (data[9] << 2) | (data[10] >> 6);
  // Bit rate is in units of 400 bits/second.
  // const bitRate = bitRateValue * 400;

  // Marker bit (1 bit) - should be 1
  // const markerBit = (data[10] >> 5) & 0x01;

  // VBV buffer size (10 bits)
  // const vbvBufferSize = ((data[10] & 0x1f) << 5) | (data[11] >> 3);

  // Constrained parameters flag (1 bit)
  // const constrainedParametersFlag = (data[11] >> 2) & 0x01;

  // Load intra quantizer matrix flag (1 bit)
  // const loadIntraQuantizerMatrixFlag = (data[11] >> 1) & 0x01;

  // Load non-intra quantizer matrix flag (1 bit)
  // const loadNonIntraQuantizerMatrixFlag = data[11] & 0x01;

  let fps: number | undefined;
  switch (frameRateCode) {
    case 1: {
      fps = 23.976;
      break;
    }
    case 2: {
      fps = 24;
      break;
    }
    case 3: {
      fps = 25;
      break;
    }
    case 4: {
      fps = 29.97;
      break;
    }
    case 5: {
      fps = 30;
      break;
    }
    case 6: {
      fps = 50;
      break;
    }
    case 7: {
      fps = 59.94;
      break;
    }
    case 8: {
      fps = 60;
      break;
    }
    default: {
      // Reserved or forbidden
      break;
    }
  }

  return {
    width: horizontalSize,
    height: verticalSize,
    fps,
  };
}
