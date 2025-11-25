import type { ES_Descriptor, ISOFile, Movie } from 'mp4box';

import { getAacProfileName, toAudioCodecType, toContainerType, toVideoCodecType } from '../codec-utils';
import { GetMediaInfoOptions } from '../get-media-info';
import { AudioStreamInfo, MediaInfo, VideoStreamInfo } from '../media-info';
import { MediaParserAdapter, ParsingError, UnsupportedFormatError } from './adapter';

export class Mp4BoxAdapter implements MediaParserAdapter {
  private mp4box: typeof import('mp4box');

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module
    this.mp4box = require('mp4box');
  }

  async parse(stream: ReadableStream<Uint8Array>, options?: GetMediaInfoOptions): Promise<MediaInfo> {
    try {
      return await this.parseWithoutErrorHandling(stream, options);
    } catch (error) {
      if (error && !(error as ParsingError).isUnsupportedFormatError) {
        const msg = (error as Error)?.message;
        if (msg && /(Invalid box type:)|(: ISOFile$)/.test(msg)) {
          (error as ParsingError).isUnsupportedFormatError = true;
        }
      }

      throw error;
    }
  }

  private async parseWithoutErrorHandling(stream: ReadableStream<Uint8Array>, _options?: GetMediaInfoOptions): Promise<MediaInfo> {
    return new Promise((resolve, reject) => {
      const mp4file = this.mp4box.createFile();

      let infoFound = false;

      mp4file.onReady = (info) => {
        infoFound = true;
        const mediaInfo = mp4boxInfoToMediaInfo(info, mp4file);
        resolve(mediaInfo);
        mp4file.flush();
      };

      mp4file.onError = (e: string) => {
        reject(new UnsupportedFormatError(`MP4Box error: ${e}`));
      };

      const reader = stream.getReader();
      let offset = 0;

      function readChunk() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              if (!infoFound) {
                reject(new UnsupportedFormatError('Stream ended before MP4 info was found'));
              }
              mp4file.flush();
              return;
            }

            if (value) {
              const buffer = value.buffer as ArrayBuffer & {
                fileStart: number;
              };
              buffer.fileStart = offset;
              mp4file.appendBuffer(buffer);
              offset += value.length;

              if (infoFound) {
                reader.cancel();
              } else {
                readChunk();
              }
            }
          })
          .catch((error) => {
            reject(error);
            reader.cancel();
          });
      }

      readChunk();
    });
  }
}

/**
 * Convert mp4box Movie information to MediaInfo
 * @param info mp4box Movie information which is the output from its parsing
 * @param mp4file The mp4box file object (ISOFile)
 * @returns MediaInfo
 */
export function mp4boxInfoToMediaInfo(info: Movie, mp4file?: ISOFile): MediaInfo {
  // For mp3 in mov, mp4box is unable to put the mp3 track into audioTracks.
  // Here's the patch:
  for (const track of info.otherTracks) {
    if (track.codec === 'mp3' && !info.audioTracks.some((audioTrack) => audioTrack.id === track.id)) {
      info.audioTracks.push(track);
      info.audioTracks.sort((a, b) => a.id - b.id);
    }
  }

  const videoStreams: VideoStreamInfo[] = info.videoTracks.map((track) => ({
    id: track.id,
    codecDetail: track.codec,
    codec: toVideoCodecType(track.codec),
    width: track.video?.width ?? track.track_width,
    height: track.video?.height ?? track.track_height,
    bitrate: track.bitrate,
    durationInSeconds: track.duration / track.timescale,
    fps: track.nb_samples / (track.duration / track.timescale),
  }));

  const audioStreams: AudioStreamInfo[] = info.audioTracks.map((track) => {
    const stream: AudioStreamInfo = {
      id: track.id,
      codecDetail: track.codec,
      codec: toAudioCodecType(track.codec),
      channelCount: track.audio?.channel_count,
      sampleRate: track.audio?.sample_rate,
      bitrate: track.bitrate,
      durationInSeconds: track.duration / track.timescale,
    };

    if (mp4file && stream.codec === 'aac') {
      const moov = mp4file.moov;
      if (moov && moov.traks) {
        const trak = moov.traks.find((t: any) => t.tkhd && t.tkhd.track_id === track.id);
        if (trak?.mdia?.minf?.stbl?.stsd) {
          const entry = trak.mdia.minf.stbl.stsd.entries[0];

          // Try to find ESDS - it can be directly in the entry (MP4) or in a wave box (MOV)
          let esds = (entry as any)?.esds;

          // For MOV files, ESDS is often nested in a wave box
          if (!esds && (entry as any)?.wave?.boxes) {
            esds = (entry as any).wave.boxes.find((b: any) => b.type === 'esds');
          }

          if (esds?.esd?.getAudioConfig) {
            const esd = esds.esd as ES_Descriptor;
            const aot = esd.getAudioConfig();
            stream.profile = getAacProfileName(aot);
          }
        }
      }
    }

    return stream;
  });

  return {
    parser: 'mp4box',
    containerDetail: info.brands.join(', '),
    container: toContainerType(info.brands),
    durationInSeconds: info.duration / info.timescale,
    videoStreams,
    audioStreams,
    mimeType: info.mime,
  };
}
