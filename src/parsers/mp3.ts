import { getMp3FrameLength, getMp3SamplesPerFrame, isMp3FrameSync, parseMP3Header, parseVBRHeader } from '../codecs/mp3';
import { GetMediaInfoOptions, GetMediaInfoResult } from '../get-media-info';
import { ensureBufferData, UnsupportedFormatError } from '../utils';

const INITIAL_READ_SIZE = 64 * 1024;
const STREAM_READ_CHUNK_SIZE = 64 * 1024;

/**
 * Returns the byte offset of the first MP3 audio frame, skipping an ID3v2 tag when present.
 * @param buffer The MP3 data read so far
 * @returns The offset of the first audio frame
 */
function getFirstAudioFrameOffset(buffer: Uint8Array): number {
  if (buffer.length >= 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const size = ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) | ((buffer[8] & 0x7f) << 7) | (buffer[9] & 0x7f);
    return 10 + size;
  }
  return 0;
}

/**
 * Counts MP3 audio frames in a buffer starting from the given offset.
 * @param buffer The MP3 data buffer
 * @param startOffset The offset of the first audio frame
 * @returns Frame count, audio byte count, and the next offset to continue from
 */
function countMp3FramesInBuffer(
  buffer: Uint8Array,
  startOffset: number,
): { frameCount: number; audioBytes: number; nextOffset: number; needsMoreData: boolean } {
  let offset = startOffset;
  let frameCount = 0;
  let audioBytes = 0;

  while (offset + 4 <= buffer.length) {
    if (!isMp3FrameSync(buffer, offset)) {
      offset++;
      continue;
    }

    try {
      const frameLength = getMp3FrameLength(buffer, offset);
      if (frameLength <= 0) {
        offset++;
        continue;
      }
      if (offset + frameLength > buffer.length) {
        return { frameCount, audioBytes, nextOffset: offset, needsMoreData: true };
      }
      frameCount++;
      audioBytes += frameLength;
      offset += frameLength;
    } catch {
      offset++;
    }
  }

  return {
    frameCount,
    audioBytes,
    nextOffset: offset,
    needsMoreData: offset + 4 > buffer.length,
  };
}

/**
 * Counts MP3 frames by scanning the stream until EOF when no VBR header is available.
 * @param reader The stream reader
 * @param buffer The buffered data read so far
 * @param startOffset The offset of the first audio frame in the buffer
 * @param streamDone Whether the stream has already reached EOF
 * @param streamBytesRead Total bytes already read from the stream
 * @returns Total frame count, audio bytes, and total stream bytes read
 */
async function countMp3FramesToEnd(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  buffer: Uint8Array,
  startOffset: number,
  streamDone: boolean,
  streamBytesRead: number,
): Promise<{ totalFrames: number; audioBytes: number; streamBytesRead: number }> {
  let currentBuffer = buffer;
  let offset = startOffset;
  let totalFrames = 0;
  let audioBytes = 0;
  let done = streamDone;
  let bytesRead = streamBytesRead;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const scanResult = countMp3FramesInBuffer(currentBuffer, offset);
    totalFrames += scanResult.frameCount;
    audioBytes += scanResult.audioBytes;
    offset = scanResult.nextOffset;

    if (!scanResult.needsMoreData || done) {
      break;
    }

    const requiredSize = Math.max(STREAM_READ_CHUNK_SIZE, currentBuffer.length - offset + 4);
    const readResult = await ensureBufferData(reader, currentBuffer, offset, requiredSize);
    currentBuffer = readResult.buffer;
    offset = readResult.bufferOffset;
    bytesRead += readResult.bytesRead;
    done = readResult.done;
  }

  return { totalFrames, audioBytes, streamBytesRead: bytesRead };
}

/**
 * Parses MP3 file from a stream and extracts media information.
 * Note: The returned MediaInfo does not include the 'parser' field,
 * which should be set by the adapter.
 *
 * @param stream The input media stream
 * @param _options Optional options for the parser
 * @returns Media information without the parser field
 * @throws UnsupportedFormatError if the stream is not a valid MP3 file
 */
export async function parseMp3(stream: ReadableStream<Uint8Array>, _options?: GetMediaInfoOptions): Promise<Omit<GetMediaInfoResult, 'parser'>> {
  const reader = stream.getReader();

  try {
    const initialRead = await ensureBufferData(reader, undefined, undefined, INITIAL_READ_SIZE);
    const buffer = initialRead.buffer;
    let streamBytesRead = initialRead.bytesRead;

    if (buffer.length === 0) {
      throw new UnsupportedFormatError('Not an MP3 file: insufficient data');
    }

    const audioFrameOffset = getFirstAudioFrameOffset(buffer);
    if (audioFrameOffset >= buffer.length) {
      throw new UnsupportedFormatError('Not an MP3 file: no frame header found after ID3 tag');
    }

    const audioStream = parseMP3Header(buffer, audioFrameOffset);

    let durationInSeconds: number | undefined;
    let averageBitrate: number | undefined = audioStream.bitrate;

    const vbrInfo = parseVBRHeader(buffer.subarray(audioFrameOffset));
    if (vbrInfo.totalFrames && audioStream.sampleRate) {
      const samplesPerFrame = getMp3SamplesPerFrame(buffer, audioFrameOffset);
      const totalSamples = vbrInfo.totalFrames * samplesPerFrame;
      durationInSeconds = totalSamples / audioStream.sampleRate;

      if (vbrInfo.fileSize && durationInSeconds > 0) {
        averageBitrate = Math.round((vbrInfo.fileSize * 8) / durationInSeconds);
      }
    } else if (audioStream.sampleRate) {
      const scanResult = await countMp3FramesToEnd(reader, buffer, audioFrameOffset, initialRead.done, streamBytesRead);
      streamBytesRead = scanResult.streamBytesRead;

      if (scanResult.totalFrames > 0) {
        const samplesPerFrame = getMp3SamplesPerFrame(buffer, audioFrameOffset);
        durationInSeconds = (scanResult.totalFrames * samplesPerFrame) / audioStream.sampleRate;

        if (scanResult.audioBytes > 0 && durationInSeconds > 0) {
          averageBitrate = Math.round((scanResult.audioBytes * 8) / durationInSeconds);
        }
      }
    }

    return {
      container: 'mp3',
      containerDetail: 'mp3',
      durationInSeconds,
      videoStreams: [],
      audioStreams: [
        {
          id: 0,
          ...audioStream,
          bitrate: averageBitrate,
          durationInSeconds,
        },
      ],
      bytesRead: streamBytesRead,
    };
  } finally {
    reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
