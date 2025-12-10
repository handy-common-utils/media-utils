# @handy-common-utils/media-utils

A **pure-JavaScript** library for efficiently parsing media information and extracting audio streams.
It works with **all popular formats and codecs** directly in the **browser and Node.js**,
without relying on external binaries like FFmpeg or WASM.

[![Version](https://img.shields.io/npm/v/@handy-common-utils/media-utils.svg)](https://npmjs.org/package/@handy-common-utils/media-utils)
[![Downloads/week](https://img.shields.io/npm/dw/@handy-common-utils/media-utils.svg)](https://npmjs.org/package/@handy-common-utils/media-utils)
[![CI](https://github.com/handy-common-utils/media-utils/actions/workflows/ci.yml/badge.svg)](https://github.com/handy-common-utils/media-utils/actions/workflows/ci.yml)

## Why Use @handy-common-utils/media-utils?

- **Pure JavaScript**: No reliance on FFmpeg, WASM, or any 3rd party media parsing or processing tools or packages.
- **Universal Compatibility**: Runs flawlessly in both Node.js and Browser environments.
- **Wide Format Support**: Supports all popular container formats (MP4, MKV, WebM, MOV, AVI, WMV, MPEG-TS, etc.) and audio/video codecs.
- **Convenient API**: Easily process data from Web Streams, Node.js Streams, and Node.js file systems.
- **Fast Audio Extraction**: Extract audio streams from video files without re-encoding to preserve quality and speed.

## Installation

```shell
npm install @handy-common-utils/media-utils
```

## Getting Media Information

Use `getMediaInfo()` to extract crucial metadata like duration, stream details (video/audio), and codec information from any supported media format. All popular container formats and audio/video codecs are supported.

`getMediaInfo()` works with Web Streams. If you'd like to use Node.js Stream or Node.js file system, try `Readable.toWeb()` or `getMediaInfoFromFile()`.

### Example: Quick Start

```typescript
import { getMediaInfoFromFile } from '@handy-common-utils/media-utils';

// Read from a file path (Node.js only)
const info = await getMediaInfoFromFile('path/to/video.mp4');

console.log(JSON.stringify(info, null, 2));
//   {
//     parser: 'media-utils',
//     container: 'mp4',
//     containerDetail: 'mp42, isom, mp42',
//     durationInSeconds: 734,
//     videoStreams: [
//       {
//         id: 1,
//         codec: 'h264',
//         codecDetail: 'avc1.64001f',
//         width: 1280,
//         height: 534,
//         fps: 24,
//         bitrate: 1830000,
//         durationInSeconds: 734,
//       },
//     ],
//     audioStreams: [
//       {
//         id: 2,
//         codec: 'aac',
//         codecDetail: 'mp4a.40.02',
//         profile: 'LC',
//         channelCount: 2,
//         sampleRate: 44100,
//         bitrate: 192000,
//         durationInSeconds: 734,
//       },
//     ],
//   }
```

### Verified Combinations

This table lists the combinations verified by our test suite.

<!-- getMediaInfo table start -->

| Format/Container | Video Codec | Audio Codec(s) | File Remark | Supported |
| :--------------- | :---------- | :------------- | :---------- | :-------: |
| **aac**          |             | aac            |             |    ✅     |
| **asf**          |             | wmav2          |             |    ✅     |
| **asf**          | wmv2        | wmav2          |             |    ✅     |
| **avi**          | h264        | pcm_s16le      |             |    ✅     |
| **avi**          | mjpeg       | pcm_s16le      |             |    ✅     |
| **avi**          | mpeg4       | ac3            | 5 channels  |    ✅     |
| **mkv**          | h264        | aac, aac       |             |    ✅     |
| **mkv**          | h264        | aac            |             |    ✅     |
| **mkv**          | h264        | mp3            |             |    ✅     |
| **mkv**          | msmpeg4v2   | mp3            |             |    ✅     |
| **mkv**          |             |                | streaming   |    ✅     |
| **mov**          | h264        | aac            |             |    ✅     |
| **mov**          | h264        | mp3            |             |    ✅     |
| **mp3**          |             | mp3            |             |    ✅     |
| **mp4**          | h264        | aac            |             |    ✅     |
| **mp4**          | h264        | mp3            |             |    ✅     |
| **mpegts**       | mpeg2video  | mp2            |             |    ✅     |
| **ogg**          |             | opus           |             |    ✅     |
| **ogg**          |             | vorbis         |             |    ✅     |
| **wav**          |             | pcm_s16le      |             |    ✅     |
| **webm**         | av1         | opus           |             |    ✅     |
| **webm**         | vp8         | vorbis         |             |    ✅     |
| **webm**         | vp9         | opus           |             |    ✅     |
| **webm**         | vp9         | vorbis         |             |    ✅     |

<!-- getMediaInfo table end -->

Note: For streaming MKV, no stream details are available.

### Integration with Third-Party Parsers (Optional)

While `@handy-common-utils/media-utils` provides built-in support for all popular formats,
it can also automatically integrate with other well-known Javascript parsers as a fallback or for specific needs.

- `media-utils` (built-in): This is the recommended default, all popular formats are supported.
- `mp4box`: [mp4box](https://www.npmjs.com/package/mp4box), handles only MP4/MOV containers.
- `isoboxer`: [codem-isoboxer](https://www.npmjs.com/package/codem-isoboxer), handles only MP4/MOV containers.
- `remotion`: [@remotion/media-parser](https://www.npmjs.com/package/@remotion/media-parser), handles more formats

If you install any of these packages, `getMediaInfo()` will use them as a fallback mechanism.

To force a specific parser, use the `useParser` option:

```typescript
// Force mp4box parser (must be installed separately)
const infoMp4Box = await getMediaInfoFromFile('path/to/video.mp4', { useParser: 'mp4box' });

// Use built-in parser and fall back to others ('auto' is the default if not specified)
const infoAuto = await getMediaInfoFromFile('path/to/video.mp4', { useParser: 'auto' });
```

## Extracting Audio Stream

The `extractAudio()` function allows you to extract an audio stream from a video container
(MP4, MOV, MKV, AVI, etc.) without re-encoding.
This process is extremely fast and preserves the original audio quality and codec.

`extractAudio()` works with Web Streams. If you'd like to use Node.js Stream or Node.js file system,
try `Readable.toWeb()`, `Writable.toWeb`, `extractAudioFromFile()` or `extractAudioFromFileToFile()`.

### Example: Extracting to File

```typescript
import { extractAudioFromFileToFile } from '@handy-common-utils/media-utils';

// Extracts the first audio stream and writes it to a new file.
// The output format is automatically determined by the extracted audio codec.
await extractAudioFromFileToFile('input-video.mp4', 'output-audio.aac');
```

### Verified Extraction Combinations

<!-- extractAudio table start -->

| Format/Container | Video Codec | Audio Codec(s) | File Remark | Supported | Extracted Audio          |
| :--------------- | :---------- | :------------- | :---------- | :-------: | :----------------------- |
| **asf**          | wmv2        | wmav2          |             |    ✅     | **wmav2** in **asf**     |
| **avi**          | h264        | adpcm_ms       |             |    ✅     | **adpcm_ms** in **wav**  |
| **avi**          | h264        | pcm_s16le      |             |    ✅     | **pcm_s16le** in **wav** |
| **avi**          | h264        | pcm_u8         |             |    ✅     | **pcm_u8** in **wav**    |
| **avi**          | mjpeg       | pcm_s16le      |             |    ✅     | **pcm_s16le** in **wav** |
| **mkv**          | h264        | aac            |             |    ✅     | **aac** in **aac**       |
| **mkv**          | msmpeg4v2   | mp3            |             |    ✅     | **mp3** in **mp3**       |
| **mov**          | h264        | aac            |             |    ✅     | **aac** in **aac**       |
| **mov**          | h264        | mp3            |             |    ✅     | **mp3** in **mp3**       |
| **mp4**          | h264        | aac            |             |    ✅     | **aac** in **aac**       |
| **mp4**          | h264        | mp3            |             |    ✅     | **mp3** in **mp3**       |
| **mpegts**       | h264        | aac            |             |    ✅     | **aac** in **aac**       |
| **mpegts**       | h264        | mp3            |             |    ✅     | **mp3** in **mp3**       |
| **mpegts**       | mpeg2video  | mp2            |             |    ✅     | **mp2** in **mp3**       |
| **webm**         | vp9         | opus           |             |    ✅     | **opus** in **ogg**      |
| **webm**         | vp9         | vorbis         |             |    ✅     | **vorbis** in **ogg**    |

<!-- extractAudio table end -->

### Advanced Usage: Stream-to-Stream

You can use the core `extractAudio()` function for greater control over input and output streams:

```typescript
import { extractAudio, createReadableStreamFromFile } from '@handy-common-utils/media-utils';
import fs from 'node:fs';
import { Writable } from 'node:stream';

const inputStream = await createReadableStreamFromFile('input.mov');
// Use a Node.js Writable Stream, converted to a Web WritableStream
const outputStream = Writable.toWeb(fs.createWriteStream('output.mp3'));

await extractAudio(inputStream, outputStream, {
  // Optional: Specify which track to extract (trackId takes precedence)
  trackId: 2,
  // streamIndex: 0,
});
```

## Logging Control

The verbosity of the library can be controlled through function options and environment variables.

### Options

Both `getMediaInfo` and `extractAudio` accept logging options:

- `quiet` (boolean): Suppresses all console output. Default: `true`.
- `debug` (boolean): Enables detailed debug logging. Default: `false`.

```typescript
// Enable debug logs for troubleshooting
await getMediaInfoFromFile('video.mp4', { quiet: false, debug: true });
```

**Note**: If `quiet` is `true`, debug logging is automatically disabled.

### Environment Variables

Environment variables take precedence over function options.

- `MEDIA_UTILS_LOG_QUIET`: Set to 'true' or 'false' to control quiet mode.
- `MEDIA_UTILS_LOG_DEBUG`: Set to 'true' or 'false' to control debug logging.

```bash
MEDIA_UTILS_LOG_QUIET=false MEDIA_UTILS_LOG_DEBUG=true node my-script.js
```

## Utility Functions (Node.js Only)

These functions are provided to help integrate Node.js filesystem operations with the library's Web Stream-based API.

### `createReadableStreamFromFile(filePath: string)`

Creates a Web `ReadableStream` from a Node.js file path.

```typescript
import { createReadableStreamFromFile } from '@handy-common-utils/media-utils';

const stream = await createReadableStreamFromFile('path/to/media.mp4');
// Now the stream can be passed to getMediaInfo or extractAudio
```

**Important**: The caller is responsible for consuming or explicitly cancelling the stream (`stream.cancel()`)
to release the underlying file handle if the stream is not fully consumed.
The good news is, `getMediaInfo` and `extractAudio` always does that.

### `readFromStreamToFile(stream: ReadableStream<Uint8Array>, filePath: string)`

Reads a Web `ReadableStream` and writes its content to a file.
The output directory is automatically created if it doesn't exist.

```typescript
import { readFromStreamToFile } from '@handy-common-utils/media-utils';

// Assuming you have a ReadableStream from some processing
await readFromStreamToFile(myStream, 'path/to/output.mp4');
```

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

Promise that resolves when extraction is complete

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

##### Extends

- [`ParserRelatedOptions`](#utilsinterfacesparserrelatedoptionsmd)

##### Properties

| Property                                    | Type                                                                      | Description                                                                                                                                                                                                           | Inherited from                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| <a id="api-debug"></a> `debug?`             | `boolean`                                                                 | Whether to enable debug logging. Default value is false.                                                                                                                                                              | -                                                                                          |
| <a id="api-onprogress"></a> `onProgress?`   | (`progress`) => `void`                                                    | Optional callback to receive progress updates (0-100).                                                                                                                                                                | -                                                                                          |
| <a id="api-quiet"></a> `quiet?`             | `boolean`                                                                 | Whether to suppress console output. Default value is true.                                                                                                                                                            | -                                                                                          |
| <a id="api-streamindex"></a> `streamIndex?` | `number`                                                                  | The index of the stream/track to extract audio from. If this option is provided, `trackId` is ignored. If `trackId` is not provided and this option is not specified, the first audio stream/track will be extracted. | -                                                                                          |
| <a id="api-trackid"></a> `trackId?`         | `number`                                                                  | The ID of the track to extract audio from If this option is provided, `streamIndex` is ignored. If both `trackId` and `streamIndex` are not provided, the first audio stream/track will be extracted.                 | -                                                                                          |
| <a id="api-useparser"></a> `useParser?`     | `"mp4box"` \| `"remotion"` \| `"isoboxer"` \| `"media-utils"` \| `"auto"` | Which parser library/package to use The default is 'auto', which will try to use mp4box first and fallback to remotion if mp4box fails.                                                                               | [`ParserRelatedOptions`](#utilsinterfacesparserrelatedoptionsmd).[`useParser`](#useparser) |

## Get Media Info

<a id="get-media-inforeadmemd"></a>

### get-media-info

#### Type Aliases

| Type Alias                                                              | Description |
| ----------------------------------------------------------------------- | ----------- |
| [GetMediaInfoOptions](#get-media-infotype-aliasesgetmediainfooptionsmd) | -           |
| [GetMediaInfoResult](#get-media-infotype-aliasesgetmediainforesultmd)   | -           |

#### Functions

| Function                                                               | Description                                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [getMediaInfo](#get-media-infofunctionsgetmediainfomd)                 | Get media information from a stream                                                                    |
| [getMediaInfoFromFile](#get-media-infofunctionsgetmediainfofromfilemd) | Get media information from a file path. This function works in Node.js environment but not in browser. |

### Functions

<a id="get-media-infofunctionsgetmediainfomd"></a>

#### Function: getMediaInfo()

> **getMediaInfo**(`stream`, `optionsInput?`): `Promise`\<[`GetMediaInfoResult`](#get-media-infotype-aliasesgetmediainforesultmd)\>

Get media information from a stream

##### Parameters

| Parameter       | Type                                                                      | Description                                                                                                                             |
| --------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `stream`        | `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>                     | The input Web ReadableStream (not Node Readable). To convert a Node Readable to Web ReadableStream, use `Readable.toWeb(nodeReadable)`. |
| `optionsInput?` | [`GetMediaInfoOptions`](#get-media-infotype-aliasesgetmediainfooptionsmd) | Options for the parser                                                                                                                  |

##### Returns

`Promise`\<[`GetMediaInfoResult`](#get-media-infotype-aliasesgetmediainforesultmd)\>

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
| `debug?` | `boolean` | Whether to enable debug logging. Default value is false.   |
| `quiet?` | `boolean` | Whether to suppress console output. Default value is true. |

<a id="get-media-infotype-aliasesgetmediainforesultmd"></a>

#### Type Alias: GetMediaInfoResult

> **GetMediaInfoResult** = [`MediaInfo`](#media-infointerfacesmediainfomd) & `object`

##### Type Declaration

| Name     | Type                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| `parser` | `Exclude`\<[`GetMediaInfoOptions`](#get-media-infotype-aliasesgetmediainfooptionsmd)\[`"useParser"`\], `undefined`\> |

## Index

<a id="indexreadmemd"></a>

### index

#### References

<a id="api-allaudiocodecs"></a>

##### allAudioCodecs

Re-exports [allAudioCodecs](#media-infofunctionsallaudiocodecsmd)

---

<a id="api-allcontainers"></a>

##### allContainers

Re-exports [allContainers](#media-infofunctionsallcontainersmd)

---

<a id="api-allvideocodecs"></a>

##### allVideoCodecs

Re-exports [allVideoCodecs](#media-infofunctionsallvideocodecsmd)

---

<a id="api-audiocodecdetails"></a>

##### AudioCodecDetails

Re-exports [AudioCodecDetails](#media-infoclassesaudiocodecdetailsmd)

---

<a id="api-audiocodectype"></a>

##### AudioCodecType

Re-exports [AudioCodecType](#media-infotype-aliasesaudiocodectypemd)

---

<a id="api-audiostreaminfo"></a>

##### AudioStreamInfo

Re-exports [AudioStreamInfo](#media-infointerfacesaudiostreaminfomd)

---

<a id="api-containerdetails"></a>

##### ContainerDetails

Re-exports [ContainerDetails](#media-infoclassescontainerdetailsmd)

---

<a id="api-containertype"></a>

##### ContainerType

Re-exports [ContainerType](#media-infotype-aliasescontainertypemd)

---

<a id="api-createreadablestreamfromfile"></a>

##### createReadableStreamFromFile

Re-exports [createReadableStreamFromFile](#utilsfunctionscreatereadablestreamfromfilemd)

---

<a id="api-ensurebufferdata"></a>

##### ensureBufferData

Re-exports [ensureBufferData](#utilsfunctionsensurebufferdatamd)

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

<a id="api-findaudiocodec"></a>

##### findAudioCodec

Re-exports [findAudioCodec](#media-infofunctionsfindaudiocodecmd)

---

<a id="api-findcontainer"></a>

##### findContainer

Re-exports [findContainer](#media-infofunctionsfindcontainermd)

---

<a id="api-findvideocodec"></a>

##### findVideoCodec

Re-exports [findVideoCodec](#media-infofunctionsfindvideocodecmd)

---

<a id="api-getgloballogger"></a>

##### getGlobalLogger

Re-exports [getGlobalLogger](#utilsfunctionsgetgloballoggermd)

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

<a id="api-getmediainforesult"></a>

##### GetMediaInfoResult

Re-exports [GetMediaInfoResult](#get-media-infotype-aliasesgetmediainforesultmd)

---

<a id="api-ispcm"></a>

##### isPCM

Re-exports [isPCM](#media-infofunctionsispcmmd)

---

<a id="api-iswma"></a>

##### isWMA

Re-exports [isWMA](#media-infofunctionsiswmamd)

---

<a id="api-mediainfo"></a>

##### MediaInfo

Re-exports [MediaInfo](#media-infointerfacesmediainfomd)

---

<a id="api-parserrelatedoptions"></a>

##### ParserRelatedOptions

Re-exports [ParserRelatedOptions](#utilsinterfacesparserrelatedoptionsmd)

---

<a id="api-parsingerror"></a>

##### ParsingError

Re-exports [ParsingError](#utilsinterfacesparsingerrormd)

---

<a id="api-readbeginning"></a>

##### readBeginning

Re-exports [readBeginning](#utilsfunctionsreadbeginningmd)

---

<a id="api-readfromstreamtofile"></a>

##### readFromStreamToFile

Re-exports [readFromStreamToFile](#utilsfunctionsreadfromstreamtofilemd)

---

<a id="api-setupgloballogger"></a>

##### setupGlobalLogger

Re-exports [setupGlobalLogger](#utilsfunctionssetupgloballoggermd)

---

<a id="api-toaudiocodec"></a>

##### toAudioCodec

Re-exports [toAudioCodec](#media-infofunctionstoaudiocodecmd)

---

<a id="api-tocontainer"></a>

##### toContainer

Re-exports [toContainer](#media-infofunctionstocontainermd)

---

<a id="api-tovideocodec"></a>

##### toVideoCodec

Re-exports [toVideoCodec](#media-infofunctionstovideocodecmd)

---

<a id="api-unsupportedformaterror"></a>

##### UnsupportedFormatError

Re-exports [UnsupportedFormatError](#utilsclassesunsupportedformaterrormd)

---

<a id="api-videocodecdetails"></a>

##### VideoCodecDetails

Re-exports [VideoCodecDetails](#media-infoclassesvideocodecdetailsmd)

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

#### Classes

| Class                                                      | Description |
| ---------------------------------------------------------- | ----------- |
| [AudioCodecDetails](#media-infoclassesaudiocodecdetailsmd) | -           |
| [ContainerDetails](#media-infoclassescontainerdetailsmd)   | -           |
| [VideoCodecDetails](#media-infoclassesvideocodecdetailsmd) | -           |

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

#### Functions

| Function                                               | Description                                               |
| ------------------------------------------------------ | --------------------------------------------------------- |
| [allAudioCodecs](#media-infofunctionsallaudiocodecsmd) | Get all audio codecs with their details                   |
| [allContainers](#media-infofunctionsallcontainersmd)   | Get all containers with their details                     |
| [allVideoCodecs](#media-infofunctionsallvideocodecsmd) | Get all video codecs with their details                   |
| [findAudioCodec](#media-infofunctionsfindaudiocodecmd) | Find the matching audio codec for a given code            |
| [findContainer](#media-infofunctionsfindcontainermd)   | Find the matching container for a given code              |
| [findVideoCodec](#media-infofunctionsfindvideocodecmd) | Find the matching video codec for a given code            |
| [isPCM](#media-infofunctionsispcmmd)                   | Check if the audio codec is a PCM (including ADPCM) codec |
| [isWMA](#media-infofunctionsiswmamd)                   | Check if the audio codec is a WMA codec                   |
| [toAudioCodec](#media-infofunctionstoaudiocodecmd)     | Find the matching audio codec for a given code            |
| [toContainer](#media-infofunctionstocontainermd)       | Find the matching container for a given code              |
| [toVideoCodec](#media-infofunctionstovideocodecmd)     | Find the matching video codec for a given code            |

### Classes

<a id="media-infoclassesaudiocodecdetailsmd"></a>

#### Class: AudioCodecDetails\<T\>

##### Type Parameters

| Type Parameter         |
| ---------------------- |
| `T` _extends_ `string` |

##### Constructors

<a id="api-constructor"></a>

###### Constructor

> **new AudioCodecDetails**\<`T`\>(`code`, `defaultContainer`, `aliases`): `AudioCodecDetails`\<`T`\>

####### Parameters

| Parameter          | Type                                                                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code`             | `T`                                                                                                                                                                                                                    |
| `defaultContainer` | `"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` |
| `aliases`          | (`string` \| `RegExp`)[]                                                                                                                                                                                               |

####### Returns

`AudioCodecDetails`\<`T`\>

##### Properties

| Property                                             | Modifier   | Type                                                                                                                                                                                                                   |
| ---------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="api-aliases"></a> `aliases`                   | `readonly` | (`string` \| `RegExp`)[]                                                                                                                                                                                               |
| <a id="api-code"></a> `code`                         | `readonly` | `T`                                                                                                                                                                                                                    |
| <a id="api-defaultcontainer"></a> `defaultContainer` | `readonly` | `"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` |

<a id="media-infoclassescontainerdetailsmd"></a>

#### Class: ContainerDetails\<T\>

##### Type Parameters

| Type Parameter         |
| ---------------------- |
| `T` _extends_ `string` |

##### Constructors

<a id="api-constructor"></a>

###### Constructor

> **new ContainerDetails**\<`T`\>(`code`, `fileExtension`, `aliases`): `ContainerDetails`\<`T`\>

####### Parameters

| Parameter       | Type                     |
| --------------- | ------------------------ |
| `code`          | `T`                      |
| `fileExtension` | `string`                 |
| `aliases`       | (`string` \| `RegExp`)[] |

####### Returns

`ContainerDetails`\<`T`\>

##### Properties

| Property                                       | Modifier   | Type                     |
| ---------------------------------------------- | ---------- | ------------------------ |
| <a id="api-aliases"></a> `aliases`             | `readonly` | (`string` \| `RegExp`)[] |
| <a id="api-code"></a> `code`                   | `readonly` | `T`                      |
| <a id="api-fileextension"></a> `fileExtension` | `readonly` | `string`                 |

<a id="media-infoclassesvideocodecdetailsmd"></a>

#### Class: VideoCodecDetails\<T\>

##### Type Parameters

| Type Parameter         |
| ---------------------- |
| `T` _extends_ `string` |

##### Constructors

<a id="api-constructor"></a>

###### Constructor

> **new VideoCodecDetails**\<`T`\>(`code`, `aliases`): `VideoCodecDetails`\<`T`\>

####### Parameters

| Parameter | Type                     |
| --------- | ------------------------ |
| `code`    | `T`                      |
| `aliases` | (`string` \| `RegExp`)[] |

####### Returns

`VideoCodecDetails`\<`T`\>

##### Properties

| Property                           | Modifier   | Type                     |
| ---------------------------------- | ---------- | ------------------------ |
| <a id="api-aliases"></a> `aliases` | `readonly` | (`string` \| `RegExp`)[] |
| <a id="api-code"></a> `code`       | `readonly` | `T`                      |

### Functions

<a id="media-infofunctionsallaudiocodecsmd"></a>

#### Function: allAudioCodecs()

> **allAudioCodecs**(): [`AudioCodecDetails`](#media-infoclassesaudiocodecdetailsmd)\<`"unknown"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` \| `"opus"` \| `"aac_latm"` \| `"wmav1"` \| `"wmav2"` \| `"wmapro"` \| `"wmalossless"` \| `"vorbis"` \| `"pcm_u8"` \| `"pcm_s16le"` \| `"pcm_s24le"` \| `"pcm_s32le"` \| `"pcm_s16be"` \| `"pcm_s24be"` \| `"pcm_s32be"` \| `"pcm_f32le"` \| `"pcm_alaw"` \| `"pcm_mulaw"` \| `"alac"` \| `"adpcm_ms"` \| `"adpcm_ima_wav"` \| `"eac3"`\>[]

Get all audio codecs with their details

##### Returns

[`AudioCodecDetails`](#media-infoclassesaudiocodecdetailsmd)\<`"unknown"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` \| `"opus"` \| `"aac_latm"` \| `"wmav1"` \| `"wmav2"` \| `"wmapro"` \| `"wmalossless"` \| `"vorbis"` \| `"pcm_u8"` \| `"pcm_s16le"` \| `"pcm_s24le"` \| `"pcm_s32le"` \| `"pcm_s16be"` \| `"pcm_s24be"` \| `"pcm_s32be"` \| `"pcm_f32le"` \| `"pcm_alaw"` \| `"pcm_mulaw"` \| `"alac"` \| `"adpcm_ms"` \| `"adpcm_ima_wav"` \| `"eac3"`\>[]

Array of audio codec details

<a id="media-infofunctionsallcontainersmd"></a>

#### Function: allContainers()

> **allContainers**(): [`ContainerDetails`](#media-infoclassescontainerdetailsmd)\<`"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"`\>[]

Get all containers with their details

##### Returns

[`ContainerDetails`](#media-infoclassescontainerdetailsmd)\<`"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"`\>[]

Array of container details

<a id="media-infofunctionsallvideocodecsmd"></a>

#### Function: allVideoCodecs()

> **allVideoCodecs**(): [`VideoCodecDetails`](#media-infoclassesvideocodecdetailsmd)\<`"unknown"` \| `"h264"` \| `"hevc"` \| `"vp8"` \| `"vp9"` \| `"wmv2"` \| `"av1"` \| `"prores"` \| `"mpeg4"` \| `"mpeg2video"` \| `"theora"` \| `"mjpeg"` \| `"msmpeg4v2"` \| `"mpeg1video"`\>[]

Get all video codecs with their details

##### Returns

[`VideoCodecDetails`](#media-infoclassesvideocodecdetailsmd)\<`"unknown"` \| `"h264"` \| `"hevc"` \| `"vp8"` \| `"vp9"` \| `"wmv2"` \| `"av1"` \| `"prores"` \| `"mpeg4"` \| `"mpeg2video"` \| `"theora"` \| `"mjpeg"` \| `"msmpeg4v2"` \| `"mpeg1video"`\>[]

Array of video codec details

<a id="media-infofunctionsfindaudiocodecmd"></a>

#### Function: findAudioCodec()

> **findAudioCodec**(`code`): [`AudioCodecDetails`](#media-infoclassesaudiocodecdetailsmd)\<`"unknown"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` \| `"opus"` \| `"aac_latm"` \| `"wmav1"` \| `"wmav2"` \| `"wmapro"` \| `"wmalossless"` \| `"vorbis"` \| `"pcm_u8"` \| `"pcm_s16le"` \| `"pcm_s24le"` \| `"pcm_s32le"` \| `"pcm_s16be"` \| `"pcm_s24be"` \| `"pcm_s32be"` \| `"pcm_f32le"` \| `"pcm_alaw"` \| `"pcm_mulaw"` \| `"alac"` \| `"adpcm_ms"` \| `"adpcm_ima_wav"` \| `"eac3"`\> \| `undefined`

Find the matching audio codec for a given code

##### Parameters

| Parameter | Type                              | Description                                                                                  |
| --------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| `code`    | `string` \| `null` \| `undefined` | A code which could be a codec identifier (e.g., "mp4a.40.2", "opus", "mp3") or anything else |

##### Returns

[`AudioCodecDetails`](#media-infoclassesaudiocodecdetailsmd)\<`"unknown"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` \| `"opus"` \| `"aac_latm"` \| `"wmav1"` \| `"wmav2"` \| `"wmapro"` \| `"wmalossless"` \| `"vorbis"` \| `"pcm_u8"` \| `"pcm_s16le"` \| `"pcm_s24le"` \| `"pcm_s32le"` \| `"pcm_s16be"` \| `"pcm_s24be"` \| `"pcm_s32be"` \| `"pcm_f32le"` \| `"pcm_alaw"` \| `"pcm_mulaw"` \| `"alac"` \| `"adpcm_ms"` \| `"adpcm_ima_wav"` \| `"eac3"`\> \| `undefined`

Details of the audio codec found, or undefined if no matching codec can be found.

<a id="media-infofunctionsfindcontainermd"></a>

#### Function: findContainer()

> **findContainer**(`code`): [`ContainerDetails`](#media-infoclassescontainerdetailsmd)\<`"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"`\> \| `undefined`

Find the matching container for a given code

##### Parameters

| Parameter | Type                              | Description                                                                                  |
| --------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| `code`    | `string` \| `null` \| `undefined` | A code which could be a MP4 brand identifier (e.g., "isom", "iso2", "mp41") or anything else |

##### Returns

[`ContainerDetails`](#media-infoclassescontainerdetailsmd)\<`"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"`\> \| `undefined`

Details of the container found, or undefined if no matching container can be found.

<a id="media-infofunctionsfindvideocodecmd"></a>

#### Function: findVideoCodec()

> **findVideoCodec**(`code`): [`VideoCodecDetails`](#media-infoclassesvideocodecdetailsmd)\<`"unknown"` \| `"h264"` \| `"hevc"` \| `"vp8"` \| `"vp9"` \| `"wmv2"` \| `"av1"` \| `"prores"` \| `"mpeg4"` \| `"mpeg2video"` \| `"theora"` \| `"mjpeg"` \| `"msmpeg4v2"` \| `"mpeg1video"`\> \| `undefined`

Find the matching video codec for a given code

##### Parameters

| Parameter | Type                              | Description                                                                             |
| --------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| `code`    | `string` \| `null` \| `undefined` | A code which could be a codec identifier (e.g., "avc", "hevc", "vp09") or anything else |

##### Returns

[`VideoCodecDetails`](#media-infoclassesvideocodecdetailsmd)\<`"unknown"` \| `"h264"` \| `"hevc"` \| `"vp8"` \| `"vp9"` \| `"wmv2"` \| `"av1"` \| `"prores"` \| `"mpeg4"` \| `"mpeg2video"` \| `"theora"` \| `"mjpeg"` \| `"msmpeg4v2"` \| `"mpeg1video"`\> \| `undefined`

Details of the video codec found, or undefined if no matching codec can be found.

<a id="media-infofunctionsispcmmd"></a>

#### Function: isPCM()

> **isPCM**(`audioCodec`): `boolean`

Check if the audio codec is a PCM (including ADPCM) codec

##### Parameters

| Parameter    | Type                              | Description              |
| ------------ | --------------------------------- | ------------------------ |
| `audioCodec` | `string` \| `null` \| `undefined` | The audio codec to check |

##### Returns

`boolean`

True if the audio codec is a PCM codec, false otherwise

<a id="media-infofunctionsiswmamd"></a>

#### Function: isWMA()

> **isWMA**(`audioCodec`): `boolean`

Check if the audio codec is a WMA codec

##### Parameters

| Parameter    | Type                              | Description              |
| ------------ | --------------------------------- | ------------------------ |
| `audioCodec` | `string` \| `null` \| `undefined` | The audio codec to check |

##### Returns

`boolean`

True if the audio codec is a WMA codec, false otherwise

<a id="media-infofunctionstoaudiocodecmd"></a>

#### Function: toAudioCodec()

> **toAudioCodec**(`code`): [`AudioCodecDetails`](#media-infoclassesaudiocodecdetailsmd)\<`"unknown"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` \| `"opus"` \| `"aac_latm"` \| `"wmav1"` \| `"wmav2"` \| `"wmapro"` \| `"wmalossless"` \| `"vorbis"` \| `"pcm_u8"` \| `"pcm_s16le"` \| `"pcm_s24le"` \| `"pcm_s32le"` \| `"pcm_s16be"` \| `"pcm_s24be"` \| `"pcm_s32be"` \| `"pcm_f32le"` \| `"pcm_alaw"` \| `"pcm_mulaw"` \| `"alac"` \| `"adpcm_ms"` \| `"adpcm_ima_wav"` \| `"eac3"`\>

Find the matching audio codec for a given code

##### Parameters

| Parameter | Type                              | Description                                                                                  |
| --------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| `code`    | `string` \| `null` \| `undefined` | A code which could be a codec identifier (e.g., "mp4a.40.2", "opus", "mp3") or anything else |

##### Returns

[`AudioCodecDetails`](#media-infoclassesaudiocodecdetailsmd)\<`"unknown"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` \| `"opus"` \| `"aac_latm"` \| `"wmav1"` \| `"wmav2"` \| `"wmapro"` \| `"wmalossless"` \| `"vorbis"` \| `"pcm_u8"` \| `"pcm_s16le"` \| `"pcm_s24le"` \| `"pcm_s32le"` \| `"pcm_s16be"` \| `"pcm_s24be"` \| `"pcm_s32be"` \| `"pcm_f32le"` \| `"pcm_alaw"` \| `"pcm_mulaw"` \| `"alac"` \| `"adpcm_ms"` \| `"adpcm_ima_wav"` \| `"eac3"`\>

Details of the audio codec found, or throws an error if no matching codec can be found.

<a id="media-infofunctionstocontainermd"></a>

#### Function: toContainer()

> **toContainer**(`code`): [`ContainerDetails`](#media-infoclassescontainerdetailsmd)\<`"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"`\>

Find the matching container for a given code

##### Parameters

| Parameter | Type                                            | Description                                                                  |
| --------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `code`    | `string` \| `string`[] \| `null` \| `undefined` | A code or an array of MP4 brand identifiers (e.g., ["isom", "iso2", "mp41"]) |

##### Returns

[`ContainerDetails`](#media-infoclassescontainerdetailsmd)\<`"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"`\>

Details of the container found, or throws an error if no matching container can be found.

<a id="media-infofunctionstovideocodecmd"></a>

#### Function: toVideoCodec()

> **toVideoCodec**(`code`): [`VideoCodecDetails`](#media-infoclassesvideocodecdetailsmd)\<`"unknown"` \| `"h264"` \| `"hevc"` \| `"vp8"` \| `"vp9"` \| `"wmv2"` \| `"av1"` \| `"prores"` \| `"mpeg4"` \| `"mpeg2video"` \| `"theora"` \| `"mjpeg"` \| `"msmpeg4v2"` \| `"mpeg1video"`\>

Find the matching video codec for a given code

##### Parameters

| Parameter | Type                              | Description                                                                             |
| --------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| `code`    | `string` \| `null` \| `undefined` | A code which could be a codec identifier (e.g., "avc", "hevc", "vp09") or anything else |

##### Returns

[`VideoCodecDetails`](#media-infoclassesvideocodecdetailsmd)\<`"unknown"` \| `"h264"` \| `"hevc"` \| `"vp8"` \| `"vp9"` \| `"wmv2"` \| `"av1"` \| `"prores"` \| `"mpeg4"` \| `"mpeg2video"` \| `"theora"` \| `"mjpeg"` \| `"msmpeg4v2"` \| `"mpeg1video"`\>

Details of the video codec found, or throws an error if no matching codec can be found.

### Interfaces

<a id="media-infointerfacesaudiostreaminfomd"></a>

#### Interface: AudioStreamInfo

##### Properties

| Property                                                | Type                                                                                                                                                                                                                                                                                                                                                                                                                              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="api-audiotype"></a> `audioType?`                 | `string`                                                                                                                                                                                                                                                                                                                                                                                                                          | Such like Music, Effects, Visual impaired / Audio description, Hearing impaired                                                                                                                                                                                                                                                                                                                                                                     |
| <a id="api-bitrate"></a> `bitrate?`                     | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| <a id="api-bitspersample"></a> `bitsPerSample?`         | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| <a id="api-channelcount"></a> `channelCount?`           | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| <a id="api-codec"></a> `codec`                          | `"unknown"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` \| `"opus"` \| `"aac_latm"` \| `"wmav1"` \| `"wmav2"` \| `"wmapro"` \| `"wmalossless"` \| `"vorbis"` \| `"pcm_u8"` \| `"pcm_s16le"` \| `"pcm_s24le"` \| `"pcm_s32le"` \| `"pcm_s16be"` \| `"pcm_s24be"` \| `"pcm_s32be"` \| `"pcm_f32le"` \| `"pcm_alaw"` \| `"pcm_mulaw"` \| `"alac"` \| `"adpcm_ms"` \| `"adpcm_ima_wav"` \| `"eac3"` | -                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| <a id="api-codecdetail"></a> `codecDetail?`             | `string`                                                                                                                                                                                                                                                                                                                                                                                                                          | Parser-specific codec information                                                                                                                                                                                                                                                                                                                                                                                                                   |
| <a id="api-codecdetails"></a> `codecDetails?`           | `object`                                                                                                                                                                                                                                                                                                                                                                                                                          | Codec-specific details (stream-level properties) For ADPCM codecs (MS ADPCM, IMA ADPCM, etc.), these properties are constant for the entire audio stream and stored once in the container's format header: - WAV: in the fmt chunk - AVI: in the stream format chunk (strf) - MKV (A_MS/ACM): inside the CodecPrivate WAVEFORMATEX These values do NOT change per block/frame.                                                                      |
| `codecDetails.asvc?`                                    | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `codecDetails.blockAlign?`                              | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | Block align (nBlockAlign) — STREAM LEVEL The size (in bytes) of each encoded ADPCM block. Must remain constant for the whole stream. - Containers expect every read operation to start on a block boundary - ADPCM decoding requires knowing block size ahead of time - Every ADPCM block in the stream must be exactly blockAlign bytes Not stored per block — the block itself does not announce its own length.                                  |
| `codecDetails.bsmod?`                                   | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `codecDetails.componentType?`                           | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `codecDetails.formatTag?`                               | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | Format tag (wFormatTag) — STREAM LEVEL Identifies the codec type: - 0x0001 = PCM - 0x0002 = MS ADPCM - 0x0011 = IMA ADPCM - etc. Stored once in the container's format header, not in each block.                                                                                                                                                                                                                                                   |
| `codecDetails.layer?`                                   | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | Something like layer I, II, III                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `codecDetails.mainId?`                                  | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `codecDetails.padding?`                                 | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `codecDetails.samplesPerBlock?`                         | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | Samples per block — STREAM LEVEL Tells the decoder how many PCM samples will come out of each compressed block. Derived from the codec and blockAlign. Needed because ADPCM uses: - Warm-up samples - 4-bit deltas Also constant for the entire stream. Not stored per block. The block itself contains: - Predictor index - Delta (step size) - Warm-up samples - 4-bit deltas ...but NOT samples-per-block (that's known from the stream header). |
| <a id="api-durationinseconds"></a> `durationInSeconds?` | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| <a id="api-id"></a> `id`                                | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| <a id="api-language"></a> `language?`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                          | Usually it is ISO-639 string                                                                                                                                                                                                                                                                                                                                                                                                                        |
| <a id="api-level"></a> `level?`                         | `string`                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| <a id="api-profile"></a> `profile?`                     | `string`                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| <a id="api-samplerate"></a> `sampleRate?`               | `number`                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| <a id="api-surroundmode"></a> `surroundMode?`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                          | DTS surround mode                                                                                                                                                                                                                                                                                                                                                                                                                                   |

<a id="media-infointerfacesmediainfomd"></a>

#### Interface: MediaInfo

##### Properties

| Property                                                | Type                                                                                                                                                                                                                   | Description                           |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| <a id="api-audiostreams"></a> `audioStreams`            | [`AudioStreamInfo`](#media-infointerfacesaudiostreaminfomd)[]                                                                                                                                                          | -                                     |
| <a id="api-container"></a> `container`                  | `"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` | -                                     |
| <a id="api-containerdetail"></a> `containerDetail?`     | `string`                                                                                                                                                                                                               | Parser-specific container information |
| <a id="api-durationinseconds"></a> `durationInSeconds?` | `number`                                                                                                                                                                                                               | -                                     |
| <a id="api-mimetype"></a> `mimeType?`                   | `string`                                                                                                                                                                                                               | -                                     |
| <a id="api-parser"></a> `parser`                        | `"mp4box"` \| `"remotion"` \| `"isoboxer"` \| `"media-utils"` \| `"auto"`                                                                                                                                              | -                                     |
| <a id="api-videostreams"></a> `videoStreams`            | [`VideoStreamInfo`](#media-infointerfacesvideostreaminfomd)[]                                                                                                                                                          | -                                     |

<a id="media-infointerfacesvideostreaminfomd"></a>

#### Interface: VideoStreamInfo

##### Properties

| Property                                                | Type                                                                                                                                                                                        | Description                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| <a id="api-bitrate"></a> `bitrate?`                     | `number`                                                                                                                                                                                    | -                                 |
| <a id="api-codec"></a> `codec`                          | `"unknown"` \| `"h264"` \| `"hevc"` \| `"vp8"` \| `"vp9"` \| `"wmv2"` \| `"av1"` \| `"prores"` \| `"mpeg4"` \| `"mpeg2video"` \| `"theora"` \| `"mjpeg"` \| `"msmpeg4v2"` \| `"mpeg1video"` | -                                 |
| <a id="api-codecdetail"></a> `codecDetail?`             | `string`                                                                                                                                                                                    | Parser-specific codec information |
| <a id="api-durationinseconds"></a> `durationInSeconds?` | `number`                                                                                                                                                                                    | -                                 |
| <a id="api-fps"></a> `fps?`                             | `number`                                                                                                                                                                                    | -                                 |
| <a id="api-height"></a> `height?`                       | `number`                                                                                                                                                                                    | -                                 |
| <a id="api-id"></a> `id`                                | `number`                                                                                                                                                                                    | -                                 |
| <a id="api-level"></a> `level?`                         | `string`                                                                                                                                                                                    | -                                 |
| <a id="api-profile"></a> `profile?`                     | `string`                                                                                                                                                                                    | -                                 |
| <a id="api-width"></a> `width?`                         | `number`                                                                                                                                                                                    | -                                 |

### Type Aliases

<a id="media-infotype-aliasesaudiocodectypemd"></a>

#### Type Alias: AudioCodecType

> **AudioCodecType** = keyof _typeof_ `audioCodecs`

<a id="media-infotype-aliasescontainertypemd"></a>

#### Type Alias: ContainerType

> **ContainerType** = keyof _typeof_ `containers`

<a id="media-infotype-aliasesvideocodectypemd"></a>

#### Type Alias: VideoCodecType

> **VideoCodecType** = keyof _typeof_ `videoCodecs`

## Utils

<a id="utilsreadmemd"></a>

### utils

#### Classes

| Class                                                           | Description                                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [UnsupportedFormatError](#utilsclassesunsupportedformaterrormd) | Error thrown when a parser encounters an unsupported file format or invalid data. |

#### Interfaces

| Interface                                                      | Description |
| -------------------------------------------------------------- | ----------- |
| [ParserRelatedOptions](#utilsinterfacesparserrelatedoptionsmd) | -           |
| [ParsingError](#utilsinterfacesparsingerrormd)                 | -           |

#### Functions

| Function                                                                      | Description                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [createReadableStreamFromFile](#utilsfunctionscreatereadablestreamfromfilemd) | Creates a Web ReadableStream from a Node.js file path. This function works in Node.js environment but not in browser.                                                                                                                                                            |
| [ensureBufferData](#utilsfunctionsensurebufferdatamd)                         | Ensures that the buffer has enough data by reading from the stream if necessary. This function manages buffer compaction and appending new data.                                                                                                                                 |
| [getGlobalLogger](#utilsfunctionsgetgloballoggermd)                           | Returns the global logger for the library. If the logger has not been set, it will be initialized default settings which discards all logs. Please note that environment variables MEDIA_UTILS_LOG_QUIET and MEDIA_UTILS_LOG_DEBUG can be used to override the logging behavior. |
| [readBeginning](#utilsfunctionsreadbeginningmd)                               | Reads the beginning of a stream up to a specified size. This function handles reading, buffering, and closing the reader.                                                                                                                                                        |
| [readFromStreamToFile](#utilsfunctionsreadfromstreamtofilemd)                 | Reads a Web ReadableStream and writes it to a file. This function works in Node.js environment but not in browser.                                                                                                                                                               |
| [setupGlobalLogger](#utilsfunctionssetupgloballoggermd)                       | Set the global logger for the library to a new console logger. Please note that environment variables MEDIA_UTILS_LOG_QUIET and MEDIA_UTILS_LOG_DEBUG can be used to override the logging behavior.                                                                              |

### Classes

<a id="utilsclassesunsupportedformaterrormd"></a>

#### Class: UnsupportedFormatError

Error thrown when a parser encounters an unsupported file format or invalid data.

##### Extends

- `Error`

##### Implements

- [`ParsingError`](#utilsinterfacesparsingerrormd)

##### Constructors

<a id="api-constructor"></a>

###### Constructor

> **new UnsupportedFormatError**(`message`): `UnsupportedFormatError`

####### Parameters

| Parameter | Type     |
| --------- | -------- |
| `message` | `string` |

####### Returns

`UnsupportedFormatError`

####### Overrides

`Error.constructor`

##### Properties

| Property                                                             | Modifier   | Type   | Default value |
| -------------------------------------------------------------------- | ---------- | ------ | ------------- |
| <a id="api-isunsupportedformaterror"></a> `isUnsupportedFormatError` | `readonly` | `true` | `true`        |

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

<a id="utilsfunctionsensurebufferdatamd"></a>

#### Function: ensureBufferData()

> **ensureBufferData**(`reader`, `buffer?`, `bufferOffset?`, `size?`): `Promise`\<\{ `buffer`: `Uint8Array`; `bufferOffset`: `number`; `done`: `boolean`; \}\>

Ensures that the buffer has enough data by reading from the stream if necessary.
This function manages buffer compaction and appending new data.

##### Parameters

| Parameter       | Type                                                               | Description                                                                              |
| --------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `reader`        | `ReadableStreamDefaultReader`\<`Uint8Array`\<`ArrayBufferLike`\>\> | The ReadableStreamDefaultReader to read from                                             |
| `buffer?`       | `Uint8Array`\<`ArrayBufferLike`\>                                  | The current data buffer (optional, defaults to empty buffer)                             |
| `bufferOffset?` | `number`                                                           | The current offset in the buffer (optional, defaults to 0)                               |
| `size?`         | `number`                                                           | The minimum required size of data available in the buffer (buffer.length - bufferOffset) |

##### Returns

`Promise`\<\{ `buffer`: `Uint8Array`; `bufferOffset`: `number`; `done`: `boolean`; \}\>

An object containing the updated buffer, bufferOffset, and a boolean indicating if the stream has ended

<a id="utilsfunctionsgetgloballoggermd"></a>

#### Function: getGlobalLogger()

> **getGlobalLogger**(): `LineLogger`

Returns the global logger for the library.
If the logger has not been set, it will be initialized default settings which discards all logs.
Please note that environment variables MEDIA_UTILS_LOG_QUIET and MEDIA_UTILS_LOG_DEBUG can be used to override the logging behavior.

##### Returns

`LineLogger`

The global logger for the library.

<a id="utilsfunctionsreadbeginningmd"></a>

#### Function: readBeginning()

> **readBeginning**(`reader`, `size`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Reads the beginning of a stream up to a specified size.
This function handles reading, buffering, and closing the reader.

##### Parameters

| Parameter | Type                                                               | Description                                             |
| --------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| `reader`  | `ReadableStreamDefaultReader`\<`Uint8Array`\<`ArrayBufferLike`\>\> | The ReadableStreamDefaultReader to read from            |
| `size`    | `number`                                                           | The amount of data to read (optional, defaults to 64KB) |

##### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The read data as a Uint8Array

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

<a id="utilsfunctionssetupgloballoggermd"></a>

#### Function: setupGlobalLogger()

> **setupGlobalLogger**(`flags`): `LineLogger`

Set the global logger for the library to a new console logger.
Please note that environment variables MEDIA_UTILS_LOG_QUIET and MEDIA_UTILS_LOG_DEBUG can be used to override the logging behavior.

##### Parameters

| Parameter | Type                                                                     | Description                              |
| --------- | ------------------------------------------------------------------------ | ---------------------------------------- |
| `flags`   | \{ `debug?`: `boolean`; `quiet?`: `boolean`; \} \| `null` \| `undefined` | The flags to pass to the console logger. |

##### Returns

`LineLogger`

The global logger for the library.

### Interfaces

<a id="utilsinterfacesparserrelatedoptionsmd"></a>

#### Interface: ParserRelatedOptions

##### Extended by

- [`ExtractAudioOptions`](#extract-audiointerfacesextractaudiooptionsmd)

##### Properties

| Property                                | Type                                                                      | Description                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="api-useparser"></a> `useParser?` | `"mp4box"` \| `"remotion"` \| `"isoboxer"` \| `"media-utils"` \| `"auto"` | Which parser library/package to use The default is 'auto', which will try to use mp4box first and fallback to remotion if mp4box fails. |

<a id="utilsinterfacesparsingerrormd"></a>

#### Interface: ParsingError

##### Properties

| Property                                                              | Type      |
| --------------------------------------------------------------------- | --------- |
| <a id="api-isunsupportedformaterror"></a> `isUnsupportedFormatError?` | `boolean` |

<!-- API end -->
