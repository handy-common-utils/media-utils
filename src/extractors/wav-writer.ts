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

    // Prepare extra data if needed
    let extraData = new Uint8Array(0);
    if (formatTag === 0x0002 && this.audioStream.codecDetails?.samplesPerBlock) {
      // MS ADPCM (formatTag 0x0002)
      //
      // MS ADPCM uses exactly 7 standard predictor coefficient pairs.
      // These are FIXED and STANDARDIZED — they never change between streams or files.
      //
      // Each ADPCM block header contains a predictor index (0-6) that selects
      // which coefficient pair to use for decoding that specific block.
      //
      // The 7 standard MS ADPCM predictor coefficient pairs:
      const standardCoefficients = [
        { coeff1: 256, coeff2: 0 }, // Predictor 0
        { coeff1: 512, coeff2: -256 }, // Predictor 1
        { coeff1: 0, coeff2: 0 }, // Predictor 2
        { coeff1: 192, coeff2: 64 }, // Predictor 3
        { coeff1: 240, coeff2: 0 }, // Predictor 4
        { coeff1: 460, coeff2: -208 }, // Predictor 5
        { coeff1: 392, coeff2: -232 }, // Predictor 6
      ];

      const { samplesPerBlock } = this.audioStream.codecDetails;
      const numCoef = 7;

      // Build the WAVEFORMATEX extension for MS ADPCM:
      // cbSize (2) + samplesPerBlock (2) + numCoef (2) + coefficients (7 * 4 = 28)
      const extraDataSize = 2 + 2 + 2 + numCoef * 4;
      extraData = new Uint8Array(extraDataSize);
      const view = new DataView(extraData.buffer);

      // cbSize: size of the extra data following this field
      view.setUint16(0, extraDataSize - 2, true);

      // samplesPerBlock: STREAM LEVEL — constant for entire stream
      // How many PCM samples each ADPCM block will decode to
      view.setUint16(2, samplesPerBlock ?? 0, true);

      // Actuall, coefficients are only needed for custom ADPCM formats, not MS ADPCM.

      // numCoef: always 7 for MS ADPCM
      view.setUint16(4, numCoef, true);

      // Write the 7 standard coefficient pairs
      // These are required by the WAV/AVI format specification,
      // even though they're always the same values
      for (let i = 0; i < numCoef; i++) {
        view.setInt16(6 + i * 4, standardCoefficients[i].coeff1, true);
        view.setInt16(8 + i * 4, standardCoefficients[i].coeff2, true);
      }
    } else if (formatTag !== 1) {
      // For non-PCM formats, we usually need a cbSize of 0 at least
      extraData = new Uint8Array(2);
      // cbSize = 0
    }

    // So base size is 16.
    // If formatTag != 1, we append cbSize (2 bytes) + extra data.
    // My extraData buffer constructed above INCLUDES cbSize at the beginning.

    const headerSize = 12 + (8 + 16 + extraData.length) + 8;
    // RIFF (12)
    // fmt (8 + 16 + extra)
    // data header (8)

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
    view.setUint32(16, 16 + extraData.length, true); // fmt chunk size
    view.setUint16(20, formatTag, true); // Audio format
    view.setUint16(22, channels, true); // Number of channels
    view.setUint32(24, sampleRate, true); // Sample rate
    view.setUint32(28, byteRate, true); // Byte rate
    view.setUint16(32, blockAlign, true); // Block align
    view.setUint16(34, bitsPerSample, true); // Bits per sample

    if (extraData.length > 0) {
      header.set(extraData, 36);
    }

    // data chunk header
    const dataChunkOffset = 36 + extraData.length;
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
