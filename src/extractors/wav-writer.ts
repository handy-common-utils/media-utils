import { buildWaveFormatEx } from '../codecs/waveformatex';
import { AudioStreamInfo } from '../media-info';

/**
 * Write PCM audio data as a WAV file
 * WAV is a RIFF container with the following structure:
 * - RIFF header (12 bytes)
 * - fmt chunk (24+ bytes)
 * - data chunk (8 bytes + PCM data)
 */
export class WavWriter {
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private audioStream: AudioStreamInfo;
  private chunks: Uint8Array[] = [];
  private dataSize = 0;

  constructor(writer: WritableStreamDefaultWriter<Uint8Array>, audioStream: AudioStreamInfo) {
    this.writer = writer;
    this.audioStream = audioStream;
  }

  /**
   * Append PCM data to the internal buffer
   * @param data The PCM data to append
   */
  appendData(data: Uint8Array): void {
    this.chunks.push(data);
    this.dataSize += data.length;
  }

  /**
   * Build the WAV header based on the total data size
   * @returns The WAV header as a Uint8Array
   */
  private buildHeader(): Uint8Array {
    const sampleRate = this.audioStream.sampleRate ?? 44100;
    const channels = this.audioStream.channelCount ?? 2;
    const bitsPerSample = this.audioStream.bitsPerSample ?? 16;
    const formatTag = this.audioStream.codecDetails?.formatTag ?? 1; // Default to PCM (1)

    // Calculate blockAlign and byteRate if not provided
    // For PCM: blockAlign = channels * bits / 8
    // For ADPCM: blockAlign is usually provided in the stream info
    let blockAlign = this.audioStream.codecDetails?.blockAlign;
    if (!blockAlign) {
      blockAlign = (channels * bitsPerSample) / 8;
    }

    // Calculate byteRate
    // For PCM: byteRate = sampleRate * blockAlign
    // For ADPCM: byteRate = (sampleRate * blockAlign) / samplesPerBlock
    let byteRate: number;
    if (this.audioStream.codecDetails?.samplesPerBlock && blockAlign) {
      byteRate = Math.floor((sampleRate * blockAlign) / this.audioStream.codecDetails.samplesPerBlock);
    } else {
      // If we have bitrate, use it (bitrate is in bits/sec, byteRate is bytes/sec)
      byteRate = this.audioStream.bitrate ? Math.floor(this.audioStream.bitrate / 8) : sampleRate * blockAlign;
    }

    // Build WAVEFORMATEX structure using the shared utility
    const waveFormatEx = buildWaveFormatEx({
      formatTag,
      channels,
      samplesPerSec: sampleRate,
      avgBytesPerSec: byteRate,
      blockAlign,
      bitsPerSample,
      adpcmDetails: this.audioStream.codecDetails?.samplesPerBlock
        ? {
            samplesPerBlock: this.audioStream.codecDetails.samplesPerBlock,
          }
        : undefined,
    });

    // Calculate total header size
    const headerSize = 12 + (8 + waveFormatEx.length) + 8;
    // RIFF (12) + fmt (8 + waveFormatEx.length) + data header (8)

    // Create header buffer
    const header = new Uint8Array(headerSize);
    const view = new DataView(header.buffer);

    // File size field (at offset 4) is the size of the rest of the file (Total Size - 8 bytes)
    const fileSize = headerSize + this.dataSize - 8;

    // RIFF header
    header.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
    view.setUint32(4, fileSize, true); // File size
    header.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

    // fmt chunk
    header.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
    view.setUint32(16, waveFormatEx.length, true); // fmt chunk size
    header.set(waveFormatEx, 20); // WAVEFORMATEX data

    // data chunk header
    const dataChunkOffset = 20 + waveFormatEx.length;
    header.set([0x64, 0x61, 0x74, 0x61], dataChunkOffset); // "data"
    view.setUint32(dataChunkOffset + 4, this.dataSize, true); // Data size

    return header;
  }

  /**
   * Write the header and all buffered data to the writer
   */
  async writeAll(): Promise<void> {
    const header = this.buildHeader();
    await this.writer.write(header);

    for (const chunk of this.chunks) {
      await this.writer.write(chunk);
    }
  }
}
