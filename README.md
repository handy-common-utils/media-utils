# extract-audio

A pure-JS, no-FFmpeg audio-extractor which works with popular media formats and audio codecs.

# API

<!-- API start -->

<a name="extractaudiomd"></a>

## Function: extractAudio()

> **extractAudio**(`_input`, `_audioStreamIndex?`): `Promise`\<`ReadableStream`\<`any`\>\>

Extract raw audio data from the input

### Parameters

| Parameter            | Type             | Description                                         |
| -------------------- | ---------------- | --------------------------------------------------- |
| `_input`             | `ReadableStream` | The input data provided through a readable stream   |
| `_audioStreamIndex?` | `number`         | Index of the audio stream to extract from the input |

### Returns

`Promise`\<`ReadableStream`\<`any`\>\>

The audio data extracted, as a readable stream

<!-- API end -->
