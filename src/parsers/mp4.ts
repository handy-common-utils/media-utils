import { toHexString } from '../codecs/binary';
import { GetMediaInfoOptions } from '../get-media-info';
import { findAudioCodec, findVideoCodec, MediaInfo } from '../media-info';
import { ensureBufferData, setupGlobalLogger, UnsupportedFormatError } from '../utils';

// Constants for Atom Types
const ATOM_FTYP = 'ftyp';
const ATOM_MOOV = 'moov';
const ATOM_MDAT = 'mdat';
const ATOM_MVHD = 'mvhd';
const ATOM_TRAK = 'trak';
const ATOM_TKHD = 'tkhd';
const ATOM_MDIA = 'mdia';
const ATOM_MDHD = 'mdhd';
const ATOM_HDLR = 'hdlr';
const ATOM_MINF = 'minf';
const ATOM_STBL = 'stbl';
const ATOM_STSD = 'stsd';
const ATOM_STTS = 'stts';
const ATOM_STSC = 'stsc';
const ATOM_STSZ = 'stsz';
const ATOM_STCO = 'stco';
const ATOM_CO64 = 'co64';
const _ATOM_MP4A = 'mp4a';
const ATOM_ESDS = 'esds';

export type OnMp4SamplesCallback = (trackId: number, samples: Uint8Array[]) => void | Promise<void>;

export interface ParseMp4Options extends GetMediaInfoOptions {
  onSamples?: OnMp4SamplesCallback;
}

interface TrackContext {
  id: number;
  type?: 'video' | 'audio';
  codec?: string;
  codecDetail?: string;
  duration?: number;
  timeScale?: number;
  width?: number;
  height?: number;
  sampleRate?: number;
  channelCount?: number;

  // Sample Tables for Audio Extraction
  stts?: { count: number; delta: number }[];
  stsc?: { firstChunk: number; samplesPerChunk: number; sampleDescriptionIndex: number }[];
  stsz?: { sampleSize: number; sampleCount: number; entries: number[] };
  stco?: number[];
  co64?: number[];
}

interface ChunkInfo {
  trackId: number;
  offset: number;
  samplesPerChunk: number;
  sampleDescriptionIndex: number; // 1-based
  sampleSize?: number; // if constant
  sampleStartIndex: number; // Index in the global sample list
}

/**
 * Parse MP4 files
 * @param stream - The readable stream of the MP4 file
 * @param options - Optional options for the parser
 * @returns Promise resolving to MediaInfo
 */
export async function parseMp4(stream: ReadableStream<Uint8Array>, options?: ParseMp4Options): Promise<MediaInfo> {
  const logger = setupGlobalLogger(options);
  if (logger.isDebug) logger.debug('Starting parsing MP4');

  const reader = stream.getReader();
  let buffer: Uint8Array = new Uint8Array(0);
  let bufferOffset = 0;
  let offset = 0;

  // Helper to ensure we have enough data in the buffer
  async function ensureBytes(needed: number): Promise<boolean> {
    while (buffer.length - bufferOffset < needed) {
      const result = await ensureBufferData(reader, buffer, bufferOffset, needed);
      buffer = result.buffer;
      bufferOffset = result.bufferOffset;
      if (result.done) {
        return false;
      }
    }
    return true;
  }

  // Helper functions to read data
  function readUInt32BE(): number {
    const value = (buffer[bufferOffset] << 24) | (buffer[bufferOffset + 1] << 16) | (buffer[bufferOffset + 2] << 8) | buffer[bufferOffset + 3];
    bufferOffset += 4;
    offset += 4;
    return value >>> 0;
  }

  function readUInt16BE(): number {
    const value = (buffer[bufferOffset] << 8) | buffer[bufferOffset + 1];
    bufferOffset += 2;
    offset += 2;
    return value;
  }

  function readUInt8(): number {
    const value = buffer[bufferOffset];
    bufferOffset += 1;
    offset += 1;
    return value;
  }

  function readString(length: number): string {
    let str = '';
    for (let i = 0; i < length; i++) {
      str += String.fromCodePoint(buffer[bufferOffset + i]);
    }
    bufferOffset += length;
    offset += length;
    return str;
  }

  // Skip bytes, either from buffer or by refilling
  async function skip(bytes: number) {
    if (bytes === Infinity) {
      // Skip until EOF
      while (await ensureBytes(1)) {
        const available = buffer.length - bufferOffset;
        bufferOffset += available;
        offset += available;
      }
      return;
    }
    while (bytes > 0) {
      if (buffer.length - bufferOffset >= bytes) {
        bufferOffset += bytes;
        offset += bytes;
        bytes = 0;
      } else {
        const available = buffer.length - bufferOffset;
        bufferOffset += available;
        offset += available;
        bytes -= available;
        // Refill to skip more
        if (!(await ensureBytes(1))) {
          throw new UnsupportedFormatError('Unexpected EOF while skipping');
        }
      }
    }
  }

  try {
    const mediaInfo: MediaInfo = {
      parser: 'media-utils',
      container: 'mp4',
      containerDetail: '',
      videoStreams: [],
      audioStreams: [],
    };

    let currentTrack: TrackContext | null = null;
    const tracks: TrackContext[] = [];

    let isAtVeryBeginning = true;

    // Top level parsing loop: iterating over atoms
    while (await ensureBytes(8)) {
      const atomStart = offset;
      let atomSize = readUInt32BE();
      const atomType = readString(4);

      if (isAtVeryBeginning) {
        if (atomType !== ATOM_FTYP) throw new UnsupportedFormatError('Not valid MP4/MOV: Expected FTYP atom at the very beginning');
        isAtVeryBeginning = false;
      }

      // Handle extended size (64-bit)
      if (atomSize === 0) {
        // Extends to EOF
        atomSize = Infinity;
      } else if (atomSize === 1 && (await ensureBytes(8))) {
        const high = readUInt32BE();
        const low = readUInt32BE();
        atomSize = high * 0x100000000 + low;
      }

      switch (atomType) {
        case ATOM_FTYP: {
          if (atomSize !== Infinity && atomSize < 8) throw new UnsupportedFormatError('Invalid FTYP atom');
          const majorBrand = readString(4);
          const _minorVersion = readUInt32BE();
          const compatibleBrands: string[] = [];
          let remaining = atomSize === Infinity ? Infinity : atomSize - 16;

          if (remaining !== Infinity) {
            while (remaining >= 4) {
              compatibleBrands.push(readString(4));
              remaining -= 4;
            }
          }
          if (remaining > 0) await skip(remaining);

          mediaInfo.containerDetail = [majorBrand, ...compatibleBrands].join(', ');
          if (majorBrand.trim() === 'qt') {
            mediaInfo.container = 'mov';
          }
          break;
        }
        case ATOM_MOOV: {
          if (logger.isDebug) logger.debug(`Found MOOV at ${atomStart}`);
          // Continue to parse children
          // We do NOT skip here, so the loop continues and reads the first child atom
          break;
        }

        case ATOM_TRAK: {
          currentTrack = { id: tracks.length + 1 };
          tracks.push(currentTrack);
          break;
        }

        case ATOM_MDAT: {
          const extractableTracks = tracks.filter((t) => (t.stco || t.co64) && t.stsz && t.stsc && t.stts && t.type === 'audio');

          if (extractableTracks.length > 0 && options?.onSamples) {
            if (logger.isDebug) logger.debug(`Extracting samples from MDAT at ${atomStart}`);

            const chunks: ChunkInfo[] = [];

            for (const track of extractableTracks) {
              const stsc = track.stsc!;
              const stco = track.stco;
              const co64 = track.co64;

              let currentChunkIndex = 1; // 1-based
              let stscIndex = 0;
              let sampleStartIndex = 0;

              const totalChunks = stco ? stco.length : co64!.length;

              while (currentChunkIndex <= totalChunks) {
                const entry = stsc[stscIndex];
                const nextEntry = stsc[stscIndex + 1];
                const endChunk = nextEntry ? nextEntry.firstChunk : totalChunks + 1;

                for (let i = currentChunkIndex; i < endChunk; i++) {
                  let chunkOffset = 0;
                  chunkOffset = stco ? stco[i - 1] : co64![i - 1];

                  chunks.push({
                    trackId: track.id,
                    offset: chunkOffset,
                    samplesPerChunk: entry.samplesPerChunk,
                    sampleDescriptionIndex: entry.sampleDescriptionIndex,
                    sampleStartIndex: sampleStartIndex,
                    sampleSize: track.stsz!.sampleSize,
                  });

                  sampleStartIndex += entry.samplesPerChunk;
                }

                currentChunkIndex = endChunk;
                if (nextEntry) stscIndex++;
              }
            }

            chunks.sort((a, b) => a.offset - b.offset);

            for (const chunk of chunks) {
              // Check if chunk is before current offset (already passed?)
              if (chunk.offset < offset) continue;

              // Check if chunk is outside this MDAT atom
              if (atomSize !== Infinity && chunk.offset >= atomStart + atomSize) break;

              const gap = chunk.offset - offset;
              if (gap > 0) await skip(gap);

              const track = tracks.find((t) => t.id === chunk.trackId)!;
              const samples: Uint8Array[] = [];

              for (let i = 0; i < chunk.samplesPerChunk; i++) {
                let size = chunk.sampleSize || 0;
                if (size === 0) {
                  if (!track.stsz?.entries[chunk.sampleStartIndex + i])
                    throw new UnsupportedFormatError(`Missing sample size for index ${chunk.sampleStartIndex + i}`);
                  size = track.stsz!.entries[chunk.sampleStartIndex + i];
                }

                if (await ensureBytes(size)) {
                  const sampleData = buffer.slice(bufferOffset, bufferOffset + size);
                  samples.push(sampleData);

                  bufferOffset += size;
                  offset += size;
                } else {
                  throw new UnsupportedFormatError('Unexpected EOF reading sample');
                }
              }

              if (samples.length > 0) {
                await options!.onSamples!(chunk.trackId, samples);
              }
            }
          }

          const parsedSoFar = offset - atomStart;
          if (atomSize === Infinity) {
            await skip(Infinity);
          } else if (parsedSoFar < atomSize) {
            await skip(atomSize - parsedSoFar);
          }
          break;
        }

        case ATOM_TKHD: {
          if (!(await ensureBytes(1))) throw new UnsupportedFormatError('EOF');
          const version = readUInt8();
          await skip(3); // flags

          if (version === 1) {
            await skip(16); // creation, modification
            if (!(await ensureBytes(4))) throw new UnsupportedFormatError('EOF');
            const _trackId = readUInt32BE();
            await skip(12); // reserved, duration
          } else {
            await skip(8); // creation, modification
            if (!(await ensureBytes(4))) throw new UnsupportedFormatError('EOF');
            const _trackId = readUInt32BE();
            await skip(8); // reserved, duration
          }

          await skip(8 + 2 + 2 + 2 + 2 + 36); // various fields

          if (!(await ensureBytes(8))) throw new UnsupportedFormatError('EOF');
          const width = readUInt32BE() / 65536;
          const height = readUInt32BE() / 65536;

          if (currentTrack) {
            currentTrack.width = width;
            currentTrack.height = height;
          }

          const parsedSoFar = offset - atomStart;
          if (parsedSoFar < atomSize) await skip(atomSize - parsedSoFar);
          break;
        }

        case ATOM_MDHD: {
          if (!(await ensureBytes(1))) throw new UnsupportedFormatError('EOF');
          const version = readUInt8();
          await skip(3); // flags

          let timeScale = 0;
          let duration = 0;

          if (version === 1) {
            await skip(16);
            if (!(await ensureBytes(12))) throw new UnsupportedFormatError('EOF');
            timeScale = readUInt32BE();
            const durHigh = readUInt32BE();
            const durLow = readUInt32BE();
            duration = durHigh * 0x100000000 + durLow;
          } else {
            await skip(8);
            if (!(await ensureBytes(8))) throw new UnsupportedFormatError('EOF');
            timeScale = readUInt32BE();
            duration = readUInt32BE();
          }

          if (currentTrack) {
            currentTrack.timeScale = timeScale;
            currentTrack.duration = timeScale > 0 ? duration / timeScale : 0;
          }

          const parsedSoFar = offset - atomStart;
          if (parsedSoFar < atomSize) await skip(atomSize - parsedSoFar);
          break;
        }

        case ATOM_HDLR: {
          await skip(8); // version/flags, pre_defined
          if (!(await ensureBytes(4))) throw new UnsupportedFormatError('EOF');
          const handlerType = readString(4);

          if (currentTrack) {
            if (handlerType === 'vide') currentTrack.type = 'video';
            else if (handlerType === 'soun') currentTrack.type = 'audio';
          }

          const parsedSoFar = offset - atomStart;
          if (parsedSoFar < atomSize) await skip(atomSize - parsedSoFar);
          break;
        }

        case ATOM_MDIA:
        case ATOM_MINF:
        case ATOM_STBL: {
          // Container atoms, do nothing, loop proceeds to children
          break;
        }

        case ATOM_STTS: {
          if (currentTrack && options?.onSamples) {
            await skip(4); // version, flags
            if (!(await ensureBytes(4))) throw new UnsupportedFormatError('EOF');
            const count = readUInt32BE();
            currentTrack.stts = [];
            for (let i = 0; i < count; i++) {
              if (await ensureBytes(8)) {
                currentTrack.stts.push({
                  count: readUInt32BE(),
                  delta: readUInt32BE(),
                });
              }
            }
          }
          const parsedSoFar = offset - atomStart;
          if (parsedSoFar < atomSize) await skip(atomSize - parsedSoFar);
          break;
        }

        case ATOM_STSC: {
          if (currentTrack && options?.onSamples) {
            await skip(4); // version, flags
            if (!(await ensureBytes(4))) throw new UnsupportedFormatError('EOF');
            const count = readUInt32BE();
            currentTrack.stsc = [];
            for (let i = 0; i < count; i++) {
              if (await ensureBytes(12)) {
                currentTrack.stsc.push({
                  firstChunk: readUInt32BE(),
                  samplesPerChunk: readUInt32BE(),
                  sampleDescriptionIndex: readUInt32BE(),
                });
              }
            }
          }
          const parsedSoFar = offset - atomStart;
          if (parsedSoFar < atomSize) await skip(atomSize - parsedSoFar);
          break;
        }

        case ATOM_STSZ: {
          if (currentTrack && options?.onSamples) {
            await skip(4); // version, flags
            if (!(await ensureBytes(8))) throw new UnsupportedFormatError('EOF');
            const sampleSize = readUInt32BE();
            const sampleCount = readUInt32BE();
            currentTrack.stsz = { sampleSize, sampleCount, entries: [] };
            if (sampleSize === 0) {
              for (let i = 0; i < sampleCount; i++) {
                if (await ensureBytes(4)) {
                  currentTrack.stsz.entries.push(readUInt32BE());
                }
              }
            }
          }
          const parsedSoFar = offset - atomStart;
          if (parsedSoFar < atomSize) await skip(atomSize - parsedSoFar);
          break;
        }

        case ATOM_STCO: {
          if (currentTrack && options?.onSamples) {
            await skip(4); // version, flags
            if (!(await ensureBytes(4))) throw new UnsupportedFormatError('EOF');
            const count = readUInt32BE();
            currentTrack.stco = [];
            for (let i = 0; i < count; i++) {
              if (await ensureBytes(4)) {
                currentTrack.stco.push(readUInt32BE());
              }
            }
          }
          const parsedSoFar = offset - atomStart;
          if (parsedSoFar < atomSize) await skip(atomSize - parsedSoFar);
          break;
        }

        case ATOM_CO64: {
          if (currentTrack && options?.onSamples) {
            await skip(4); // version, flags
            if (!(await ensureBytes(4))) throw new UnsupportedFormatError('EOF');
            const count = readUInt32BE();
            currentTrack.co64 = [];
            for (let i = 0; i < count; i++) {
              if (await ensureBytes(8)) {
                const high = readUInt32BE();
                const low = readUInt32BE();
                currentTrack.co64.push(high * 0x100000000 + low);
              }
            }
          }
          const parsedSoFar = offset - atomStart;
          if (parsedSoFar < atomSize) await skip(atomSize - parsedSoFar);
          break;
        }

        case ATOM_STSD: {
          await skip(4); // version/flags
          if (!(await ensureBytes(4))) throw new UnsupportedFormatError('EOF');
          const entryCount = readUInt32BE();

          for (let i = 0; i < entryCount; i++) {
            if (!(await ensureBytes(8))) throw new UnsupportedFormatError('EOF');
            const entryStart = offset;
            const entrySize = readUInt32BE();
            const format = readString(4);

            await skip(6); // reserved
            await skip(2); // data_reference_index

            if (currentTrack?.type === 'video') {
              const videoCodec = findVideoCodec(format);
              currentTrack.codec = videoCodec ? videoCodec.code : format;
              currentTrack.codecDetail = format;
              await skip(16); // pre_defined, reserved, pre_defined
              if (!(await ensureBytes(4))) throw new UnsupportedFormatError('EOF');
              const width = readUInt16BE();
              const height = readUInt16BE();

              if (!currentTrack.width) currentTrack.width = width;
              if (!currentTrack.height) currentTrack.height = height;
            } else if (currentTrack?.type === 'audio') {
              let detailedFormat = format;
              await skip(8); // reserved
              if (!(await ensureBytes(12))) throw new UnsupportedFormatError('EOF'); // channel(2), size(2), pre(2), res(2), rate(4)
              const channelCount = readUInt16BE();
              const _sampleSize = readUInt16BE();
              await skip(4); // pre_defined, reserved
              const sampleRate = readUInt32BE() / 65536;

              currentTrack.channelCount = channelCount;
              currentTrack.sampleRate = sampleRate;

              // Parse children for esds
              const consumed = offset - entryStart;
              let remainingInMp4a = entrySize - consumed;

              while (remainingInMp4a >= 8) {
                if (!(await ensureBytes(8))) break;
                const subAtomStart = offset;
                const subAtomSize = readUInt32BE();
                const subAtomType = readString(4);

                if (subAtomSize < 8 || subAtomSize > remainingInMp4a) break;

                if (subAtomType === ATOM_ESDS) {
                  await skip(4); // version/flags

                  const readDescriptorHeader = (): { tag: number; length: number; headerSize: number } => {
                    const tag = readUInt8();
                    let length = 0;
                    let headerSize = 1;
                    let byte = readUInt8();
                    headerSize++;
                    while (byte & 0x80) {
                      length = (length << 7) | (byte & 0x7f);
                      byte = readUInt8();
                      headerSize++;
                    }
                    length = (length << 7) | (byte & 0x7f);
                    return { tag, length, headerSize };
                  };

                  if (await ensureBytes(20)) {
                    //... esds box data ...
                    // 03 (TAG 03 - Object Descriptor)
                    //   [length of data]
                    //   [ES_ID]
                    //   04 (TAG 04 - ES Descriptor)
                    //     [length of data]
                    //     [Codec type/stream type info, bitrates, etc.]
                    //     05 (TAG 05 - Audio Specific Config / Decoder Config Descriptor)
                    //       [length of data]
                    //       [Specific config data like sample rate, channels for AAC]
                    //     06 (TAG 06 - SL Config Descriptor)
                    //       ...
                    const esDesc = readDescriptorHeader();
                    if (esDesc.tag === 0x03) {
                      // Object Descriptor
                      await skip(2); // ES_ID
                      const flags = readUInt8();
                      if (flags & 0x80) await skip(2);
                      if (flags & 0x40) {
                        const urlLen = readUInt8();
                        await skip(urlLen);
                      }
                      if (flags & 0x20) await skip(2);

                      const decConfig = readDescriptorHeader();
                      if (decConfig.tag === 0x04) {
                        // ES Descriptor
                        const objectTypeIndication = readUInt8();
                        detailedFormat += `.${toHexString(objectTypeIndication)}`;
                        await skip(decConfig.length - 1);
                      } else {
                        await skip(decConfig.length);
                      }
                    } else {
                      await skip(esDesc.length);
                    }
                  }
                }

                const parsedSubAtom = offset - subAtomStart;
                if (parsedSubAtom < subAtomSize) {
                  await skip(subAtomSize - parsedSubAtom);
                }
                remainingInMp4a -= subAtomSize;
              }
              const audioCodec = findAudioCodec(detailedFormat);
              currentTrack.codec = audioCodec ? audioCodec.code : detailedFormat;
              currentTrack.codecDetail = detailedFormat;
            }

            const parsedEntry = offset - entryStart;
            await skip(entrySize - parsedEntry);
          }

          const parsedSoFar = offset - atomStart;
          if (parsedSoFar < atomSize) await skip(atomSize - parsedSoFar);
          break;
        }

        case ATOM_MVHD: {
          if (!(await ensureBytes(1))) throw new UnsupportedFormatError('EOF');
          const version = readUInt8();
          await skip(3); // flags

          let timeScale = 0;
          let duration = 0;

          if (version === 1) {
            await skip(16);
            if (!(await ensureBytes(12))) throw new UnsupportedFormatError('EOF');
            timeScale = readUInt32BE();
            const durHigh = readUInt32BE();
            const durLow = readUInt32BE();
            duration = durHigh * 0x100000000 + durLow;
          } else {
            await skip(8);
            if (!(await ensureBytes(8))) throw new UnsupportedFormatError('EOF');
            timeScale = readUInt32BE();
            duration = readUInt32BE();
          }

          if (timeScale > 0) mediaInfo.durationInSeconds = duration / timeScale;

          const parsedSoFar = offset - atomStart;
          if (parsedSoFar < atomSize) await skip(atomSize - parsedSoFar);
          break;
        }

        default: {
          // Unknown atom, just skip
          const parsedSoFar = offset - atomStart;
          if (atomSize === Infinity) {
            await skip(Infinity);
          } else {
            const remaining = atomSize - parsedSoFar;
            if (remaining > 0) {
              await skip(remaining);
            }
          }
          break;
        }
      }
    }

    // Process tracks into mediaInfo
    mediaInfo.videoStreams = tracks
      .filter((t) => t.type === 'video')
      .map((t) => ({
        id: t.id,
        codec: t.codec as any,
        codecDetail: t.codecDetail,
        width: t.width || 0,
        height: t.height || 0,
        durationInSeconds: t.duration || mediaInfo.durationInSeconds,
      }));

    mediaInfo.audioStreams = tracks
      .filter((t) => t.type === 'audio')
      .map((t) => ({
        id: t.id,
        codec: t.codec as any,
        codecDetail: t.codecDetail,
        channelCount: t.channelCount || 0,
        sampleRate: t.sampleRate || 0,
        durationInSeconds: t.duration || mediaInfo.durationInSeconds,
      }));

    return mediaInfo;
  } catch (error) {
    if (reader) reader.releaseLock();
    throw error;
  }
}
