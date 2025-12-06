import { VideoStreamInfo } from '../media-info';
import { BitReader } from './binary';

/**
 * Remove Emulation Prevention Bytes (0x03) from H.264 NAL unit
 * @param data NAL unit data
 * @returns Data without emulation prevention bytes
 */
function removeEmulationPreventionBytes(data: Uint8Array): Uint8Array {
  const newData = new Uint8Array(data.length);
  let j = 0;
  for (let i = 0; i < data.length; i++) {
    if (i > 1 && data[i] === 0x03 && data[i - 1] === 0x00 && data[i - 2] === 0x00) {
      continue;
    }
    newData[j++] = data[i];
  }
  return newData.slice(0, j);
}

/**
 * Parse H.264 SPS (Sequence Parameter Set) NAL unit
 * @param data SPS NAL unit data (starting after start code and NAL header byte)
 * @returns Parsed video stream info
 */
export function parseSPS(data: Uint8Array): Partial<VideoStreamInfo> {
  const rbsp = removeEmulationPreventionBytes(data);
  const reader = new BitReader(rbsp);

  const profileIdc = reader.readBits(8);
  const constraintSetFlags = reader.readBits(8); // constraint_set0_flag to reserved_zero_2bits
  const levelIdc = reader.readBits(8);
  const _seqParameterSetId = reader.readUE();

  if (
    profileIdc === 100 ||
    profileIdc === 110 ||
    profileIdc === 122 ||
    profileIdc === 244 ||
    profileIdc === 44 ||
    profileIdc === 83 ||
    profileIdc === 86 ||
    profileIdc === 118 ||
    profileIdc === 128
  ) {
    const chromaFormatIdc = reader.readUE();
    if (chromaFormatIdc === 3) {
      reader.readBit(); // separate_colour_plane_flag
    }
    reader.readUE(); // bit_depth_luma_minus8
    reader.readUE(); // bit_depth_chroma_minus8
    reader.readBit(); // qpprime_y_zero_transform_bypass_flag
    const seqScalingMatrixPresentFlag = reader.readBit();
    if (seqScalingMatrixPresentFlag) {
      if (chromaFormatIdc === 3) {
        const scalingListCount = 12;
        for (let i = 0; i < scalingListCount; i++) {
          const seqScalingListPresentFlag = reader.readBit();
          if (seqScalingListPresentFlag) {
            let lastScale = 8;
            let nextScale = 8;
            const sizeOfScalingList = i < 6 ? 16 : 64;
            for (let j = 0; j < sizeOfScalingList; j++) {
              if (nextScale !== 0) {
                const deltaScale = reader.readSE();
                nextScale = (lastScale + deltaScale + 256) % 256;
              }
              lastScale = nextScale === 0 ? lastScale : nextScale;
            }
          }
        }
      } else {
        const scalingListCount = 8;
        for (let i = 0; i < scalingListCount; i++) {
          const seqScalingListPresentFlag = reader.readBit();
          if (seqScalingListPresentFlag) {
            let lastScale = 8;
            let nextScale = 8;
            const sizeOfScalingList = i < 6 ? 16 : 64;
            for (let j = 0; j < sizeOfScalingList; j++) {
              if (nextScale !== 0) {
                const deltaScale = reader.readSE();
                nextScale = (lastScale + deltaScale + 256) % 256;
              }
              lastScale = nextScale === 0 ? lastScale : nextScale;
            }
          }
        }
      }
    }
  }

  reader.readUE(); // log2_max_frame_num_minus4
  const picOrderCntType = reader.readUE();
  if (picOrderCntType === 0) {
    reader.readUE(); // log2_max_pic_order_cnt_lsb_minus4
  } else if (picOrderCntType === 1) {
    reader.readBit(); // delta_pic_order_always_zero_flag
    reader.readSE(); // offset_for_non_ref_pic
    reader.readSE(); // offset_for_top_to_bottom_field
    const numRefFramesInPicOrderCntCycle = reader.readUE();
    for (let i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
      reader.readSE(); // offset_for_ref_frame[i]
    }
  }

  reader.readUE(); // max_num_ref_frames
  reader.readBit(); // gaps_in_frame_num_value_allowed_flag

  const picWidthInMbsMinus1 = reader.readUE();
  const picHeightInMapUnitsMinus1 = reader.readUE();
  const frameMbsOnlyFlag = reader.readBit();

  if (!frameMbsOnlyFlag) {
    reader.readBit(); // mb_adaptive_frame_field_flag
  }

  reader.readBit(); // direct_8x8_inference_flag
  const frameCroppingFlag = reader.readBit();

  let frameCropLeftOffset = 0;
  let frameCropRightOffset = 0;
  let frameCropTopOffset = 0;
  let frameCropBottomOffset = 0;

  if (frameCroppingFlag) {
    frameCropLeftOffset = reader.readUE();
    frameCropRightOffset = reader.readUE();
    frameCropTopOffset = reader.readUE();
    frameCropBottomOffset = reader.readUE();
  }

  let width = (picWidthInMbsMinus1 + 1) * 16;
  let height = (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16;

  // Adjust for cropping
  // Crop units depend on chroma format (usually 4:2:0)
  // For 4:2:0, SubWidthC = 2, SubHeightC = 2
  // CropUnitX = SubWidthC, CropUnitY = SubHeightC * (2 - frame_mbs_only_flag)
  // Assuming 4:2:0 for simplicity as it's most common
  const cropUnitX = 2;
  const cropUnitY = 2 * (2 - frameMbsOnlyFlag);

  width -= (frameCropLeftOffset + frameCropRightOffset) * cropUnitX;
  height -= (frameCropTopOffset + frameCropBottomOffset) * cropUnitY;

  return {
    width,
    height,
    codecDetail: `avc1.${toHex(profileIdc, 2)}${toHex(constraintSetFlags, 2)}${toHex(levelIdc, 2)}`,
  };
}

function toHex(value: number, minDigits: number): string {
  return value.toString(16).padStart(minDigits, '0');
}

/**
 * @param profileIdc Profile IDC
 * @returns Profile name
 */
export function h264ProfileName(profileIdc: number): string {
  switch (profileIdc) {
    case 66: {
      return 'Baseline';
    }
    case 77: {
      return 'Main';
    }
    case 100: {
      return 'High';
    }
    default: {
      return `Profile${profileIdc}`;
    }
  }
}

/**
 * @param levelIdc Level IDC
 * @returns Level string
 */
export function h264LevelString(levelIdc: number): string {
  return (levelIdc / 10).toFixed(1);
}
