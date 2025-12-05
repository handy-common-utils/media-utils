import { AudioCodecType, AudioStreamInfo } from '../media-info';
import { UnsupportedFormatError } from '../utils';
import { parseADTSHeader } from './aac';
import { toHexString } from './binary';
import { parseMP3Header } from './mp3';

export interface FrameInfo {
  data: Uint8Array; // Complete frame (header + payload)
  type: AudioCodecType;
  headerLength: number; // Header size in bytes
  frameLength: number; // Total frame size in bytes
}

/**
 * Parse audio frame header to get frame details
 * @param buffer The buffer containing the frame
 * @param offset The offset of the frame in the buffer
 * @returns Frame details including length and header size, or undefined if invalid
 */
export function parseAudioFrame(
  buffer: Uint8Array,
  offset: number,
): (Omit<AudioStreamInfo, 'id' | 'durationInSeconds'> & { frameLength: number; headerLength: number }) | undefined {
  if (buffer.length - offset < 2) return undefined;

  // Check sync byte
  if (buffer[offset] !== 0xff) return undefined;

  const secondByte = buffer[offset + 1];

  // Check Layer bits (bits 1-2 of second byte)
  // AAC ADTS has Layer = 00
  // MP3 has Layer = 01 (III), 10 (II), or 11 (I)
  const layer = (secondByte >> 1) & 0x03;

  try {
    // ADTS syncword is 12 bits 0xFFF
    if (layer === 0 && (secondByte & 0xf0) === 0xf0) {
      const info = parseADTSHeader(buffer, offset);

      // ADTS header length: 7 bytes (protection absent) or 9 bytes (CRC present)
      const protectionAbsent = buffer[offset + 1] & 0x01;
      const headerLength = protectionAbsent ? 7 : 9;

      // Frame Length (13 bits):
      // byte 3 (last 2 bits) << 11
      // byte 4 (all 8 bits) << 3
      // byte 5 (top 3 bits) >> 5
      const frameLength = ((buffer[offset + 3] & 0x03) << 11) | (buffer[offset + 4] << 3) | ((buffer[offset + 5] & 0xe0) >> 5);

      return {
        ...info,
        frameLength,
        headerLength,
      };
    } else if ((layer === 1 || layer === 2 || layer === 3) && (secondByte & 0xe0) === 0xe0) {
      // Potentially MP3/MP2 (Layer I, II, III)
      // Check syncword 11 bits 0xFFE0

      const info = parseMP3Header(buffer, offset);
      const { bitrate, sampleRate, codecDetails } = info;
      const { layer: layerFromInfo, padding } = codecDetails!;

      const frameLength =
        layerFromInfo === 1
          ? Math.floor((12 * bitrate!) / sampleRate! + padding!) * 4 // Layer I
          : Math.floor((144 * bitrate!) / sampleRate! + padding!); // Layer II / III

      return {
        ...info,
        frameLength,
        headerLength: 4,
      };
    }

    throw new UnsupportedFormatError(`Unrecognized audio frame: ${toHexString(buffer.subarray(offset, offset + 4))} ...`);
  } catch {
    // Not a valid frame, could be false sync bytes
    return undefined;
  }
}

/**
 * Handles PES payloads for AAC/MP3/MP2 audio streams.
 * Buffers incomplete frames and calls onFrames when complete frames are ready.
 */
export class PesPayloadHandler {
  private buffer: Uint8Array = new Uint8Array(0);
  private audioType: AudioCodecType;
  private onFramesCallback: (frames: FrameInfo[]) => void;

  constructor(audioType: AudioCodecType, onFrames: (frames: FrameInfo[]) => void) {
    this.audioType = audioType;
    this.onFramesCallback = onFrames;
  }

  /**
   * Receives PES payload data and extracts complete frames.
   * @param payloadData - The PES payload data
   */
  public async onData(payloadData: Uint8Array | ArrayBufferLike) {
    const data = payloadData instanceof Uint8Array ? payloadData : new Uint8Array(payloadData);
    // console.error('onData', this.buffer.length, data.length);

    // Append new data to existing buffer
    const combined = new Uint8Array(this.buffer.length + data.length);
    combined.set(this.buffer);
    combined.set(data, this.buffer.length);
    this.buffer = combined;
    // console.error('buffer', this.buffer.length);

    const frames: FrameInfo[] = [];
    let processedUpTo = 0; // Track how much data we've successfully processed

    // Extract all complete frames from the buffer
    let offset = 0;
    while (offset < this.buffer.length) {
      // Find next sync byte
      const frameStart = this.findFrameSyncFrom(this.buffer, offset);
      if (frameStart === -1) {
        // No more sync bytes found
        break;
      }

      // Skip junk before sync
      offset = frameStart;

      // Check if we have enough data to read the header
      if (offset + 4 > this.buffer.length) {
        // Not enough data for header
        break;
      }

      const audioFrame = parseAudioFrame(this.buffer, frameStart);
      // console.error('frameStart, audioFrame', frameStart, audioFrame);

      if (!audioFrame) {
        // Invalid frame header, skip this sync byte and continue
        offset++;
        continue;
      }

      const { frameLength, headerLength } = audioFrame;

      if (offset + frameLength > this.buffer.length) {
        // Incomplete frame, wait for more data
        break;
      }

      // We have a complete frame!
      const frame: FrameInfo = {
        data: this.buffer.subarray(frameStart, frameStart + frameLength),
        type: audioFrame.codec as AudioCodecType, // Use detected codec
        headerLength,
        frameLength,
      };
      frames.push(frame);

      offset += frameLength;
      processedUpTo = offset; // Mark this position as successfully processed
    }

    // Flush complete frames
    if (frames.length > 0) {
      // console.error('Got frames:', frames.length, processedUpTo, this.buffer.length, payloadData.byteLength);
      this.onFramesCallback(frames);
    }

    // Keep only unprocessed data (incomplete frame at the end)
    // This should happen regardless of whether we found frames or not,
    // to ensure we discard any junk data we skipped over
    if (processedUpTo > 0) {
      // console.error('Keep only unprocessed data', processedUpTo, this.buffer.length);
      this.buffer = this.buffer.subarray(processedUpTo);
    }

    // Safety check: if buffer is growing too large without finding valid frames,
    // discard old data to prevent memory leak
    if (this.buffer.length > 100000) {
      console.error('buffer length too large', this.buffer.length);
      // Keep only last 10KB
      this.buffer = this.buffer.subarray(-10000);
    }
    // console.error('buffer length check', this.buffer.length);
  }

  /**
   * Find frame sync word in buffer starting from a specific offset
   * @param buffer - The buffer to search
   * @param startOffset - The offset to start searching from
   * @returns The offset of the sync word, or -1 if not found
   */
  private findFrameSyncFrom(buffer: Uint8Array, startOffset: number): number {
    for (let i = startOffset; i < buffer.length - 1; i++) {
      if (buffer[i] === 0xff && (buffer[i + 1] & 0xe0) === 0xe0) {
        // 11-bit sync word 0x7FF
        return i;
      } else if (buffer[i] === 0xff && (buffer[i + 1] & 0xf0) === 0xf0) {
        // ADTS syncword 0xFFF
        return i;
      }
    }
    return -1;
  }
}
