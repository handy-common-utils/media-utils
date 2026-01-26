import { GetMediaInfoOptions, GetMediaInfoResult } from '../get-media-info';
import { AudioStreamInfo, VideoStreamInfo } from '../media-info';
import { UnsupportedFormatError } from '../utils';

/**
 * Interface for the parser context to handle both streams and buffered data.
 */
export interface ParserContext {
  readonly buffer: Buffer;
  readonly bytesRead: number;
  ensureBytes(n: number): Promise<boolean>;
  skipBytes(n: number): Promise<void>;
}

/**
 * Options for the MXF parser specifically.
 */
export interface MediaInfoParserOptions extends GetMediaInfoOptions {
  onSamples?: (sample: { streamInfo: { id: number }; data: Buffer }) => Promise<void>;
}

// SMPTE Universal Labels (ULs)
const MATERIAL_PACKAGE_KEY = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x02, 0x53, 0x01, 0x01, 0x0d, 0x01, 0x01, 0x01, 0x01, 0x01, 0x36, 0x00]);
const SOURCE_PACKAGE_KEY = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x02, 0x53, 0x01, 0x01, 0x0d, 0x01, 0x01, 0x01, 0x01, 0x01, 0x37, 0x00]);
const TRACK_KEY = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x02, 0x53, 0x01, 0x01, 0x0d, 0x01, 0x01, 0x01, 0x01, 0x01, 0x3b, 0x00]);
const SEQUENCE_KEY = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x02, 0x53, 0x01, 0x01, 0x0d, 0x01, 0x01, 0x01, 0x01, 0x01, 0x0f, 0x00]);
const SOURCE_CLIP_KEY = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x02, 0x53, 0x01, 0x01, 0x0d, 0x01, 0x01, 0x01, 0x01, 0x01, 0x11, 0x00]);
const MULTIPLE_DESCRIPTOR_KEY = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x02, 0x53, 0x01, 0x01, 0x0d, 0x01, 0x01, 0x01, 0x01, 0x01, 0x44, 0x00]);
const MPEG_VIDEO_DESCRIPTOR_KEY = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x02, 0x53, 0x01, 0x01, 0x0d, 0x01, 0x01, 0x01, 0x01, 0x01, 0x51, 0x00]);
const WAVE_AUDIO_DESCRIPTOR_KEY = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x02, 0x53, 0x01, 0x01, 0x0d, 0x01, 0x01, 0x01, 0x01, 0x01, 0x48, 0x00]);
const AES3_AUDIO_DESCRIPTOR_KEY = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x02, 0x53, 0x01, 0x01, 0x0d, 0x01, 0x01, 0x01, 0x01, 0x01, 0x47, 0x00]);
const GENERIC_SOUND_DESCRIPTOR_KEY = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x02, 0x53, 0x01, 0x01, 0x0d, 0x01, 0x01, 0x01, 0x01, 0x01, 0x42, 0x00]);

const ESSENCE_ELEMENT_KEY_PREFIX = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x01, 0x02, 0x01]);

// Operational Patterns
// The Operational Pattern UL is a 16-byte identifier where:
// - Bytes 1-12: Base identifier (0x06 0x0e 0x2b 0x34 0x04 0x01 0x01 ... 0x01)
// - Byte 13: Item Complexity (0x01=single, 0x02=playlist, 0x03=edit, 0x10=atom)
// - Byte 14: Package Complexity (0x01=single/a, 0x02=ganged/b, 0x03=alternate/c, 0x00=none for atom)
// - Byte 15: Qualifiers (application-specific)
// - Byte 16: Reserved (usually 0x00)
//
// Generalized Patterns (SMPTE 377M):
// - OP1a: Single item, single package (SMPTE 378M)
// - OP1b: Single item, ganged packages (SMPTE 391M)
// - OP1c: Single item, alternate packages
// - OP2a: Playlist items, single package (SMPTE 392M)
// - OP2b: Playlist items, ganged packages
// - OP2c: Playlist items, alternate packages
// - OP3a: Edit items, single package (SMPTE 407M)
// - OP3b: Edit items, ganged packages
// - OP3c: Edit items, alternate packages
//
// Specialized Patterns:
// - OP-Atom: Single track per file (SMPTE 390M)
const OP1A_BASE = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x04, 0x01, 0x01, 0x01, 0x0d, 0x01, 0x02, 0x01]);

// Codec Universal Labels (Partial list for identification)
const UL_PICTURE_ESSENCE_CODING_MPEG2_PREFIX = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x04, 0x01, 0x01, 0x03, 0x04, 0x01, 0x02, 0x02]);
// Updated to match common WAVE PCM usage (byte 10 = 0x02)
const UL_SOUND_ESSENCE_CODING_LPCM_WAV = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x04, 0x01, 0x01, 0x01, 0x04, 0x02, 0x02, 0x01]);

/**
 * Reads a BER length from a buffer at a given position.
 * @param buffer - The buffer to read from.
 * @param offset - The position to start reading at.
 * @returns The length and the number of bytes read.
 */
function readBERLength(buffer: Buffer | Uint8Array, offset: number): { length: number; bytesRead: number } {
  const b = buffer[offset];
  if (b < 0x80) {
    return { length: b, bytesRead: 1 };
  }
  const bytesCount = b & 0x7f;
  if (bytesCount === 0) {
    // 0x80: Undefined length
    return { length: -1, bytesRead: 1 };
  }
  let length = 0;
  for (let i = 0; i < bytesCount; i++) {
    length = length * 256 + buffer[offset + 1 + i];
  }
  return { length, bytesRead: 1 + bytesCount };
}

/**
 * Compares two UUIDs or ULs.
 * @param a - The first UUID or UL.
 * @param b - The second UUID or UL.
 * @returns True if they are equal.
 */
function compareUUID(a: Buffer | Uint8Array | undefined, b: Buffer | Uint8Array): boolean {
  if (!a || a.length !== b.length) return false;
  let i = 0;
  for (const byte of a) {
    if (byte !== b[i++]) return false;
  }
  return true;
}

interface MXFMetadataSet {
  key: Buffer;
  instanceUID: Buffer;
  properties: Map<number, Buffer>;
}

/**
 * Decodes properties from a metadata set value.
 * @param key - The set key.
 * @param valueBytes - The set value bytes.
 * @returns The decoded metadata set.
 */
function decodeMetadataSet(key: Buffer, valueBytes: Uint8Array): MXFMetadataSet {
  const properties: Map<number, Buffer> = new Map();
  let propOffset = 0;
  let instUID = Buffer.alloc(16);
  const value = Buffer.from(valueBytes);
  const len = value.length;
  while (propOffset < len) {
    if (propOffset + 4 > len) break;
    const tag = value.readUInt16BE(propOffset);
    const l = value.readUInt16BE(propOffset + 2);
    if (propOffset + 4 + l > len) break;
    const v = value.subarray(propOffset + 4, propOffset + 4 + l);
    properties.set(tag, Buffer.from(v));
    if (tag === 0x3c0a) instUID = Buffer.from(v);
    propOffset += 4 + l;
  }
  return { key, instanceUID: instUID, properties };
}

/**
 * Parses an MXF file and extracts media information.
 * @param input - The input stream or parser context.
 * @param options - Parser options.
 * @returns Media information without the parser field.
 */
export async function parseMxf(
  input: ReadableStream<Uint8Array> | ParserContext,
  options?: MediaInfoParserOptions,
): Promise<Omit<GetMediaInfoResult, 'parser'>> {
  let context: ParserContext;

  if (input instanceof ReadableStream) {
    const reader = input.getReader();
    let internalBuffer = Buffer.alloc(0);
    let bytesReadTotal = 0;
    context = {
      get buffer() {
        return internalBuffer;
      },
      get bytesRead() {
        return bytesReadTotal;
      },
      ensureBytes: async (n: number) => {
        while (internalBuffer.length < n) {
          const { done, value } = await reader.read();
          if (done) return false;
          internalBuffer = Buffer.concat([internalBuffer, value]);
        }
        return true;
      },
      skipBytes: async (n: number) => {
        while (internalBuffer.length < n) {
          const { done, value } = await reader.read();
          if (done) {
            bytesReadTotal += internalBuffer.length;
            internalBuffer = Buffer.alloc(0);
            return;
          }
          internalBuffer = Buffer.concat([internalBuffer, value]);
        }
        internalBuffer = internalBuffer.subarray(n);
        bytesReadTotal += n;
      },
    };
  } else {
    context = input;
  }

  // Initial check for MXF header
  if (!(await context.ensureBytes(16))) {
    throw new UnsupportedFormatError('Not an MXF file: insufficient data');
  }
  const headerPrefix = Buffer.from([0x06, 0x0e, 0x2b, 0x34, 0x02, 0x05, 0x01]);
  if (!compareUUID(context.buffer.subarray(0, 7), headerPrefix)) {
    throw new UnsupportedFormatError('Not an MXF file: invalid header prefix');
  }

  const metadataSetsLookup: Map<string, MXFMetadataSet> = new Map();
  const metadataSetsRaw: MXFMetadataSet[] = [];
  let operationalPattern = 'unknown';

  let hasMore = true;
  while (hasMore) {
    if (!(await context.ensureBytes(25))) {
      if (context.buffer.length > 0) await context.skipBytes(context.buffer.length);
      break;
    }

    const key = Buffer.from(context.buffer.subarray(0, 16));
    const { length, bytesRead: berBytesRead } = readBERLength(context.buffer, 16);
    const klvHeaderLen = 16 + berBytesRead;

    if (!(await context.ensureBytes(klvHeaderLen + length))) {
      if (context.buffer.length > 0) await context.skipBytes(context.buffer.length);
      break;
    }

    const value = context.buffer.subarray(klvHeaderLen, klvHeaderLen + length);

    if (key[4] === 0x02 && key[5] === 0x53) {
      // Metadata Set
      const set = decodeMetadataSet(key, value);
      metadataSetsLookup.set(set.instanceUID.toString('hex'), set);
      metadataSetsRaw.push(set);
    } else if (key[4] === 0x02 && key[5] === 0x05 && key[13] >= 0x02 && key[13] <= 0x04) {
      // Partition Pack - contains Operational Pattern UL
      if (length >= 80 && compareUUID(value.subarray(64, 76), OP1A_BASE)) {
        // Decode the operational pattern from bytes 13-14 of the UL
        const itemComplexity = value[76]; // Byte 13 of the OP UL
        const packageComplexity = value[77]; // Byte 14 of the OP UL

        // Map to operational pattern names
        if (itemComplexity === 0x10 && packageComplexity === 0x00) {
          operationalPattern = 'OP-Atom';
        } else if (itemComplexity >= 0x01 && itemComplexity <= 0x03) {
          const itemType = itemComplexity === 0x01 ? '1' : itemComplexity === 0x02 ? '2' : '3';
          const packageType = packageComplexity === 0x01 ? 'a' : packageComplexity === 0x02 ? 'b' : packageComplexity === 0x03 ? 'c' : '?';
          operationalPattern = `OP${itemType}${packageType}`;
        } else {
          // Unknown but valid OP UL structure
          operationalPattern = `OP-Custom(0x${itemComplexity.toString(16).padStart(2, '0')},0x${packageComplexity.toString(16).padStart(2, '0')})`;
        }
      }
    } else if (compareUUID(key.subarray(0, 7), ESSENCE_ELEMENT_KEY_PREFIX) && options?.onSamples) {
      const essenceNum = (key[12] << 8) | key[13];
      await options.onSamples({ streamInfo: { id: essenceNum }, data: Buffer.from(value) });
    }

    await context.skipBytes(klvHeaderLen + (length === -1 ? 0 : length));
  }

  const audioStreams: AudioStreamInfo[] = [];
  const videoStreams: VideoStreamInfo[] = [];
  let durationInSeconds = 0;

  const matPkg = metadataSetsRaw.find((s) => compareUUID(s.key, MATERIAL_PACKAGE_KEY));
  if (matPkg) {
    const tracksProp = matPkg.properties.get(0x4403);
    if (tracksProp) {
      const count = tracksProp.readUInt32BE(0);
      const itemSize = tracksProp.readUInt32BE(4);
      for (let i = 0; i < count; i++) {
        const uid = tracksProp.subarray(8 + i * itemSize, 8 + (i + 1) * itemSize);
        const track = metadataSetsLookup.get(uid.toString('hex'));
        if (!track || !compareUUID(track.key, TRACK_KEY)) continue;

        const trackID = track.properties.get(0x4801)?.readUInt32BE(0) || 0;
        const seqUID = track.properties.get(0x4803);
        const seq = seqUID ? metadataSetsLookup.get(seqUID.toString('hex')) : undefined;
        if (!seq || !compareUUID(seq.key, SEQUENCE_KEY)) continue;

        const compsProp = seq.properties.get(0x1001);
        if (!compsProp) continue;

        // Collect info from first valid SourceClip
        const compCount = compsProp.readUInt32BE(0);
        const compItemSize = compsProp.readUInt32BE(4);
        let trackAdded = false;

        for (let j = 0; j < compCount && !trackAdded; j++) {
          const compUID = compsProp.subarray(8 + j * compItemSize, 8 + (j + 1) * compItemSize);
          const comp = metadataSetsLookup.get(compUID.toString('hex'));
          if (!comp || !compareUUID(comp.key, SOURCE_CLIP_KEY)) continue;

          const dProp = comp.properties.get(0x0202);
          const eProp = track.properties.get(0x4b01);
          if (dProp && eProp) {
            const dur = Number(dProp.readBigInt64BE(0));
            const num = eProp.readInt32BE(0);
            const den = eProp.readInt32BE(4);
            durationInSeconds = Math.max(durationInSeconds, dur * (den / num));
          }

          const spUID = comp.properties.get(0x1101);
          const stID = comp.properties.get(0x1102)?.readUInt32BE(0);
          const spkg = spUID
            ? metadataSetsRaw.find((s) => compareUUID(s.key, SOURCE_PACKAGE_KEY) && s.properties.get(0x4401)?.equals(spUID))
            : undefined;
          if (!spkg || stID === undefined) continue;

          const spTracksProp = spkg.properties.get(0x4403);
          if (!spTracksProp) continue;

          const spTCount = spTracksProp.readUInt32BE(0);
          const spTSize = spTracksProp.readUInt32BE(4);
          for (let k = 0; k < spTCount && !trackAdded; k++) {
            const spTUID = spTracksProp.subarray(8 + k * spTSize, 8 + (k + 1) * spTSize);
            const spT = metadataSetsLookup.get(spTUID.toString('hex'));
            if (!spT || spT.properties.get(0x4801)?.readUInt32BE(0) !== stID) continue;

            const eNumProp = spT.properties.get(0x4804);
            const eNum = eNumProp ? eNumProp.readUInt32BE(0) >> 16 : 0;
            const dUID = spkg.properties.get(0x4701);
            const dSet = dUID ? metadataSetsLookup.get(dUID.toString('hex')) : undefined;
            if (!dSet) continue;

            const targets = [dSet];
            if (compareUUID(dSet.key, MULTIPLE_DESCRIPTOR_KEY)) {
              const sProp = dSet.properties.get(0x3f01);
              if (sProp) {
                const sCount = sProp.readUInt32BE(0);
                const sSize = sProp.readUInt32BE(4);
                for (let l = 0; l < sCount; l++) {
                  const subUID = sProp.subarray(8 + l * sSize, 8 + (l + 1) * sSize);
                  const subSet = metadataSetsLookup.get(subUID.toString('hex'));
                  if (subSet) targets.push(subSet);
                }
              }
            }

            for (const target of targets) {
              const linkedID = target.properties.get(0x3002)?.readUInt32BE(0);
              const isAudioDescriptor =
                compareUUID(target.key, WAVE_AUDIO_DESCRIPTOR_KEY) ||
                compareUUID(target.key, AES3_AUDIO_DESCRIPTOR_KEY) ||
                compareUUID(target.key, GENERIC_SOUND_DESCRIPTOR_KEY);
              const isVideoDescriptor = compareUUID(target.key, MPEG_VIDEO_DESCRIPTOR_KEY);

              if (linkedID === undefined) {
                // If LinkedTrackID is missing, match by essence type
                const isAudioTrack = eNum >> 8 === 0x16;
                const isVideoTrack = eNum >> 8 === 0x15;
                if (isAudioTrack && !isAudioDescriptor) continue;
                if (isVideoTrack && !isVideoDescriptor) continue;
              } else if (linkedID !== stID) {
                continue;
              }

              const sRateProp = target.properties.get(0x3d03);
              const chProp = target.properties.get(0x3d07);
              const bProp = target.properties.get(0x3d01);
              if (sRateProp && chProp && isAudioDescriptor) {
                const sr = sRateProp.readInt32BE(0) / sRateProp.readInt32BE(4);
                const ch = chProp.readUInt32BE(0);
                const bps = bProp ? bProp.readUInt32BE(0) : 16;
                const soundCodingUL = target.properties.get(0x3d06);

                let codec = 'unknown';
                if (soundCodingUL && compareUUID(soundCodingUL.subarray(0, 12), UL_SOUND_ESSENCE_CODING_LPCM_WAV)) {
                  codec = `pcm_s${bps}le`;
                } else if (compareUUID(target.key, WAVE_AUDIO_DESCRIPTOR_KEY)) {
                  codec = `pcm_s${bps}le`;
                } else if (compareUUID(target.key, AES3_AUDIO_DESCRIPTOR_KEY)) {
                  codec = `pcm_s${bps}le`; // Fallback to LE for compatibility
                } else {
                  // Fallback or generic sound, default to LE if unspecified for compatibility
                  codec = `pcm_s${bps}le`;
                }

                audioStreams.push({
                  id: trackID,
                  codec: codec as any,
                  codecDetail: codec,
                  channelCount: ch,
                  sampleRate: sr,
                  bitrate: ch * sr * bps,
                  bitsPerSample: bps,
                  durationInSeconds: 0,
                  codecDetails: {
                    essenceTrackNumber: eNum,
                    blockAlign: (ch * bps) / 8,
                  },
                });
                trackAdded = true;
                break;
              } else if (target.properties.get(0x3203) && target.properties.get(0x3202) && isVideoDescriptor) {
                const w = target.properties.get(0x3203)!.readUInt32BE(0);
                const h = target.properties.get(0x3202)!.readUInt32BE(0);

                const eRateProp = track.properties.get(0x4b01) || target.properties.get(0x3001);
                let fps = 0;
                if (eRateProp) {
                  const num = eRateProp.readInt32BE(0);
                  const den = eRateProp.readInt32BE(4);
                  if (den !== 0) fps = Number((num / den).toFixed(2));
                }

                const pictureCodingUL = target.properties.get(0x3201);
                let codec = 'unknown';
                let profile: string | undefined;

                if (pictureCodingUL && compareUUID(pictureCodingUL.subarray(0, 12), UL_PICTURE_ESSENCE_CODING_MPEG2_PREFIX)) {
                  codec = 'mpeg2video';
                  const profileAndLevel = target.properties.get(0x8007)?.readUInt8(0);

                  if (profileAndLevel !== undefined) {
                    const mainProfile = (profileAndLevel & 0x70) >> 4;
                    switch (mainProfile) {
                      case 4: {
                        profile = 'Main';
                        break;
                      }
                      case 5: {
                        profile = 'Simple';
                        break;
                      }
                      case 3: {
                        profile = 'SNR Scalable';
                        break;
                      }
                      case 2: {
                        profile = 'Spatially Scalable';
                        break;
                      }
                      case 1: {
                        profile = 'High';
                        break;
                      }
                      case 7: {
                        profile = '4:2:2';
                        break;
                      }
                    }
                  } else if (pictureCodingUL.length >= 14) {
                    // Fallback: Read from Byte 14 (index 13) of the UL
                    // Mappings: 0x01(MP@ML), 0x03(MP@HL), 0x05(MP@H-14) -> Main
                    //           0x02(422P@ML), 0x04(422P@HL) -> 4:2:2
                    const ulLevel = pictureCodingUL[13];
                    switch (ulLevel) {
                      case 0x01:
                      case 0x03:
                      case 0x05: {
                        profile = 'Main';
                        break;
                      }
                      case 0x02:
                      case 0x04: {
                        profile = '4:2:2';
                        break;
                      }
                    }
                  }
                }

                videoStreams.push({
                  id: trackID,
                  codec: codec as any,
                  codecDetail: codec,
                  profile,
                  width: w,
                  height: h,
                  durationInSeconds: 0,
                  fps,
                  codecDetails: {
                    essenceTrackNumber: eNum,
                  },
                });
                trackAdded = true;
                break;
              }
            }
          }
        }
      }
    }
  }

  const finalDuration = durationInSeconds > 0 ? Number(durationInSeconds.toFixed(2)) : 0;
  for (const s of audioStreams) s.durationInSeconds = finalDuration;
  for (const s of videoStreams) s.durationInSeconds = finalDuration;

  return {
    container: 'mxf',
    containerDetail: operationalPattern,
    durationInSeconds: finalDuration,
    audioStreams,
    videoStreams,
    bytesRead: context.bytesRead,
  };
}
