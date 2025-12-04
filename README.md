# @handy-common-utils/media-utils

A pure-JS, no-FFmpeg media info parser and audio stream extractor which works with popular formats and codecs.
It runs well in both browser and Node.js environments.

[![Version](https://img.shields.io/npm/v/@handy-common-utils/media-utils.svg)](https://npmjs.org/package/@handy-common-utils/media-utils)
[![Downloads/week](https://img.shields.io/npm/dw/@handy-common-utils/media-utils.svg)](https://npmjs.org/package/@handy-common-utils/media-utils)
[![CI](https://github.com/handy-common-utils/media-utils/actions/workflows/ci.yml/badge.svg)](https://github.com/handy-common-utils/media-utils/actions/workflows/ci.yml)

## Getting Media Information

This library provides a unified interface to extract media information (duration, video/audio streams, codecs, etc.) from various media formats. It can use its own lightweight in-house parsers or several 3rd party parsers (`mp4box`, `codem-isoboxer`, `@remotion/media-parser`). Those 3rd party parsers are optional dependencies of this library.

### Key Features

- **Unified API**: Get consistent `MediaInfo` object regardless of the parser used.
- **Browser & Node.js**: Works in both environments (file system helpers are Node.js only).
- **Smart Fallback**: The `auto` mode tries parsers in this order:
  1. `media-utils` (this library): Fast, lightweight, for raw AAC/MP3/WAV/OGG/WMA audio files as well as MKV/WebM/ASF/WMV containers.
  2. `mp4box`: [mp4box](https://www.npmjs.com/package/mp4box), handles only MP4/MOV containers.
  3. `isoboxer`: [codem-isoboxer](https://www.npmjs.com/package/codem-isoboxer), handles only MP4/MOV containers.
  4. `remotion`: [@remotion/media-parser](https://www.npmjs.com/package/@remotion/media-parser), handles some popular containers.

### Verified Combinations for getMediaInfo by parser

| Format              | Codecs (Video/Audio) | `auto` | `media-utils` | `mp4box` | `isoboxer` | `remotion` |
| :------------------ | :------------------- | :----: | :-----------: | :------: | :--------: | :--------: |
| **MP4**             | H.264 / AAC          |   ✅   |      ❌       |    ✅    |     ✅     |     ✅     |
| **MP4**             | H.264 / MP3          |   ✅   |      ❌       |    ✅    |     ✅     |     ✅     |
| **MOV**             | H.264 / AAC          |   ✅   |      ❌       |    ✅    |     ✅     |     ✅     |
| **MOV**             | H.264 / MP3          |   ✅   |      ❌       |    ✅    |     ✅     |     ❌     |
| **WebM**            | VP8 / Vorbis         |   ✅   |      ✅       |    ❌    |     ❌     |     ✅     |
| **WebM**            | VP9 / Opus           |   ✅   |      ✅       |    ❌    |     ❌     |     ✅     |
| **WebM**            | VP9 / Vorbis         |   ✅   |      ✅       |    ❌    |     ❌     |     ✅     |
| **WebM**            | AV1 / Opus           |   ✅   |      ✅       |    ❌    |     ❌     |     ❌     |
| **MKV**             | MSMPEG4v2 / MP3      |   ✅   |      ✅       |    ❌    |     ❌     |     ❌     |
| **MKV**             | H.264 / AAC          |   ✅   |      ✅       |    ❌    |     ❌     |     ✅     |
| **MKV**             | H.264 / MP3          |   ✅   |      ✅       |    ❌    |     ❌     |     ✅     |
| **MKV** (streaming) | THEORA / Vorbis      |   ✅   |      ✅       |    ❌    |     ❌     |     ❌     |
| **WMV**             | WMV2 / WMAv2         |   ✅   |      ✅       |    ❌    |     ❌     |     ❌     |
| **AVI**             | MJPEG / PCM          |   ✅   |      ✅       |    ❌    |     ❌     |     ❌     |
| **AVI**             | H.264 / PCM          |   ✅   |      ✅       |    ❌    |     ❌     |     ❌     |
| **M2TS**            | MPEG2 / MP2          |   ❌   |      ❌       |    ❌    |     ❌     |     ❌     |
| **AAC**             | AAC                  |   ✅   |      ✅       |    ❌    |     ❌     |     ✅     |
| **MP3**             | MP3                  |   ✅   |      ✅       |    ❌    |     ❌     |     ✅     |
| **OGG**             | Opus                 |   ✅   |      ✅       |    ❌    |     ❌     |     ❌     |
| **OGG**             | Vorbis               |   ✅   |      ✅       |    ❌    |     ❌     |     ❌     |
| **WAV**             | PCM                  |   ✅   |      ✅       |    ❌    |     ❌     |     ❌     |
| **WMA**             | WMAv2                |   ✅   |      ✅       |    ❌    |     ❌     |     ❌     |

Note: For streaming MKV, no stream details are available.

### Optional Dependencies

If you don't have those optional dependencies in use already, the recommendation is to install `mp4box` together with this package.

```shell
npm install @handy-common-utils/media-utils mp4box
```

This library will pick optional dependencies automatically if they are installed.

### Example

```typescript
import { getMediaInfoFromFile } from '@handy-common-utils/media-utils';

// Automatically choose the best parser (default behavior)
// If no parser is specified, 'auto' mode will try available parsers in order
const info = await getMediaInfoFromFile('path/to/video.mp4');
console.log(`Duration: ${info.durationInSeconds}s`);
console.log(`Video: ${info.videoStreams[0]?.codec}`);
console.log(`Audio: ${info.audioStreams[0]?.codec}`);

// Force a specific parser
const infoMp4Box = await getMediaInfoFromFile('path/to/video.mp4', { useParser: 'mp4box' });
```

## Extracting Audio Stream

You can extract audio streams from video files (MP4, MOV, MKV/WebM, ASF/WMV, AVI) without re-encoding. This is fast and preserves original quality.

### Verified Combinations for extractAudio

| Source Format | Source Codecs (Video/Audio) | Extracted Format | Supported |
| :------------ | :-------------------------- | :--------------- | :-------: |
| **MP4**       | H.264 / AAC                 | AAC              |    ✅     |
| **MP4**       | H.264 / MP3                 | MP3              |    ✅     |
| **MOV**       | H.264 / AAC                 | AAC              |    ✅     |
| **MOV**       | H.264 / MP3                 | MP3              |    ✅     |
| **WebM**      | VP9 / Opus                  | OGG (Opus)       |    ✅     |
| **WebM**      | VP9 / Vorbis                | OGG (Vorbis)     |    ✅     |
| **MKV**       | H.264 / AAC                 | AAC              |    ✅     |
| **MKV**       | MSMPEG4v2 / MP3             | MP3              |    ✅     |
| **AVI**       | MJPEG / PCM                 | WAV              |    ✅     |
| **AVI**       | H.264 / PCM                 | WAV              |    ✅     |
| **WMV**       | WMV2 / WMAv2                | WMA              |    ✅     |

### Dependencies

`extractAudio` requires `mp4box` to be installed.

```shell
npm install @handy-common-utils/media-utils mp4box
```

### Example

```typescript
import { extractAudioFromFileToFile } from '@handy-common-utils/media-utils';

// Extract the first audio track to a new file
// If neither trackId nor streamIndex is specified, the first audio stream/track will be extracted
await extractAudioFromFileToFile('input-video.mp4', 'output-audio.aac');

// Advanced usage with streams and options
import { extractAudio, createReadableStreamFromFile } from '@handy-common-utils/media-utils';
import fs from 'node:fs';
import { Writable } from 'node:stream';

const inputStream = await createReadableStreamFromFile('input.mov');
const outputStream = Writable.toWeb(fs.createWriteStream('output.mp3'));

await extractAudio(inputStream, outputStream, {
  trackId: 2, // Optional: specify track ID (takes precedence over streamIndex)
  // streamIndex: 0, // Optional: specify the index in all audio streams (0-based)
});
```

## Utility Functions

This library exports several utility functions to help you work with media streams in Node.js environments.

### `createReadableStreamFromFile(filePath: string)`

Creates a Web `ReadableStream` from a Node.js file path. This is useful when you need to convert a file into a stream for processing.

**Note**: This function only works in Node.js, not in browsers.

```typescript
import { createReadableStreamFromFile } from '@handy-common-utils/media-utils';

const stream = await createReadableStreamFromFile('path/to/media.mp4');
// Use the stream with getMediaInfo or extractAudio
```

**Important**: The caller is responsible for properly consuming or cancelling the returned stream to ensure the underlying file handle is released. If the stream is not fully consumed, call `stream.cancel()` to clean up resources.

### `readFromStreamToFile(stream: ReadableStream<Uint8Array>, filePath: string)`

Reads a Web `ReadableStream` and writes it to a file. This is useful for saving processed streams back to disk.

**Note**: This function only works in Node.js, not in browsers.

```typescript
import { readFromStreamToFile } from '@handy-common-utils/media-utils';

// Assuming you have a ReadableStream from some processing
await readFromStreamToFile(myStream, 'path/to/output.mp4');
```

The function automatically creates the output directory if it doesn't exist.

# API

<!-- API start -->

<a name="readmemd"></a>

## @handy-common-utils/media-utils

### Modules

| Module                                    | Description |
| ----------------------------------------- | ----------- |
| [extract-audio](#extract-audioreadmemd)   | -           |
| [get-media-info](#get-media-inforeadmemd) | -           |
| [index](#indexreadmemd)                   | -           |
| [media-info](#media-inforeadmemd)         | -           |
| [utils](#utilsreadmemd)                   | -           |

## Extract Audio

<a id="extract-audioreadmemd"></a>

### extract-audio

#### Interfaces

| Interface                                                            | Description |
| -------------------------------------------------------------------- | ----------- |
| [ExtractAudioOptions](#extract-audiointerfacesextractaudiooptionsmd) | -           |

#### Functions

| Function                                                                          | Description                                                                                                                   |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [extractAudio](#extract-audiofunctionsextractaudiomd)                             | Extract raw audio data from the input                                                                                         |
| [extractAudioFromFile](#extract-audiofunctionsextractaudiofromfilemd)             | Extract raw audio data from a file This function works in Node.js environment but not in browser.                             |
| [extractAudioFromFileToFile](#extract-audiofunctionsextractaudiofromfiletofilemd) | Extract raw audio data from a file and write to an output file This function works in Node.js environment but not in browser. |

### Functions

<a id="extract-audiofunctionsextractaudiomd"></a>

#### Function: extractAudio()

> **extractAudio**(`input`, `output`, `optionsInput?`): `Promise`\<`void`\>

Extract raw audio data from the input

##### Parameters

| Parameter       | Type                                                                   | Description                                       |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| `input`         | `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>                  | The input data provided through a readable stream |
| `output`        | `WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>                  | The output stream to write extracted audio to     |
| `optionsInput?` | [`ExtractAudioOptions`](#extract-audiointerfacesextractaudiooptionsmd) | Options for the extraction process                |

##### Returns

`Promise`\<`void`\>

<a id="extract-audiofunctionsextractaudiofromfilemd"></a>

#### Function: extractAudioFromFile()

> **extractAudioFromFile**(`filePath`, `output`, `options?`): `Promise`\<`void`\>

Extract raw audio data from a file
This function works in Node.js environment but not in browser.

##### Parameters

| Parameter  | Type                                                                   | Description                                   |
| ---------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| `filePath` | `string`                                                               | The path to the media file                    |
| `output`   | `WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>                  | The output stream to write extracted audio to |
| `options?` | [`ExtractAudioOptions`](#extract-audiointerfacesextractaudiooptionsmd) | Options for the extraction process            |

##### Returns

`Promise`\<`void`\>

<a id="extract-audiofunctionsextractaudiofromfiletofilemd"></a>

#### Function: extractAudioFromFileToFile()

> **extractAudioFromFileToFile**(`inputFilePath`, `outputFilePath`, `options?`): `Promise`\<`void`\>

Extract raw audio data from a file and write to an output file
This function works in Node.js environment but not in browser.

##### Parameters

| Parameter        | Type                                                                   | Description                        |
| ---------------- | ---------------------------------------------------------------------- | ---------------------------------- |
| `inputFilePath`  | `string`                                                               | The path to the input media file   |
| `outputFilePath` | `string`                                                               | The path to the output audio file  |
| `options?`       | [`ExtractAudioOptions`](#extract-audiointerfacesextractaudiooptionsmd) | Options for the extraction process |

##### Returns

`Promise`\<`void`\>

### Interfaces

<a id="extract-audiointerfacesextractaudiooptionsmd"></a>

#### Interface: ExtractAudioOptions

##### Properties

| Property                                    | Type      | Description                                                                                                                                                                                                           |
| ------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="api-quiet"></a> `quiet?`             | `boolean` | Whether to suppress console output. Default value is true.                                                                                                                                                            |
| <a id="api-streamindex"></a> `streamIndex?` | `number`  | The index of the stream/track to extract audio from. If this option is provided, `trackId` is ignored. If `trackId` is not provided and this option is not specified, the first audio stream/track will be extracted. |
| <a id="api-trackid"></a> `trackId?`         | `number`  | The ID of the track to extract audio from If this option is provided, `streamIndex` is ignored. If both `trackId` and `streamIndex` are not provided, the first audio stream/track will be extracted.                 |

## Get Media Info

<a id="get-media-inforeadmemd"></a>

### get-media-info

#### Type Aliases

| Type Alias                                                              | Description |
| ----------------------------------------------------------------------- | ----------- |
| [GetMediaInfoOptions](#get-media-infotype-aliasesgetmediainfooptionsmd) | -           |

#### Functions

| Function                                                               | Description                                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [getMediaInfo](#get-media-infofunctionsgetmediainfomd)                 | Get media information from a stream                                                                    |
| [getMediaInfoFromFile](#get-media-infofunctionsgetmediainfofromfilemd) | Get media information from a file path. This function works in Node.js environment but not in browser. |

### Functions

<a id="get-media-infofunctionsgetmediainfomd"></a>

#### Function: getMediaInfo()

> **getMediaInfo**(`stream`, `optionsInput?`): `Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd) & `object`\>

Get media information from a stream

##### Parameters

| Parameter       | Type                                                                      | Description                                                                                                                             |
| --------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `stream`        | `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>                     | The input Web ReadableStream (not Node Readable). To convert a Node Readable to Web ReadableStream, use `Readable.toWeb(nodeReadable)`. |
| `optionsInput?` | [`GetMediaInfoOptions`](#get-media-infotype-aliasesgetmediainfooptionsmd) | Options for the parser                                                                                                                  |

##### Returns

`Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd) & `object`\>

The media information

<a id="get-media-infofunctionsgetmediainfofromfilemd"></a>

#### Function: getMediaInfoFromFile()

> **getMediaInfoFromFile**(`filePath`, `options?`): `Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd)\>

Get media information from a file path.
This function works in Node.js environment but not in browser.

##### Parameters

| Parameter  | Type                                                                      | Description                |
| ---------- | ------------------------------------------------------------------------- | -------------------------- |
| `filePath` | `string`                                                                  | The path to the media file |
| `options?` | [`GetMediaInfoOptions`](#get-media-infotype-aliasesgetmediainfooptionsmd) | Options for the parser     |

##### Returns

`Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd)\>

The media information

### Type Aliases

<a id="get-media-infotype-aliasesgetmediainfooptionsmd"></a>

#### Type Alias: GetMediaInfoOptions

> **GetMediaInfoOptions** = [`ParserRelatedOptions`](#utilsinterfacesparserrelatedoptionsmd) & `object`

##### Type Declaration

| Name     | Type      | Description                                                |
| -------- | --------- | ---------------------------------------------------------- |
| `quiet?` | `boolean` | Whether to suppress console output. Default value is true. |

## Index

<a id="indexreadmemd"></a>

### index

#### References

<a id="api-audiocodectype"></a>

##### AudioCodecType

Re-exports [AudioCodecType](#media-infotype-aliasesaudiocodectypemd)

---

<a id="api-audiostreaminfo"></a>

##### AudioStreamInfo

Re-exports [AudioStreamInfo](#media-infointerfacesaudiostreaminfomd)

---

<a id="api-containertype"></a>

##### ContainerType

Re-exports [ContainerType](#media-infotype-aliasescontainertypemd)

---

<a id="api-createreadablestreamfromfile"></a>

##### createReadableStreamFromFile

Re-exports [createReadableStreamFromFile](#utilsfunctionscreatereadablestreamfromfilemd)

---

<a id="api-extractaudio"></a>

##### extractAudio

Re-exports [extractAudio](#extract-audiofunctionsextractaudiomd)

---

<a id="api-extractaudiofromfile"></a>

##### extractAudioFromFile

Re-exports [extractAudioFromFile](#extract-audiofunctionsextractaudiofromfilemd)

---

<a id="api-extractaudiofromfiletofile"></a>

##### extractAudioFromFileToFile

Re-exports [extractAudioFromFileToFile](#extract-audiofunctionsextractaudiofromfiletofilemd)

---

<a id="api-extractaudiooptions"></a>

##### ExtractAudioOptions

Re-exports [ExtractAudioOptions](#extract-audiointerfacesextractaudiooptionsmd)

---

<a id="api-getmediainfo"></a>

##### getMediaInfo

Re-exports [getMediaInfo](#get-media-infofunctionsgetmediainfomd)

---

<a id="api-getmediainfofromfile"></a>

##### getMediaInfoFromFile

Re-exports [getMediaInfoFromFile](#get-media-infofunctionsgetmediainfofromfilemd)

---

<a id="api-getmediainfooptions"></a>

##### GetMediaInfoOptions

Re-exports [GetMediaInfoOptions](#get-media-infotype-aliasesgetmediainfooptionsmd)

---

<a id="api-mediainfo"></a>

##### MediaInfo

Re-exports [MediaInfo](#media-infointerfacesmediainfomd)

---

<a id="api-parserrelatedoptions"></a>

##### ParserRelatedOptions

Re-exports [ParserRelatedOptions](#utilsinterfacesparserrelatedoptionsmd)

---

<a id="api-readfromstreamtofile"></a>

##### readFromStreamToFile

Re-exports [readFromStreamToFile](#utilsfunctionsreadfromstreamtofilemd)

---

<a id="api-videocodectype"></a>

##### VideoCodecType

Re-exports [VideoCodecType](#media-infotype-aliasesvideocodectypemd)

---

<a id="api-videostreaminfo"></a>

##### VideoStreamInfo

Re-exports [VideoStreamInfo](#media-infointerfacesvideostreaminfomd)

## Media Info

<a id="media-inforeadmemd"></a>

### media-info

#### Interfaces

| Interface                                                 | Description |
| --------------------------------------------------------- | ----------- |
| [AudioStreamInfo](#media-infointerfacesaudiostreaminfomd) | -           |
| [MediaInfo](#media-infointerfacesmediainfomd)             | -           |
| [VideoStreamInfo](#media-infointerfacesvideostreaminfomd) | -           |

#### Type Aliases

| Type Alias                                                | Description |
| --------------------------------------------------------- | ----------- |
| [AudioCodecType](#media-infotype-aliasesaudiocodectypemd) | -           |
| [ContainerType](#media-infotype-aliasescontainertypemd)   | -           |
| [VideoCodecType](#media-infotype-aliasesvideocodectypemd) | -           |

### Interfaces

<a id="media-infointerfacesaudiostreaminfomd"></a>

#### Interface: AudioStreamInfo

##### Properties

| Property                                                | Type                    | Description                       |
| ------------------------------------------------------- | ----------------------- | --------------------------------- |
| <a id="api-bitrate"></a> `bitrate?`                     | `number`                | -                                 |
| <a id="api-channelcount"></a> `channelCount?`           | `number`                | -                                 |
| <a id="api-codec"></a> `codec`                          | `MediaParserAudioCodec` | -                                 |
| <a id="api-codecdetail"></a> `codecDetail?`             | `string`                | Parser-specific codec information |
| <a id="api-durationinseconds"></a> `durationInSeconds?` | `number`                | -                                 |
| <a id="api-id"></a> `id`                                | `number`                | -                                 |
| <a id="api-profile"></a> `profile?`                     | `string`                | -                                 |
| <a id="api-samplerate"></a> `sampleRate?`               | `number`                | -                                 |

<a id="media-infointerfacesmediainfomd"></a>

#### Interface: MediaInfo

##### Properties

| Property                                                | Type                                                                      | Description                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------- |
| <a id="api-audiostreams"></a> `audioStreams`            | [`AudioStreamInfo`](#media-infointerfacesaudiostreaminfomd)[]             | -                                     |
| <a id="api-container"></a> `container`                  | `MediaParserContainer`                                                    | -                                     |
| <a id="api-containerdetail"></a> `containerDetail?`     | `string`                                                                  | Parser-specific container information |
| <a id="api-durationinseconds"></a> `durationInSeconds?` | `number`                                                                  | -                                     |
| <a id="api-mimetype"></a> `mimeType?`                   | `string`                                                                  | -                                     |
| <a id="api-parser"></a> `parser`                        | `"mp4box"` \| `"remotion"` \| `"isoboxer"` \| `"media-utils"` \| `"auto"` | -                                     |
| <a id="api-videostreams"></a> `videoStreams`            | [`VideoStreamInfo`](#media-infointerfacesvideostreaminfomd)[]             | -                                     |

<a id="media-infointerfacesvideostreaminfomd"></a>

#### Interface: VideoStreamInfo

##### Properties

| Property                                                | Type                    | Description                       |
| ------------------------------------------------------- | ----------------------- | --------------------------------- |
| <a id="api-bitrate"></a> `bitrate?`                     | `number`                | -                                 |
| <a id="api-codec"></a> `codec`                          | `MediaParserVideoCodec` | -                                 |
| <a id="api-codecdetail"></a> `codecDetail?`             | `string`                | Parser-specific codec information |
| <a id="api-durationinseconds"></a> `durationInSeconds?` | `number`                | -                                 |
| <a id="api-fps"></a> `fps?`                             | `number`                | -                                 |
| <a id="api-height"></a> `height`                        | `number`                | -                                 |
| <a id="api-id"></a> `id`                                | `number`                | -                                 |
| <a id="api-width"></a> `width`                          | `number`                | -                                 |

### Type Aliases

<a id="media-infotype-aliasesaudiocodectypemd"></a>

#### Type Alias: AudioCodecType

> **AudioCodecType** = `MediaParserAudioCodec`

<a id="media-infotype-aliasescontainertypemd"></a>

#### Type Alias: ContainerType

> **ContainerType** = `MediaParserContainer`

<a id="media-infotype-aliasesvideocodectypemd"></a>

#### Type Alias: VideoCodecType

> **VideoCodecType** = `MediaParserVideoCodec`

## Utils

<a id="utilsreadmemd"></a>

### utils

#### Interfaces

| Interface                                                      | Description |
| -------------------------------------------------------------- | ----------- |
| [ParserRelatedOptions](#utilsinterfacesparserrelatedoptionsmd) | -           |

#### Functions

| Function                                                                      | Description                                                                                                           |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [createReadableStreamFromFile](#utilsfunctionscreatereadablestreamfromfilemd) | Creates a Web ReadableStream from a Node.js file path. This function works in Node.js environment but not in browser. |
| [readFromStreamToFile](#utilsfunctionsreadfromstreamtofilemd)                 | Reads a Web ReadableStream and writes it to a file. This function works in Node.js environment but not in browser.    |

### Functions

<a id="utilsfunctionscreatereadablestreamfromfilemd"></a>

#### Function: createReadableStreamFromFile()

> **createReadableStreamFromFile**(`filePath`): `Promise`\<`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>\>

Creates a Web ReadableStream from a Node.js file path.
This function works in Node.js environment but not in browser.

**Important:** The caller is responsible for properly consuming or cancelling
the returned stream to ensure the underlying file handle is released.
If the stream is not fully consumed, call `stream.cancel()` to clean up resources.

##### Parameters

| Parameter  | Type     | Description          |
| ---------- | -------- | -------------------- |
| `filePath` | `string` | The path to the file |

##### Returns

`Promise`\<`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>\>

A (web) ReadableStream of Uint8Array chunks

<a id="utilsfunctionsreadfromstreamtofilemd"></a>

#### Function: readFromStreamToFile()

> **readFromStreamToFile**(`stream`, `filePath`): `Promise`\<`void`\>

Reads a Web ReadableStream and writes it to a file.
This function works in Node.js environment but not in browser.

##### Parameters

| Parameter  | Type                                                  | Description                      |
| ---------- | ----------------------------------------------------- | -------------------------------- |
| `stream`   | `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\> | The readable stream to read from |
| `filePath` | `string`                                              | The path to the file to write to |

##### Returns

`Promise`\<`void`\>

### Interfaces

<a id="utilsinterfacesparserrelatedoptionsmd"></a>

#### Interface: ParserRelatedOptions

##### Properties

| Property                                | Type                                                                      | Description                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="api-useparser"></a> `useParser?` | `"mp4box"` \| `"remotion"` \| `"isoboxer"` \| `"media-utils"` \| `"auto"` | Which parser library/package to use The default is 'auto', which will try to use mp4box first and fallback to remotion if mp4box fails. |

<!-- API end -->
