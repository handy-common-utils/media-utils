/* eslint-disable max-depth */
import { AudioCodecType, findVideoCodec, MediaInfo } from '../media-info';
import { ensureBufferData, UnsupportedFormatError } from '../utils';

interface AviMainHeader {
  microSecPerFrame: number;
  maxBytesPerSec: number;
  totalFrames: number;
  width: number;
  height: number;
  streams: number;
}

interface StreamHeader {
  type: string; // 'vids', 'auds', 'txts'
  codec: string; // FOURCC
  scale: number;
  rate: number;
  length: number;
  sampleSize: number;
}

interface VideoFormat {
  width: number;
  height: number;
  bitDepth: number;
  compression: string;
}

interface AudioFormat {
  formatTag: number;
  channels: number;
  samplesPerSec: number;
  avgBytesPerSec: number;
  blockAlign: number;
  bitsPerSample: number;
}

/**
 * Parse AVI (Audio Video Interleaved) files
 * AVI is built on RIFF (Resource Interchange File Format) structure
 * @param stream - The readable stream of the AVI file
 * @returns Promise resolving to MediaInfo
 */
export async function parseAvi(stream: ReadableStream<Uint8Array>): Promise<MediaInfo> {
  const reader = stream.getReader();
  let buffer: Uint8Array = new Uint8Array(0);
  let offset = 0;

  // Helper to ensure we have enough data
  async function ensureBytes(needed: number): Promise<boolean> {
    while (buffer.length - offset < needed) {
      const result = await ensureBufferData(reader, buffer, offset, needed);
      buffer = result.buffer;
      offset = result.bufferOffset;
      if (result.done) {
        return false;
      }
    }
    return true;
  }

  // Helper to read 4 bytes as string
  function read4CC(): string {
    // eslint-disable-next-line unicorn/prefer-code-point
    const fourCC = String.fromCharCode(buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]);
    offset += 4;
    return fourCC;
  }

  // Helper to read 4 bytes as little-endian uint32
  function readUInt32LE(): number {
    const value = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
    offset += 4;
    return value >>> 0; // Convert to unsigned
  }

  // Helper to read 2 bytes as little-endian uint16
  function readUInt16LE(): number {
    const value = buffer[offset] | (buffer[offset + 1] << 8);
    offset += 2;
    return value;
  }

  // Helper to skip bytes
  function skip(bytes: number): void {
    offset += bytes;
  }

  try {
    // Read RIFF header (need at least 12 bytes)
    if (!(await ensureBytes(12))) {
      throw new UnsupportedFormatError('Not enough data for RIFF header');
    }

    const riffSignature = read4CC();
    if (riffSignature !== 'RIFF') {
      throw new UnsupportedFormatError(`Not a RIFF file: ${riffSignature}`);
    }

    readUInt32LE(); // fileSize - not used
    const fileType = read4CC();

    if (fileType !== 'AVI ') {
      throw new UnsupportedFormatError(`Not an AVI file: ${fileType}`);
    }

    let aviHeader: AviMainHeader | null = null;
    const videoStreams: Array<{ header: StreamHeader; format: VideoFormat }> = [];
    const audioStreams: Array<{ header: StreamHeader; format: AudioFormat }> = [];

    // Parse chunks
    while (await ensureBytes(8)) {
      const chunkId = read4CC();
      const chunkSize = readUInt32LE();

      // Ensure we have the chunk data
      if (!(await ensureBytes(chunkSize))) {
        break; // End of readable data
      }

      const chunkStart = offset;

      if (chunkId === 'LIST') {
        const listType = read4CC();

        if (listType === 'hdrl') {
          // Header list - contains avih and strl
          while (offset - chunkStart < chunkSize - 4) {
            if (!(await ensureBytes(8))) break;

            const subChunkId = read4CC();
            const subChunkSize = readUInt32LE();

            if (!(await ensureBytes(subChunkSize))) break;

            const subChunkStart = offset;

            if (subChunkId === 'avih') {
              // Main AVI header
              aviHeader = {
                microSecPerFrame: readUInt32LE(),
                maxBytesPerSec: readUInt32LE(),
                totalFrames: 0,
                width: 0,
                height: 0,
                streams: 0,
              };
              skip(4); // padding
              readUInt32LE(); // flags - not used
              aviHeader.totalFrames = readUInt32LE();
              skip(4); // initialFrames
              aviHeader.streams = readUInt32LE();
              skip(4); // suggestedBufferSize
              aviHeader.width = readUInt32LE();
              aviHeader.height = readUInt32LE();
            } else if (subChunkId === 'LIST') {
              const strlType = read4CC();
              if (strlType === 'strl') {
                // Stream list
                let streamHeader: StreamHeader | null = null;
                let videoFormat: VideoFormat | null = null;
                let audioFormat: AudioFormat | null = null;

                while (offset - subChunkStart < subChunkSize - 4) {
                  if (!(await ensureBytes(8))) break;

                  const strlChunkId = read4CC();
                  const strlChunkSize = readUInt32LE();

                  if (!(await ensureBytes(strlChunkSize))) break;

                  const strlChunkStart = offset;

                  if (strlChunkId === 'strh') {
                    // Stream header
                    const type = read4CC();
                    const codec = read4CC();
                    skip(4); // flags
                    skip(2); // priority
                    skip(2); // language
                    skip(4); // initialFrames
                    const scale = readUInt32LE();
                    const rate = readUInt32LE();
                    skip(4); // start
                    const length = readUInt32LE();
                    skip(4); // suggestedBufferSize
                    skip(4); // quality
                    const sampleSize = readUInt32LE();

                    streamHeader = { type, codec, scale, rate, length, sampleSize };
                  } else if (strlChunkId === 'strf') {
                    // Stream format
                    if (streamHeader?.type === 'vids') {
                      // BITMAPINFOHEADER
                      skip(4); // biSize
                      const width = readUInt32LE();
                      const height = readUInt32LE();
                      skip(2); // biPlanes
                      const bitDepth = readUInt16LE();
                      const compression = read4CC();

                      videoFormat = { width, height, bitDepth, compression };
                    } else if (streamHeader?.type === 'auds') {
                      // WAVEFORMATEX
                      const formatTag = readUInt16LE();
                      const channels = readUInt16LE();
                      const samplesPerSec = readUInt32LE();
                      const avgBytesPerSec = readUInt32LE();
                      const blockAlign = readUInt16LE();
                      const bitsPerSample = readUInt16LE();

                      audioFormat = { formatTag, channels, samplesPerSec, avgBytesPerSec, blockAlign, bitsPerSample };
                    }
                  }

                  // Move to next chunk in strl
                  offset = strlChunkStart + strlChunkSize;
                  if (strlChunkSize % 2) offset++; // Word alignment
                }

                // Store stream info
                if (streamHeader && videoFormat) {
                  videoStreams.push({ header: streamHeader, format: videoFormat });
                } else if (streamHeader && audioFormat) {
                  audioStreams.push({ header: streamHeader, format: audioFormat });
                }
              }
            }

            // Move to next chunk
            offset = subChunkStart + subChunkSize;
            if (subChunkSize % 2) offset++; // Word alignment
          }
        } else if (listType === 'movi') {
          // Media data - we don't need to parse this for metadata
          break;
        }
      }

      // Move to next chunk
      offset = chunkStart + chunkSize;
      if (chunkSize % 2) offset++; // Word alignment

      // Stop after reading headers
      if (aviHeader && (videoStreams.length > 0 || audioStreams.length > 0)) {
        break;
      }
    }

    if (!aviHeader) {
      throw new UnsupportedFormatError('No AVI header found');
    }

    // Build MediaInfo
    const mediaInfo: MediaInfo = {
      parser: 'media-utils',
      container: 'avi',
      containerDetail: 'avi',
      videoStreams: [],
      audioStreams: [],
    };

    // Calculate duration from video stream
    if (videoStreams.length > 0 && aviHeader.microSecPerFrame > 0) {
      // This calculation seems to be incorrect, will be corrected after durations of all streams are calculated
      const durationInSeconds = (aviHeader.totalFrames * aviHeader.microSecPerFrame) / 1_000_000;
      mediaInfo.durationInSeconds = durationInSeconds;
    }

    // Add video streams
    videoStreams.forEach((stream, index) => {
      const fps = stream.header.rate && stream.header.scale ? stream.header.rate / stream.header.scale : undefined;
      const duration = fps && stream.header.length > 0 ? stream.header.length / fps : mediaInfo.durationInSeconds;

      mediaInfo.videoStreams.push({
        id: index + 1,
        codec: findVideoCodec(stream.format.compression)?.code ?? (stream.format.compression as any), // FOURCC codec
        codecDetail: stream.format.compression,
        width: stream.format.width,
        height: stream.format.height,
        fps,
        durationInSeconds: duration,
      });
    });

    // Add audio streams
    audioStreams.forEach((stream, index) => {
      const duration =
        stream.format.avgBytesPerSec > 0 && stream.header.length > 0
          ? (stream.header.length * stream.header.scale) / stream.header.rate
          : mediaInfo.durationInSeconds;

      // Map format tag to codec
      let codec: AudioCodecType;
      let codecDetail: string;
      const formatTagHex = `0x${stream.format.formatTag.toString(16).padStart(4, '0')}`;
      switch (stream.format.formatTag) {
        case 0x0001: {
          codec = 'pcm_s16le';
          codecDetail = `PCM (${formatTagHex})`;
          break;
        }
        case 0x0011:
        case 0x0069:
        case 0x0002: {
          codec = 'adpcm';
          codecDetail = `ADPCM (${formatTagHex})`;
          break;
        }
        case 0x0003: {
          codec = 'pcm_f32le';
          codecDetail = `IEEE Float PCM (${formatTagHex})`;
          break;
        }
        case 0x0050:
        case 0x0055: {
          codec = 'mp3';
          codecDetail = `MP3 (${formatTagHex})`;
          break;
        }
        case 0x0002000:
        case 0x2000: {
          codec = 'ac3';
          codecDetail = `AC-3 (${formatTagHex})`;
          break;
        }
        case 0x2001: {
          codec = 'dts';
          codecDetail = `DTS (${formatTagHex})`;
          break;
        }
        default: {
          codec = 'unknown' as any;
          codecDetail = `Unknown (${formatTagHex})`;
        }
      }

      mediaInfo.audioStreams.push({
        id: videoStreams.length + index + 1,
        codec: codec as any,
        codecDetail,
        channelCount: stream.format.channels,
        sampleRate: stream.format.samplesPerSec,
        bitrate: stream.format.avgBytesPerSec * 8,
        bitsPerSample: stream.format.bitsPerSample || undefined,
        durationInSeconds: duration,
      });
    });
    mediaInfo.durationInSeconds = Math.max(
      mediaInfo.durationInSeconds ?? -1,
      ...mediaInfo.videoStreams.map((s) => s.durationInSeconds ?? -1),
      ...mediaInfo.audioStreams.map((s) => s.durationInSeconds ?? -1),
    );
    if (mediaInfo.durationInSeconds < 0) {
      mediaInfo.durationInSeconds = undefined;
    }

    reader.releaseLock();
    return mediaInfo;
  } catch (error) {
    reader.releaseLock();
    throw error;
  }
}
