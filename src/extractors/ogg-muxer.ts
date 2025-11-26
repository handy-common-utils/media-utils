/**
 * OGG container muxer for Opus and Vorbis audio streams
 * Based on: https://xiph.org/ogg/doc/framing.html
 */

export interface OggMuxerOptions {
  codec: 'opus' | 'vorbis';
  codecPrivate?: Uint8Array; // OpusHead or Vorbis headers
  sampleRate?: number;
  channelCount?: number;
}

export class OggMuxer {
  private serialNumber: number;
  private pageSequenceNumber = 0;
  private granulePosition = 0;
  private codec: 'opus' | 'vorbis';
  private codecPrivate?: Uint8Array;
  private headerWritten = false;

  constructor(options: OggMuxerOptions) {
    this.codec = options.codec;
    this.codecPrivate = options.codecPrivate;
    // Generate random serial number
    this.serialNumber = Math.floor(Math.random() * 0xffffffff);
  }

  /**
   * Create OGG header pages (identification + comment headers)
   * @returns Array of OGG pages containing headers
   */
  createHeaders(): Uint8Array[] {
    const pages: Uint8Array[] = [];

    if (this.codec === 'opus') {
      // OpusHead page (BOS)
      const opusHead = this.codecPrivate || this.createDefaultOpusHead();
      pages.push(this.createPage(opusHead, 0, 0x02)); // BOS flag

      // OpusTags page
      const opusTags = this.createOpusTags();
      pages.push(this.createPage(opusTags, 0, 0x00));
    } else if (this.codec === 'vorbis') {
      // Vorbis has 3 headers: identification, comment, and setup
      // In WebM, these are stored in codecPrivate as: [count_byte, size1, size2, header1, header2, header3]
      if (this.codecPrivate && this.codecPrivate.length > 2) {
        // Parse WebM Vorbis codec private data
        const headers = this.parseVorbisCodecPrivate(this.codecPrivate);
        if (headers.length >= 2) {
          // Identification header (BOS)
          // Comment header
          // Setup header (if present)
          pages.push(
            this.createPage(headers[0], 0, 0x02),
            this.createPage(headers[1], 0, 0x00),
            ...(headers.length >= 3 ? [this.createPage(headers[2], 0, 0x00)] : []),
          );
        } else {
          // Fallback to default headers
          this.createDefaultVorbisHeaders(pages);
        }
      } else {
        // No codec private data, use defaults
        this.createDefaultVorbisHeaders(pages);
      }
    }

    this.headerWritten = true;
    return pages;
  }

  /**
   * Create default Vorbis headers
   * @param pages Array to push headers into
   */
  private createDefaultVorbisHeaders(pages: Uint8Array[]): void {
    const vorbisIdHeader = this.createDefaultVorbisIdHeader();
    pages.push(this.createPage(vorbisIdHeader, 0, 0x02)); // BOS flag

    const vorbisCommentHeader = this.createVorbisCommentHeader();
    pages.push(this.createPage(vorbisCommentHeader, 0, 0x00));
  }

  /**
   * Parse Vorbis codec private data from WebM format
   * Format: [count_byte, size1, size2, header1, header2, header3]
   * @param data Codec private data from WebM
   * @returns Array of Vorbis headers
   */
  private parseVorbisCodecPrivate(data: Uint8Array): Uint8Array[] {
    const headers: Uint8Array[] = [];

    // First byte is the number of headers minus 1 (should be 2 for 3 headers)
    const headerCount = data[0] + 1;
    if (headerCount !== 3) {
      return headers; // Invalid format
    }

    // Next bytes are the sizes of the first two headers (third size is implicit)
    let offset = 1;
    const sizes: number[] = [];

    // Read size of first header (can be multi-byte)
    let size1 = 0;
    while (offset < data.length && data[offset] === 255) {
      size1 += 255;
      offset++;
    }
    if (offset < data.length) {
      size1 += data[offset++];
    }
    sizes.push(size1);

    // Read size of second header (can be multi-byte)
    let size2 = 0;
    while (offset < data.length && data[offset] === 255) {
      size2 += 255;
      offset++;
    }
    if (offset < data.length) {
      size2 += data[offset++];
    }
    sizes.push(size2);

    // Extract the three headers
    for (let i = 0; i < 3; i++) {
      const headerSize = i < 2 ? sizes[i] : data.length - offset;

      if (offset + headerSize <= data.length) {
        headers.push(data.subarray(offset, offset + headerSize));
        offset += headerSize;
      }
    }

    return headers;
  }

  /**
   * Wrap audio frame data in an OGG page
   * @param frameData The audio frame data to wrap
   * @param isLastFrame Whether this is the last frame (sets EOS flag)
   * @returns OGG page containing the frame data
   */
  muxFrame(frameData: Uint8Array, isLastFrame = false): Uint8Array {
    // Update granule position (sample count)
    // For Opus: granule position is in 48kHz samples
    // For Vorbis: granule position is in codec sample rate
    // We'll approximate based on typical frame sizes
    const granuleIncrement = this.codec === 'opus' ? 960 : 1024;
    this.granulePosition += granuleIncrement;

    const flags = isLastFrame ? 0x04 : 0x00; // EOS flag if last frame
    return this.createPage(frameData, this.granulePosition, flags);
  }

  /**
   * Create an OGG page with the given payload
   * @param payload The data to include in the page
   * @param granulePos The granule position for this page
   * @param headerTypeFlag OGG header type flags (BOS, EOS, continued)
   * @returns Complete OGG page with headers and CRC
   */
  private createPage(payload: Uint8Array, granulePos: number, headerTypeFlag: number): Uint8Array {
    const segments: number[] = [];
    let remaining = payload.length;

    // Segment the payload into 255-byte chunks (OGG lacing)
    while (remaining > 0) {
      const segmentSize = Math.min(remaining, 255);
      segments.push(segmentSize);
      remaining -= segmentSize;
    }

    // If payload is exactly divisible by 255, add a zero-length segment
    if (payload.length > 0 && payload.length % 255 === 0) {
      segments.push(0);
    }

    const headerSize = 27 + segments.length;
    const pageSize = headerSize + payload.length;
    const page = new Uint8Array(pageSize);
    const view = new DataView(page.buffer);

    // Capture pattern: "OggS"
    page[0] = 0x4f; // 'O'
    page[1] = 0x67; // 'g'
    page[2] = 0x67; // 'g'
    page[3] = 0x53; // 'S'

    // Stream structure version
    page[4] = 0x00;

    // Header type flag
    page[5] = headerTypeFlag;

    // Granule position (8 bytes, little-endian)
    view.setBigUint64(6, BigInt(granulePos), true);

    // Stream serial number (4 bytes, little-endian)
    view.setUint32(14, this.serialNumber, true);

    // Page sequence number (4 bytes, little-endian)
    view.setUint32(18, this.pageSequenceNumber++, true);

    // CRC checksum (4 bytes, set to 0 for now, will calculate later)
    view.setUint32(22, 0, true);

    // Number of page segments
    page[26] = segments.length;

    // Segment table
    for (const [i, segment] of segments.entries()) {
      page[27 + i] = segment;
    }

    // Payload data
    page.set(payload, headerSize);

    // Calculate and set CRC checksum
    const crc = this.calculateCRC(page);
    view.setUint32(22, crc, true);

    return page;
  }

  /**
   * Calculate CRC32 checksum for OGG page
   * Polynomial: 0x04c11db7
   * @param data The page data to calculate CRC for
   * @returns CRC32 checksum
   */
  private calculateCRC(data: Uint8Array): number {
    const crcTable = this.getCRCTable();
    let crc = 0;

    for (const byte of data) {
      crc = (crc << 8) ^ crcTable[((crc >>> 24) ^ byte) & 0xff];
    }

    return crc >>> 0; // Convert to unsigned 32-bit
  }

  /**
   * Get or generate CRC lookup table
   * @returns CRC lookup table
   */
  private getCRCTable(): Uint32Array {
    if (!OggMuxer.crcTable) {
      const table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let r = i << 24;
        for (let j = 0; j < 8; j++) {
          if (r & 0x80000000) {
            r = (r << 1) ^ 0x04c11db7;
          } else {
            r <<= 1;
          }
        }
        table[i] = r >>> 0;
      }
      OggMuxer.crcTable = table;
    }
    return OggMuxer.crcTable;
  }

  private static crcTable?: Uint32Array;

  /**
   * Create default OpusHead identification header
   * @returns OpusHead header data
   */
  private createDefaultOpusHead(): Uint8Array {
    const header = new Uint8Array(19);
    const view = new DataView(header.buffer);

    // Magic signature: "OpusHead"
    header.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0);

    // Version (1 byte)
    header[8] = 0x01;

    // Channel count (1 byte) - default to 2 (stereo)
    header[9] = 0x02;

    // Pre-skip (2 bytes, little-endian) - default to 312
    view.setUint16(10, 312, true);

    // Input sample rate (4 bytes, little-endian) - default to 48000
    view.setUint32(12, 48000, true);

    // Output gain (2 bytes, little-endian) - default to 0
    view.setUint16(16, 0, true);

    // Channel mapping family (1 byte) - default to 0
    header[18] = 0x00;

    return header;
  }

  /**
   * Create OpusTags comment header
   * @returns OpusTags header data
   */
  private createOpusTags(): Uint8Array {
    const vendor = 'media-utils';
    const vendorBytes = new TextEncoder().encode(vendor);

    const headerSize = 8 + 4 + vendorBytes.length + 4; // "OpusTags" + vendor_length + vendor + user_comment_list_length
    const header = new Uint8Array(headerSize);
    const view = new DataView(header.buffer);

    let offset = 0;

    // Magic signature: "OpusTags"
    header.set([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73], offset);
    offset += 8;

    // Vendor string length (4 bytes, little-endian)
    view.setUint32(offset, vendorBytes.length, true);
    offset += 4;

    // Vendor string
    header.set(vendorBytes, offset);
    offset += vendorBytes.length;

    // User comment list length (4 bytes, little-endian) - 0 comments
    view.setUint32(offset, 0, true);

    return header;
  }

  /**
   * Create default Vorbis identification header
   * @returns Vorbis identification header data
   */
  private createDefaultVorbisIdHeader(): Uint8Array {
    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);

    // Header type (1 byte) - 0x01 for identification
    header[0] = 0x01;

    // Magic signature: "vorbis"
    header.set([0x76, 0x6f, 0x72, 0x62, 0x69, 0x73], 1);

    // Vorbis version (4 bytes, little-endian) - 0
    view.setUint32(7, 0, true);

    // Audio channels (1 byte) - default to 2
    header[11] = 0x02;

    // Audio sample rate (4 bytes, little-endian) - default to 48000
    view.setUint32(12, 48000, true);

    // Bitrate maximum (4 bytes, little-endian) - 0 (unset)
    view.setUint32(16, 0, true);

    // Bitrate nominal (4 bytes, little-endian) - 0 (unset)
    view.setUint32(20, 0, true);

    // Bitrate minimum (4 bytes, little-endian) - 0 (unset)
    view.setUint32(24, 0, true);

    // Blocksize (1 byte) - default values
    header[28] = 0xb8; // blocksize_0=256 (2^8), blocksize_1=2048 (2^11)

    // Framing flag (1 byte) - must be 0x01
    header[29] = 0x01;

    return header;
  }

  /**
   * Create Vorbis comment header
   * @returns Vorbis comment header data
   */
  private createVorbisCommentHeader(): Uint8Array {
    const vendor = 'media-utils';
    const vendorBytes = new TextEncoder().encode(vendor);

    const headerSize = 1 + 6 + 4 + vendorBytes.length + 4 + 1; // type + "vorbis" + vendor_length + vendor + comment_count + framing
    const header = new Uint8Array(headerSize);
    const view = new DataView(header.buffer);

    let offset = 0;

    // Header type (1 byte) - 0x03 for comment
    header[offset++] = 0x03;

    // Magic signature: "vorbis"
    header.set([0x76, 0x6f, 0x72, 0x62, 0x69, 0x73], offset);
    offset += 6;

    // Vendor string length (4 bytes, little-endian)
    view.setUint32(offset, vendorBytes.length, true);
    offset += 4;

    // Vendor string
    header.set(vendorBytes, offset);
    offset += vendorBytes.length;

    // User comment list length (4 bytes, little-endian) - 0 comments
    view.setUint32(offset, 0, true);
    offset += 4;

    // Framing bit (1 byte) - must be 0x01
    header[offset] = 0x01;

    return header;
  }
}
