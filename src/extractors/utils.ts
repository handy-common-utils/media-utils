/**
 * Find the audio stream to be extracted in the media information based on the options
 * @param mediaInfo Media information
 * @param options Extraction options
 * @param options.trackId Track ID of the audio stream to be extracted. This is the ID of the track/stream in the media information
 * @param options.streamIndex Index of the audio stream to be extracted. This is the index of the track/stream in array of audio streams in the media information
 * @returns Audio stream to be extracted
 * @throws Error if the audio stream to be extracted is not found
 */
export function findAudioStreamToBeExtracted<S extends { id: number }, M extends { audioStreams: Array<S> }>(
  mediaInfo: M,
  options: { trackId?: number; streamIndex?: number },
): M['audioStreams'][number] {
  let stream: M['audioStreams'][number];

  if (!Array.isArray(mediaInfo?.audioStreams) || mediaInfo.audioStreams.length === 0) {
    throw new Error('No audio streams/tracks found');
  }

  if (options?.trackId) {
    const streamFound = mediaInfo.audioStreams.find((t: any) => t.id === options.trackId);
    if (!streamFound) {
      throw new Error(
        `Audio stream/track with ID ${options.trackId} not found. Available track IDs: ${mediaInfo.audioStreams.map((t: any) => t.id).join(', ')}`,
      );
    }
    stream = streamFound;
  } else {
    const streamIndex = options?.streamIndex ?? 0;
    if (streamIndex >= mediaInfo.audioStreams.length) {
      throw new Error(
        `Audio stream/track index ${streamIndex} not found. Available streams/tracks indexes: 0 - ${mediaInfo.audioStreams.length - 1}`,
      );
    }
    stream = mediaInfo.audioStreams[streamIndex];
  }

  return stream;
}
