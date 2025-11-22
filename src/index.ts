export * from "./get-media-info";
export * from "./media-info";

/**
 * Extract raw audio data from the input
 * @param _input The input data provided through a readable stream
 * @param _audioStreamIndex Index of the audio stream to extract from the input
 * @returns The audio data extracted, as a readable stream
 */
export async function extractAudio(
  _input: ReadableStream,
  _audioStreamIndex?: number,
): Promise<ReadableStream> {
  return null as any;
}
