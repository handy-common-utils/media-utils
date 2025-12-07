import { GetMediaInfoOptions } from '../get-media-info';
import { AudioCodecType, AudioStreamInfo, findAudioCodec, findVideoCodec, MediaInfo, VideoCodecType, VideoStreamInfo } from '../media-info';
import { ensureBufferData, setupGlobalLogger, UnsupportedFormatError } from '../utils';

// EBML Element IDs
const EBML_ID = 0x1a45dfa3;
const DOCTYPE_ID = 0x4282;
const SEGMENT_ID = 0x18538067;
const INFO_ID = 0x1549a966;
const TIMECODE_SCALE_ID = 0x2ad7b1;
const DURATION_ID = 0x4489;
const TRACKS_ID = 0x1654ae6b;
const TRACK_ENTRY_ID = 0xae;
const TRACK_NUMBER_ID = 0xd7;
const TRACK_TYPE_ID = 0x83;
const CODEC_ID_ID = 0x86;
const CODEC_PRIVATE_ID = 0x63a2;
const AUDIO_ID = 0xe1;
const SAMPLING_FREQUENCY_ID = 0xb5;
const CHANNELS_ID = 0x9f;
const BIT_DEPTH_ID = 0x6264;
const VIDEO_ID = 0xe0;
const PIXEL_WIDTH_ID = 0xb0;
const PIXEL_HEIGHT_ID = 0xba;
const CLUSTER_ID = 0x1f43b675;
const TIMECODE_ID = 0xe7;
const SIMPLE_BLOCK_ID = 0xa3;
const BLOCK_GROUP_ID = 0xa0;
const BLOCK_ID = 0xa1;

export interface TrackInfo {
  number: number;
  type: number; // 1=video, 2=audio
  codecId: string;
  codecPrivate?: Uint8Array;
  audio?: {
    samplingFrequency: number;
    channels: number;
    bitDepth?: number;
  };
  video?: {
    width: number;
    height: number;
  };
}

export interface MkvSample {
  trackId: number;
  data: Uint8Array;
  isKeyframe: boolean;
  time: number; // in seconds
  duration?: number; // in seconds
}

export class MkvParser {
  private buffer: Uint8Array = new Uint8Array(0);
  private bufferOffset = 0;
  private offset = 0;
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private state: 'ID' | 'SIZE' | 'CONTENT' = 'ID';
  private currentElementId = 0;
  private currentElementSize = 0;
  private elementStack: { id: number; end: number }[] = [];

  private timecodeScale = 1000000; // Default 1ms
  private duration = 0;
  private tracks: Map<number, TrackInfo> = new Map();
  private currentClusterTime = 0;
  private docType: string | undefined;

  private isReady = false;
  private generatedMediaInfo?: Omit<MediaInfo, 'parser'>;

  private currentTrack: Partial<TrackInfo> = {};

  constructor(
    stream: ReadableStream<Uint8Array>,
    private options?: GetMediaInfoOptions,
    private onSamples?: (trackId: number, samples: MkvSample[]) => void,
  ) {
    this.reader = stream.getReader();
  }

  async parse(): Promise<Omit<MediaInfo, 'parser'>> {
    const logger = setupGlobalLogger(this.options);
    if (logger.isDebug) logger.debug('Starting parsing MKV/WebM');
    let requiredSize = 64 * 1024;
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Memory management: keep buffer size reasonable
        const { buffer, bufferOffset, done } = await ensureBufferData(this.reader, this.buffer, this.bufferOffset, requiredSize);
        this.buffer = buffer;
        this.bufferOffset = bufferOffset;

        if (done && this.bufferOffset >= this.buffer.length) {
          break; // End of stream and no more data to process
        }

        // Check if we have enough data for the first 4 bytes (EBML ID)
        if (this.offset === 0) {
          if (this.buffer.length - this.bufferOffset < 4) continue; // Need more data
          if (this.readUInt(this.buffer.subarray(this.bufferOffset, this.bufferOffset + 4)) !== EBML_ID) {
            throw new UnsupportedFormatError('Not Matroska/WebM: The first four bytes does not look like EBML identifier');
          }
        }

        // Check if we reached the end of current container element
        if (this.elementStack.length > 0) {
          // eslint-disable-next-line unicorn/prefer-at
          const currentContainer = this.elementStack[this.elementStack.length - 1];
          if (this.offset >= currentContainer.end) {
            this.elementStack.pop();

            if (currentContainer.id === TRACK_ENTRY_ID && this.currentTrack.number !== undefined) {
              this.tracks.set(this.currentTrack.number, this.currentTrack as TrackInfo);
            }

            continue;
          }
        }

        if (this.state === 'ID') {
          const { value: id, length } = this.readId(this.bufferOffset);
          if (!id) {
            if (this.buffer.length - this.bufferOffset < 10) continue; // Heuristic: wait for more data if we can't read ID
            // If we really can't read ID even with enough data (unlikely unless EOF), break
            break;
          }
          this.currentElementId = id;
          this.bufferOffset += length;
          this.offset += length;
          this.state = 'SIZE';
        }

        if (this.state === 'SIZE') {
          // 0xFF means unknown size which is usd for live streaming.
          // We should stop parsing in this case.
          if (this.buffer[this.bufferOffset] === 0xff) {
            this.emitReady();
            break;
          }
          const { value: size, length } = this.readVint(this.bufferOffset);
          if (size === undefined) {
            if (this.buffer.length - this.bufferOffset < 10) continue;
            break;
          }
          this.currentElementSize = size;
          this.bufferOffset += length;
          this.offset += length;
          this.state = 'CONTENT';
        }

        if (this.state === 'CONTENT') {
          // Handle Master Elements (containers)
          if (this.isMasterElement(this.currentElementId)) {
            this.elementStack.push({
              id: this.currentElementId,
              end: this.offset + this.currentElementSize,
            });

            // Initialize track info when entering TrackEntry
            if (this.currentElementId === TRACK_ENTRY_ID) {
              this.currentTrack = {};
            }

            this.state = 'ID';
            requiredSize = 64 * 1024;
            continue;
          }

          // Check if we have enough data for the content
          if (this.buffer.length - this.bufferOffset < this.currentElementSize) {
            if (done) {
              throw new UnsupportedFormatError('Unexpected EOF: Element size larger than remaining data');
            }
            requiredSize = this.currentElementSize;
            continue;
          }

          const data = this.buffer.subarray(this.bufferOffset, this.bufferOffset + this.currentElementSize);
          this.processElement(this.currentElementId, data);
          this.bufferOffset += this.currentElementSize;
          this.offset += this.currentElementSize;

          this.state = 'ID';
          requiredSize = 64 * 1024;
        }

        // Check if we are done parsing metadata
        if (this.isReady && !this.onSamples && this.generatedMediaInfo) {
          return this.generatedMediaInfo;
        }
      }
    } finally {
      // Ensure reader is cancelled if we exit early
      if (!this.onSamples && this.isReady) {
        this.reader.cancel().catch(() => {});
      }
    }

    if (this.generatedMediaInfo) {
      return this.generatedMediaInfo;
    }

    throw new UnsupportedFormatError('Stream ended before MKV/WebM info was found');
  }

  private readId(offset: number): { value?: number; length: number } {
    const { length: vintLength } = this.readVint(offset); // Just to get length
    if (vintLength === 0) return { length: 0 };

    let idValue = 0;
    for (let i = 0; i < vintLength; i++) {
      idValue = idValue * 256 + this.buffer[offset + i];
    }
    return { value: idValue, length: vintLength };
  }

  private readVint(offset: number): { value?: number; length: number } {
    if (offset >= this.buffer.length) return { length: 0 };

    const byte = this.buffer[offset];
    let width = 0;
    let mask = 0;

    if (byte >= 0x80) {
      width = 1;
      mask = 0x7f;
    } else if (byte >= 0x40) {
      width = 2;
      mask = 0x3f;
    } else if (byte >= 0x20) {
      width = 3;
      mask = 0x1f;
    } else if (byte >= 0x10) {
      width = 4;
      mask = 0x0f;
    } else if (byte >= 0x08) {
      width = 5;
      mask = 0x07;
    } else if (byte >= 0x04) {
      width = 6;
      mask = 0x03;
    } else if (byte >= 0x02) {
      width = 7;
      mask = 0x01;
    } else if (byte >= 0x01) {
      width = 8;
      mask = 0x00;
    } else return { length: 0 }; // Invalid VINT

    if (offset + width > this.buffer.length) return { length: 0 };

    let value = byte & mask;
    for (let i = 1; i < width; i++) {
      value = value * 256 + this.buffer[offset + i];
    }

    return { value, length: width };
  }

  private isMasterElement(id: number): boolean {
    return [EBML_ID, SEGMENT_ID, INFO_ID, TRACKS_ID, TRACK_ENTRY_ID, VIDEO_ID, AUDIO_ID, CLUSTER_ID, BLOCK_GROUP_ID].includes(id);
  }

  private processElement(id: number, data: Uint8Array) {
    switch (id) {
      case DOCTYPE_ID: {
        const docType = this.readString(data);
        if (docType !== 'webm' && docType !== 'matroska') {
          throw new UnsupportedFormatError(`Not Matroska/WebM: DocType is '${docType}'`);
        }
        this.docType = docType;
        break;
      }
      case TIMECODE_SCALE_ID: {
        this.timecodeScale = this.readUInt(data);
        break;
      }
      case DURATION_ID: {
        this.duration = this.readFloat(data);
        break;
      }
      case TRACK_NUMBER_ID: {
        this.getCurrentTrack().number = this.readUInt(data);
        break;
      }
      case TRACK_TYPE_ID: {
        this.getCurrentTrack().type = this.readUInt(data);
        break;
      }
      case CODEC_ID_ID: {
        this.getCurrentTrack().codecId = this.readString(data);
        break;
      }
      case CODEC_PRIVATE_ID: {
        this.getCurrentTrack().codecPrivate = new Uint8Array(data);
        break;
      }
      case SAMPLING_FREQUENCY_ID: {
        this.getAudioTrack().samplingFrequency = this.readFloat(data);
        break;
      }
      case CHANNELS_ID: {
        this.getAudioTrack().channels = this.readUInt(data);
        break;
      }
      case BIT_DEPTH_ID: {
        this.getAudioTrack().bitDepth = this.readUInt(data);
        break;
      }
      case PIXEL_WIDTH_ID: {
        this.getVideoTrack().width = this.readUInt(data);
        break;
      }
      case PIXEL_HEIGHT_ID: {
        this.getVideoTrack().height = this.readUInt(data);
        break;
      }
      case TIMECODE_ID: {
        this.currentClusterTime = this.readUInt(data);
        break;
      }
      case SIMPLE_BLOCK_ID: {
        this.processSimpleBlock(data);
        break;
      }
      case BLOCK_ID: {
        this.processBlock(data);
        break;
      }
    }

    if ((id === CLUSTER_ID || id === SIMPLE_BLOCK_ID) && !this.isReady) {
      this.emitReady();
    }
  }

  private getCurrentTrack(): Partial<TrackInfo> {
    return this.currentTrack;
  }

  private readUInt(data: Uint8Array): number {
    let value = 0;
    for (const byte of data) {
      value = value * 256 + byte;
    }
    return value;
  }

  private readFloat(data: Uint8Array): number {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (data.length === 4) return view.getFloat32(0);
    if (data.length === 8) return view.getFloat64(0);
    return 0;
  }

  private readString(data: Uint8Array): string {
    // Remove null terminators if any
    let end = data.length;
    while (end > 0 && data[end - 1] === 0) {
      end--;
    }
    return new TextDecoder().decode(data.subarray(0, end));
  }

  private processSimpleBlock(data: Uint8Array) {
    let offset = 0;
    const trackNumInfo = this.readVintFromBuffer(data, offset);
    offset += trackNumInfo.length;
    const trackId = trackNumInfo.value;

    const timecode = (data[offset] << 8) | data[offset + 1];
    offset += 2;

    // Flags byte:
    // Bit 7: Keyframe (1 = keyframe, 0 = not keyframe)
    // Bit 6-4: Reserved (0)
    // Bit 3: Invisible (1 = invisible, 0 = visible)
    // Bit 2-1: Lacing (00 = no lacing, 01 = Xiph, 11 = EBML, 10 = fixed-size)
    // Bit 0: Discardable
    const flags = data[offset];
    offset += 1;

    const isKeyframe = (flags & 0x80) !== 0;
    const lacing = (flags >> 1) & 0x03;

    // timecode is int16 (signed) relative to cluster time
    const relTime = (timecode << 16) >> 16;
    const absTime = ((this.currentClusterTime + relTime) * this.timecodeScale) / 1000000000; // seconds

    if (this.onSamples && trackId !== undefined) {
      const frames: Uint8Array[] = [];

      if (lacing === 0) {
        // No lacing
        frames.push(data.subarray(offset));
      } else {
        const numFrames = data[offset] + 1;
        offset++;
        const sizes: number[] = [];

        switch (lacing) {
          case 1: {
            // Xiph lacing
            for (let i = 0; i < numFrames - 1; i++) {
              let size = 0;
              while (data[offset] === 255) {
                size += 255;
                offset++;
              }
              size += data[offset];
              offset++;
              sizes.push(size);
            }
            break;
          }
          case 3: {
            // EBML lacing
            const firstSize = this.readVintFromBuffer(data, offset);
            offset += firstSize.length;
            sizes.push(firstSize.value);
            let lastSize = firstSize.value;

            for (let i = 1; i < numFrames - 1; i++) {
              const diff = this.readVintFromBuffer(data, offset);
              offset += diff.length;

              // Decode signed VINT for difference
              const range = 2 ** (diff.length * 7 - 1) - 1;
              const difference = diff.value - range;

              lastSize += difference;
              sizes.push(lastSize);
            }
            break;
          }
          case 2: {
            // Fixed-size lacing
            const remaining = data.length - offset;
            const size = remaining / numFrames;
            for (let i = 0; i < numFrames - 1; i++) {
              sizes.push(size);
            }
            break;
          }
        }

        for (const size of sizes) {
          frames.push(data.subarray(offset, offset + size));
          offset += size;
        }
        frames.push(data.subarray(offset));
      }

      this.onSamples(
        trackId,
        frames.map((frameData) => ({
          trackId,
          data: frameData,
          isKeyframe,
          time: absTime,
        })),
      );
    }
  }

  private processBlock(data: Uint8Array) {
    let offset = 0;
    const trackNumInfo = this.readVintFromBuffer(data, offset);
    offset += trackNumInfo.length;
    const trackId = trackNumInfo.value;

    const timecode = (data[offset] << 8) | data[offset + 1];
    offset += 2;

    // const flags = data[offset];
    offset += 1;

    // Block does not have keyframe flag in the same way as SimpleBlock
    // For now assume true or TODO
    const isKeyframe = true;

    const sampleData = data.subarray(offset);

    const relTime = (timecode << 16) >> 16;
    const absTime = ((this.currentClusterTime + relTime) * this.timecodeScale) / 1000000000;

    if (this.onSamples && trackId !== undefined) {
      this.onSamples(trackId, [
        {
          trackId,
          data: sampleData,
          isKeyframe,
          time: absTime,
        },
      ]);
    }
  }

  private readVintFromBuffer(buffer: Uint8Array, offset: number): { value: number; length: number } {
    const byte = buffer[offset];
    let width = 0;
    let mask = 0;

    if (byte >= 0x80) {
      width = 1;
      mask = 0x7f;
    } else if (byte >= 0x40) {
      width = 2;
      mask = 0x3f;
    } else if (byte >= 0x20) {
      width = 3;
      mask = 0x1f;
    } else if (byte >= 0x10) {
      width = 4;
      mask = 0x0f;
    } else if (byte >= 0x08) {
      width = 5;
      mask = 0x07;
    } else if (byte >= 0x04) {
      width = 6;
      mask = 0x03;
    } else if (byte >= 0x02) {
      width = 7;
      mask = 0x01;
    } else if (byte >= 0x01) {
      width = 8;
      mask = 0x00;
    } else return { value: 0, length: 0 };

    let value = byte & mask;
    for (let i = 1; i < width; i++) {
      value = value * 256 + buffer[offset + i];
    }

    return { value, length: width };
  }

  private emitReady() {
    this.isReady = true;

    const audioStreams: AudioStreamInfo[] = [];
    const videoStreams: VideoStreamInfo[] = [];

    this.tracks.forEach((track) => {
      if (track.type === 2 && track.audio) {
        // Extract codec-specific metadata from CodecPrivate
        const codecMetadata = this.extractAudioCodecMetadata(track.codecId, track.codecPrivate, track.audio);

        audioStreams.push({
          id: track.number,
          codec: this.mapCodec(track.codecId, track.audio.bitDepth) as any,
          codecDetail: track.codecId,
          sampleRate: codecMetadata.sampleRate ?? track.audio.samplingFrequency,
          channelCount: codecMetadata.channelCount ?? track.audio.channels,
          bitsPerSample: codecMetadata.bitsPerSample ?? track.audio.bitDepth,
          bitrate: codecMetadata.bitrate,
          durationInSeconds: (this.duration * this.timecodeScale) / 1000000000,
        });
      } else if (track.type === 1 && track.video) {
        videoStreams.push({
          id: track.number,
          codec: this.mapCodec(track.codecId, undefined, track.codecPrivate) as any,
          codecDetail: track.codecId,
          width: track.video.width,
          height: track.video.height,
          durationInSeconds: (this.duration * this.timecodeScale) / 1000000000,
        });
      }
    });

    if (!this.docType) {
      throw new UnsupportedFormatError('Not Matroska/WebM: DocType not found');
    }

    this.generatedMediaInfo = {
      container: this.docType === 'matroska' ? 'mkv' : (this.docType as any),
      containerDetail: this.docType,
      durationInSeconds: (this.duration * this.timecodeScale) / 1000000000,
      audioStreams,
      videoStreams,
    };
  }

  /**
   * Extract codec-specific metadata from CodecPrivate
   * Different codecs store different information in CodecPrivate
   * @param codecId The codec identifier string
   * @param codecPrivate The CodecPrivate data from the track
   * @param audioInfo Basic audio information from the track
   * @param audioInfo.samplingFrequency The sampling frequency of the audio
   * @param audioInfo.channels The number of channels in the audio
   * @param audioInfo.bitDepth The bit depth of the audio
   * @returns Extracted codec metadata including bitrate, sample rate, etc.
   */
  private extractAudioCodecMetadata(
    codecId: string,
    codecPrivate: Uint8Array | undefined,
    audioInfo: { samplingFrequency: number; channels: number; bitDepth?: number },
  ): {
    sampleRate?: number;
    channelCount?: number;
    bitsPerSample?: number;
    bitrate?: number;
  } {
    const result: {
      sampleRate?: number;
      channelCount?: number;
      bitsPerSample?: number;
      bitrate?: number;
    } = {};

    if (!codecPrivate || codecPrivate.length === 0) {
      return result;
    }

    try {
      switch (codecId) {
        case 'A_VORBIS': {
          // Vorbis stores 3 header packets in CodecPrivate
          // Format: [num_packets(1)] [size1(varint)] [size2(varint)] [packet1] [packet2] [packet3]
          // The identification header (packet1) contains bitrate info
          const numPackets = codecPrivate[0];
          if (numPackets >= 2) {
            let offset = 1;
            // Read lacing sizes for first two packets
            const sizes: number[] = [];
            for (let i = 0; i < numPackets - 1; i++) {
              let size = 0;
              while (offset < codecPrivate.length && codecPrivate[offset] === 255) {
                size += 255;
                offset++;
              }
              if (offset < codecPrivate.length) {
                size += codecPrivate[offset];
                offset++;
              }
              sizes.push(size);
            }

            // First packet is the identification header
            if (offset + 30 <= codecPrivate.length) {
              const idHeader = codecPrivate.subarray(offset, offset + sizes[0]);
              // Vorbis identification header structure:
              // 0: packet_type (1 byte) = 0x01
              // 1-6: "vorbis" (6 bytes)
              // 7-10: vorbis_version (4 bytes, little-endian)
              // 11: audio_channels (1 byte)
              // 12-15: audio_sample_rate (4 bytes, little-endian)
              // 16-19: bitrate_maximum (4 bytes, little-endian, signed)
              // 20-23: bitrate_nominal (4 bytes, little-endian, signed)
              // 24-27: bitrate_minimum (4 bytes, little-endian, signed)
              if (idHeader[0] === 0x01 && idHeader.length >= 28) {
                const view = new DataView(idHeader.buffer, idHeader.byteOffset, idHeader.byteLength);
                const nominalBitrate = view.getInt32(20, true); // little-endian
                if (nominalBitrate > 0) {
                  result.bitrate = nominalBitrate;
                }
              }
            }
          }
          break;
        }

        case 'A_OPUS': {
          // Opus CodecPrivate contains OpusHead
          // OpusHead structure:
          // 0-7: "OpusHead" (8 bytes)
          // 8: Version (1 byte)
          // 9: Channel Count (1 byte)
          // 10-11: Pre-skip (2 bytes, little-endian)
          // 12-15: Input Sample Rate (4 bytes, little-endian) - original sample rate, not 48kHz
          // 16-17: Output Gain (2 bytes, little-endian, signed)
          // 18: Channel Mapping Family (1 byte)
          if (codecPrivate.length >= 19) {
            const view = new DataView(codecPrivate.buffer, codecPrivate.byteOffset, codecPrivate.byteLength);
            const channelCount = codecPrivate[9];
            const inputSampleRate = view.getUint32(12, true);

            result.channelCount = channelCount;
            // Note: Opus always outputs at 48kHz, but we store the original sample rate for reference
            if (inputSampleRate > 0 && inputSampleRate !== 48000) {
              result.sampleRate = inputSampleRate;
            }
          }
          break;
        }

        case 'A_FLAC': {
          // FLAC CodecPrivate contains STREAMINFO block
          // STREAMINFO is 34 bytes and contains:
          // 0-1: min_blocksize (2 bytes, big-endian)
          // 2-3: max_blocksize (2 bytes, big-endian)
          // 4-6: min_framesize (3 bytes, big-endian)
          // 7-9: max_framesize (3 bytes, big-endian)
          // 10-17: sample_rate(20 bits) + channels(3 bits) + bits_per_sample(5 bits) + total_samples(36 bits)
          if (codecPrivate.length >= 18) {
            // Bytes 10-17 contain packed data
            const byte10 = codecPrivate[10];
            const byte11 = codecPrivate[11];
            const byte12 = codecPrivate[12];
            const byte13 = codecPrivate[13];

            // Sample rate: bits 0-19 of the 64-bit field (bytes 10-12, plus 4 bits of byte 13)
            const sampleRate = (byte10 << 12) | (byte11 << 4) | (byte12 >> 4);

            // Channels: bits 20-22 (3 bits from byte 12)
            const channels = ((byte12 & 0x0e) >> 1) + 1; // stored as channels-1

            // Bits per sample: bits 23-27 (5 bits from byte 12 and byte 13)
            const bitsPerSample = (((byte12 & 0x01) << 4) | (byte13 >> 4)) + 1; // stored as bps-1

            result.sampleRate = sampleRate;
            result.channelCount = channels;
            result.bitsPerSample = bitsPerSample;
          }
          break;
        }

        case 'A_MS/ACM':
        case 'A_ADPCM': {
          // MS ADPCM / IMA ADPCM in MKV stores WAVEFORMATEX in CodecPrivate
          // WAVEFORMATEX structure (little-endian):
          // 0-1: wFormatTag (2 bytes)
          // 2-3: nChannels (2 bytes)
          // 4-7: nSamplesPerSec (4 bytes)
          // 8-11: nAvgBytesPerSec (4 bytes)
          // 12-13: nBlockAlign (2 bytes)
          // 14-15: wBitsPerSample (2 bytes)
          // 16-17: cbSize (2 bytes) - size of extra format information
          if (codecPrivate.length >= 18) {
            const view = new DataView(codecPrivate.buffer, codecPrivate.byteOffset, codecPrivate.byteLength);
            const formatTag = view.getUint16(0, true);
            const channels = view.getUint16(2, true);
            const sampleRate = view.getUint32(4, true);
            const avgBytesPerSec = view.getUint32(8, true);
            const bitsPerSample = view.getUint16(14, true);

            result.channelCount = channels;
            result.sampleRate = sampleRate;
            result.bitrate = avgBytesPerSec * 8;

            // For ADPCM, bits per sample is typically 4 (implicit in the algorithm)
            // But if WAVEFORMATEX specifies it, use that value
            if (formatTag === 0x0002 || formatTag === 0x0011) {
              // MS ADPCM or IMA ADPCM
              result.bitsPerSample = 4; // ADPCM always uses 4 bits per sample
            } else if (bitsPerSample > 0) {
              result.bitsPerSample = bitsPerSample;
            }
          }
          break;
        }

        case 'A_PCM/INT/LIT':
        case 'A_PCM/INT/BIG': {
          // For PCM, bits per sample is stored in the Audio.BitDepth element
          // which is already in audioInfo.bitDepth
          // Bitrate can be calculated: sampleRate * channels * bitsPerSample
          if (audioInfo.bitDepth && audioInfo.samplingFrequency && audioInfo.channels) {
            result.bitrate = audioInfo.samplingFrequency * audioInfo.channels * audioInfo.bitDepth;
            result.bitsPerSample = audioInfo.bitDepth;
          }
          break;
        }

        // For MP3, AAC, and other codecs, we would need to parse the first frame
        // which is not available in CodecPrivate. This would require parsing actual data blocks.
        default: {
          break;
        }
      }
    } catch {
      // If parsing fails, just return what we have
      // Don't throw - better to have partial info than fail completely
    }

    return result;
  }

  private mapCodec(codecId: string, bitDepth?: number, codecPrivate?: Uint8Array): AudioCodecType | VideoCodecType {
    const videoCodec = findVideoCodec(codecId);
    if (videoCodec) return videoCodec.code;
    const audioCodec = findAudioCodec(codecId);
    if (audioCodec) return audioCodec.code;

    switch (codecId) {
      case 'A_PCM/INT/LIT': {
        switch (bitDepth) {
          case 8: {
            return 'pcm_u8';
          }
          case 16: {
            return 'pcm_s16le';
          }
          case 24: {
            return 'pcm_s24le';
          }
          case 32: {
            return 'pcm_s32le';
          }
          default: {
            throw new UnsupportedFormatError(`Unknown bit depth in Mkv/Webm: ${bitDepth}`);
          }
        }
      }
      case 'A_PCM/INT/BIG': {
        switch (bitDepth) {
          case 8: {
            return 'pcm_u8';
          }
          case 16: {
            return 'pcm_s16be';
          }
          case 24: {
            return 'pcm_s24be';
          }
          case 32: {
            return 'pcm_s32be';
          }
          default: {
            throw new UnsupportedFormatError(`Unknown bit depth in Mkv/Webm: ${bitDepth}`);
          }
        }
      }
      case 'V_MS/VFW/FOURCC': {
        if (codecPrivate && codecPrivate.length >= 40) {
          const view = new DataView(codecPrivate.buffer, codecPrivate.byteOffset, codecPrivate.byteLength);
          const biSize = view.getUint32(0, true);
          if (biSize === 40) {
            const biCompression = view.getUint32(16, true);
            // eslint-disable-next-line unicorn/prefer-code-point
            const fourCC = String.fromCharCode(
              biCompression & 0xff,
              (biCompression >> 8) & 0xff,
              (biCompression >> 16) & 0xff,
              (biCompression >> 24) & 0xff,
            );
            const codec = findVideoCodec(fourCC);
            return codec ? codec.code : (fourCC as any);
          }
        }
        throw new UnsupportedFormatError(`Unknown codec in Mkv/Webm: ${codecId}`);
      }
      default: {
        throw new UnsupportedFormatError(`Unknown codec in Mkv/Webm: ${codecId}`);
      }
    }
  }

  private getAudioTrack(): { samplingFrequency: number; channels: number; bitDepth?: number } {
    if (!this.currentTrack.audio) this.currentTrack.audio = { samplingFrequency: 0, channels: 0 };
    return this.currentTrack.audio;
  }

  private getVideoTrack(): { width: number; height: number } {
    if (!this.currentTrack.video) this.currentTrack.video = { width: 0, height: 0 };
    return this.currentTrack.video;
  }

  /**
   * Get track information by track number
   * @param trackNumber The track number to look up
   * @returns Track information or undefined if not found
   */
  getTrackInfo(trackNumber: number): TrackInfo | undefined {
    return this.tracks.get(trackNumber);
  }
}

/**
 * Parses MKV/WebM file from a stream and extracts media information.
 * @param stream The input media stream
 * @param options Optional options for the parser
 * @returns Media information without the parser field
 */
export async function parseMkv(stream: ReadableStream<Uint8Array>, options?: GetMediaInfoOptions): Promise<Omit<MediaInfo, 'parser'>> {
  const parser = new MkvParser(stream, options);
  return parser.parse();
}
