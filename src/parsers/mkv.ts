import { GetMediaInfoOptions } from '../get-media-info';
import { AudioCodecType, AudioStreamInfo, findAudioCodec, findVideoCodec, MediaInfo, VideoCodecType, VideoStreamInfo } from '../media-info';
import { UnsupportedFormatError } from '../utils';

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

interface TrackInfo {
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
  private offset = 0;
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

  public onReady?: (info: MediaInfo) => void;
  public onSamples?: (trackId: number, user: any, samples: MkvSample[]) => void;

  appendBuffer(data: ArrayBuffer) {
    const newBuffer = new Uint8Array(this.buffer.length + data.byteLength);
    newBuffer.set(this.buffer);
    newBuffer.set(new Uint8Array(data), this.buffer.length);
    this.buffer = newBuffer;

    this.parse();
  }

  private parse() {
    if (this.offset === 0 && (this.buffer.length < 4 || this.readUInt(this.buffer.slice(0, 4)) !== EBML_ID)) {
      throw new UnsupportedFormatError('Not Matroska/WebM: The first four bytes does not look like EBML identifier');
    }
    while (this.offset < this.buffer.length) {
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
        const { value: id, length } = this.readId(this.offset);
        if (!id) return; // Need more data
        this.currentElementId = id;
        this.offset += length;
        this.state = 'SIZE';
      }

      if (this.state === 'SIZE') {
        const { value: size, length } = this.readVint(this.offset);
        if (size === undefined) return; // Need more data
        this.currentElementSize = size;
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
          continue;
        }

        // Check if we have enough data for the content
        if (this.offset + this.currentElementSize > this.buffer.length) {
          return; // Need more data
        }

        const data = this.buffer.subarray(this.offset, this.offset + this.currentElementSize);
        this.processElement(this.currentElementId, data);
        this.offset += this.currentElementSize;

        this.state = 'ID';
      }
    }
  }

  private readId(offset: number): { value?: number; length: number } {
    const { length } = this.readVint(offset);
    if (length === 0) return { length: 0 };

    let value = 0;
    for (let i = 0; i < length; i++) {
      value = value * 256 + this.buffer[offset + i];
    }
    return { value, length };
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

    // Check if we have enough info to trigger onReady
    if (!this.isReady && this.tracks.size > 0 && this.duration > 0) {
      // We trigger onReady when we encounter the first Cluster or SimpleBlock,
      // assuming all tracks have been parsed by then (Tracks element comes before Clusters).
    }

    if ((id === CLUSTER_ID || id === SIMPLE_BLOCK_ID) && !this.isReady) {
      this.emitReady();
    }
  }

  private currentTrack: Partial<TrackInfo> = {};

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

    // const flags = data[offset];
    offset += 1;

    const isKeyframe = (data[offset - 1] & 0x80) !== 0;

    const sampleData = data.subarray(offset);

    // timecode is int16 (signed) relative to cluster time
    const relTime = (timecode << 16) >> 16;
    const absTime = ((this.currentClusterTime + relTime) * this.timecodeScale) / 1000000000; // seconds

    if (this.onSamples && trackId !== undefined) {
      this.onSamples(trackId, null, [
        {
          trackId,
          data: sampleData,
          isKeyframe,
          time: absTime,
        },
      ]);
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
      this.onSamples(trackId, null, [
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
    if (this.onReady) {
      const audioStreams: AudioStreamInfo[] = [];
      const videoStreams: VideoStreamInfo[] = [];

      this.tracks.forEach((track) => {
        if (track.type === 2 && track.audio) {
          audioStreams.push({
            id: track.number,
            codec: this.mapCodec(track.codecId, track.audio.bitDepth) as any,
            codecDetail: track.codecId,
            sampleRate: track.audio.samplingFrequency,
            channelCount: track.audio.channels,
            bitsPerSample: track.audio.bitDepth,
            durationInSeconds: (this.duration * this.timecodeScale) / 1000000000,
          });
        } else if (track.type === 1 && track.video) {
          videoStreams.push({
            id: track.number,
            codec: this.mapCodec(track.codecId) as any,
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
      this.onReady({
        container: this.docType === 'matroska' ? 'mkv' : this.docType,
        containerDetail: this.docType,
        durationInSeconds: (this.duration * this.timecodeScale) / 1000000000,
        audioStreams,
        videoStreams,
        parser: 'media-utils',
      } as MediaInfo);
    }
  }

  private mapCodec(codecId: string, bitDepth?: number): AudioCodecType | VideoCodecType {
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
      default: {
        throw new UnsupportedFormatError(`Unsupported codec in Mkv/Webm: ${codecId}`);
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
 * @param _options Optional options for the parser
 * @returns Media information without the parser field
 */
export async function parseMkv(stream: ReadableStream<Uint8Array>, _options?: GetMediaInfoOptions): Promise<Omit<MediaInfo, 'parser'>> {
  const parser = new MkvParser();

  return new Promise((resolve, reject) => {
    let infoFound = false;

    parser.onReady = (info) => {
      infoFound = true;
      resolve(info);
      // We can stop reading here if we only want metadata
    };

    const reader = stream.getReader();

    function readChunk() {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            if (!infoFound) {
              reject(new UnsupportedFormatError('Stream ended before MKV/WebM info was found'));
            }
            return;
          }

          if (value) {
            parser.appendBuffer(value.buffer as ArrayBuffer);
            if (infoFound) {
              reader.cancel();
            } else {
              readChunk();
            }
          }
        })
        .catch(reject);
    }

    readChunk();
  });
}
