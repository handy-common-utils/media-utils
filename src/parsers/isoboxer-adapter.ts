import { EsdsInfo, parseEsds } from '../codecs/mp4';
import { GetMediaInfoOptions } from '../get-media-info';
import { AudioStreamInfo, MediaInfo, toAudioCodec, toContainer, toVideoCodec, VideoStreamInfo } from '../media-info';
import { ParsingError, UnsupportedFormatError } from '../utils';
import { MediaParserAdapter } from './adapter';

export class IsoBoxerAdapter implements MediaParserAdapter {
  private constructor(private ISOBoxer: any) {}

  static async newInstance(): Promise<IsoBoxerAdapter> {
    // @ts-expect-error codem-isoboxer does not have type definition
    const ISOBoxer = await import(/* @vite-ignore */ 'codem-isoboxer');
    return new IsoBoxerAdapter(ISOBoxer);
  }

  async parse(stream: ReadableStream<Uint8Array>, options?: GetMediaInfoOptions): Promise<MediaInfo> {
    try {
      return await this.parseWithoutErrorHandling(stream, options);
    } catch (error) {
      if (error && !(error as ParsingError).isUnsupportedFormatError) {
        const msg = (error as Error)?.message;
        if (msg && /(Unknown|Invalid|Unsupported|not found|cannot parse)/i.test(msg)) {
          (error as ParsingError).isUnsupportedFormatError = true;
        }
      }

      throw error;
    }
  }

  private async parseWithoutErrorHandling(stream: ReadableStream<Uint8Array>, _options?: GetMediaInfoOptions): Promise<MediaInfo> {
    // The first 1MB of the file is read and then fed to the parser
    const MAX_PROBE_SIZE = 1 * 1024 * 1024; // 1MB
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    let bytesRead = 0;
    while (bytesRead < MAX_PROBE_SIZE) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        bytesRead += value.length;
      }
    }
    reader.cancel();

    // Combine chunks into a single ArrayBuffer
    const arrayBuffer = new ArrayBuffer(bytesRead);
    const uint8Array = new Uint8Array(arrayBuffer);
    let offset = 0;
    for (const chunk of chunks) {
      uint8Array.set(chunk, offset);
      offset += chunk.length;
    }

    // Parse the buffer using ISOBoxer
    const parsedFile = this.ISOBoxer.parseBuffer(arrayBuffer);

    if (!parsedFile || !parsedFile.boxes) {
      throw new UnsupportedFormatError('Failed to parse file with ISOBoxer');
    }

    // Extract ftyp box for container information
    const ftyp = parsedFile.fetch('ftyp');
    if (!ftyp) {
      throw new UnsupportedFormatError('ftyp box not found - file may not be a valid MP4/ISOBMFF file');
    }

    const brands = [ftyp.major_brand, ...(ftyp.compatible_brands || [])];
    const container = toContainer(brands).code;

    // Extract moov box for metadata
    const moov = parsedFile.fetch('moov');
    if (!moov) {
      throw new UnsupportedFormatError('moov box not found - file may be incomplete or corrupted');
    }

    // Get all track boxes using fetchAll on the parsed file (not on moov)
    const traks = parsedFile.fetchAll('trak');
    if (!traks || traks.length === 0) {
      throw new UnsupportedFormatError('No tracks found in file');
    }

    const videoStreams: VideoStreamInfo[] = [];
    const audioStreams: AudioStreamInfo[] = [];
    let durationInSeconds: number | undefined;

    // Extract movie header duration if available
    const mvhd = moov.boxes?.find((box: any) => box.type === 'mvhd');
    if (mvhd && mvhd.duration && mvhd.timescale) {
      durationInSeconds = mvhd.duration / mvhd.timescale;
    }

    // Process each track
    for (const trak of traks) {
      // Navigate to mdia box
      const mdia = trak.boxes?.find((box: any) => box.type === 'mdia');
      if (!mdia) continue;

      const tkhd = trak.boxes?.find((box: any) => box.type === 'tkhd');
      const mdhd = mdia.boxes?.find((box: any) => box.type === 'mdhd');
      const hdlr = mdia.boxes?.find((box: any) => box.type === 'hdlr');
      const minf = mdia.boxes?.find((box: any) => box.type === 'minf');

      if (!hdlr || !minf) continue;

      const handlerType = hdlr.handler_type;
      const stbl = minf.boxes?.find((box: any) => box.type === 'stbl');
      if (!stbl) continue;

      const stsd = stbl.boxes?.find((box: any) => box.type === 'stsd');
      if (!stsd || !stsd.entries || stsd.entries.length === 0) continue;

      const sampleEntry = stsd.entries[0];
      let codecDetail = sampleEntry.type;
      let esdsInfo: EsdsInfo | undefined;

      // Try to parse ESDS for more detailed codec information
      if (sampleEntry.esds && sampleEntry.esds.byteLength > 0) {
        esdsInfo = parseEsds(sampleEntry.esds);
        if (esdsInfo) {
          codecDetail += `.${esdsInfo.objectTypeIndication.toString(16).padStart(2, '0')}`;
        }
      }

      // Calculate track duration
      let trackDuration: number | undefined;
      if (mdhd && mdhd.duration && mdhd.timescale) {
        trackDuration = mdhd.duration / mdhd.timescale;
      }

      if (handlerType === 'vide') {
        // Video track
        const width = sampleEntry.width;
        const height = sampleEntry.height;

        videoStreams.push({
          id: tkhd.track_ID,
          codecDetail,
          codec: toVideoCodec(codecDetail).code,
          width,
          height,
          durationInSeconds: trackDuration || durationInSeconds,
        });
      } else if (handlerType === 'soun') {
        // Audio track
        const channelCount = sampleEntry.channelcount;
        const sampleRate = sampleEntry.samplerate;
        const codec = toAudioCodec(codecDetail).code;

        const audioStreamInfo = {
          id: tkhd.track_ID,
          codecDetail,
          codec,
          channelCount: channelCount ?? esdsInfo?.channels,
          sampleRate: sampleRate ?? esdsInfo?.sampleRate,
          durationInSeconds: trackDuration || durationInSeconds,
        };

        audioStreams.push(audioStreamInfo);
      }
    }

    return {
      parser: 'isoboxer',
      containerDetail: brands.join(', '),
      container,
      durationInSeconds,
      videoStreams,
      audioStreams,
    };
  }
}
