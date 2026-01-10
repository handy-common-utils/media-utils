/* eslint-disable max-depth */
import { mapWaveFormatTagToCodec, parseWaveFormatEx } from '../codecs/waveformatex';
import { GetMediaInfoOptions, GetMediaInfoResult } from '../get-media-info';
import { findVideoCodec } from '../media-info';
import { ensureBufferData, setupGlobalLogger, UnsupportedFormatError } from '../utils';

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
  adpcmDetails?: {
    samplesPerBlock: number;
  };
}

/**
 * Callback function to receive audio samples from AVI movi LIST
 * @param streamNumber - The AVI stream number (0-based)
 * @param samples - Array of sample buffers
 */
export type OnAviSamplesCallback = (streamNumber: number, samples: Uint8Array[]) => void | Promise<void>;

export interface ParseAviOptions extends GetMediaInfoOptions {
  /**
   * Callback function to receive samples from the movi LIST.
   */
  onSamples?: OnAviSamplesCallback;
}

/**
 * Parse AVI (Audio Video Interleaved) files
 * AVI is built on RIFF (Resource Interchange File Format) structure
 * @param stream - The readable stream of the AVI file
 * @param options - Optional options for the parser
 * @returns Promise resolving to MediaInfo
 */
export async function parseAvi(stream: ReadableStream<Uint8Array>, options?: ParseAviOptions): Promise<Omit<GetMediaInfoResult, 'parser'>> {
  const logger = setupGlobalLogger(options);
  if (logger.isDebug) logger.debug('Starting parsing AVI');
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
                      // Parse WAVEFORMATEX structure
                      const { format, bytesRead } = parseWaveFormatEx(buffer, offset, strlChunkSize);
                      audioFormat = format;
                      offset += bytesRead;
                    }
                  }

                  // Move to next chunk in strl
                  // offset is already updated if we read extra data, but we need to ensure we align to chunk end
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
          // Media data - process chunks if onSamples callback is provided
          if (options?.onSamples) {
            // Process all chunks in the movi LIST
            while (offset - chunkStart < chunkSize - 4) {
              if (!(await ensureBytes(8))) break;

              const dataChunkId = read4CC();
              const dataChunkSize = readUInt32LE();

              if (!(await ensureBytes(dataChunkSize))) break;

              // Extract stream number from chunk ID (first 2 characters)
              // Examples: "00dc" -> stream 0, "01wb" -> stream 1
              const streamNumberStr = dataChunkId.slice(0, 2);
              const streamNumber = Number.parseInt(streamNumberStr, 10);

              // Extract chunk data
              const chunkData = buffer.slice(offset, offset + dataChunkSize);

              // Call the callback with stream number and samples
              // We wrap the chunk data in an array as requested
              await options.onSamples(streamNumber, [chunkData]);

              offset += dataChunkSize;
              if (dataChunkSize % 2) offset++; // Word alignment
            }
          }
          // After processing movi (or skipping it), we're done
          break;
        }
      }

      // Move to next chunk
      offset = chunkStart + chunkSize;
      if (chunkSize % 2) offset++; // Word alignment

      // Stop after reading headers, unless we are extracting samples
      if (!options?.onSamples && aviHeader && (videoStreams.length > 0 || audioStreams.length > 0)) {
        break;
      }
    }

    if (!aviHeader) {
      throw new UnsupportedFormatError('No AVI header found');
    }

    // Build MediaInfo
    const mediaInfo: Omit<GetMediaInfoResult, 'parser'> = {
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

      // Map format tag to codec using the shared utility
      const { codec, codecDetail } = mapWaveFormatTagToCodec(stream.format.formatTag, stream.format.bitsPerSample);

      mediaInfo.audioStreams.push({
        id: videoStreams.length + index + 1,
        codec: codec as any,
        codecDetail,
        channelCount: stream.format.channels,
        sampleRate: stream.format.samplesPerSec,
        bitrate: stream.format.avgBytesPerSec * 8,
        bitsPerSample: stream.format.bitsPerSample || undefined,
        durationInSeconds: duration,
        codecDetails: {
          formatTag: stream.format.formatTag,
          blockAlign: stream.format.blockAlign,
          samplesPerBlock: stream.format.adpcmDetails?.samplesPerBlock,
        },
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

    return { ...mediaInfo, bytesRead: offset };
  } finally {
    reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
