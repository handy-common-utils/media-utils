# @handy-common-utils/media-utils

A **pure-JavaScript** library for efficiently parsing media information and extracting audio streams.
It works with **all popular formats and codecs** directly in the **browser and Node.js**,
without relying on external binaries like FFmpeg or WASM.

[![Version](https://img.shields.io/npm/v/@handy-common-utils/media-utils.svg)](https://npmjs.org/package/@handy-common-utils/media-utils)
[![Downloads/week](https://img.shields.io/npm/dw/@handy-common-utils/media-utils.svg)](https://npmjs.org/package/@handy-common-utils/media-utils)
[![CI](https://github.com/handy-common-utils/media-utils/actions/workflows/ci.yml/badge.svg)](https://github.com/handy-common-utils/media-utils/actions/workflows/ci.yml)

## Why Use @handy-common-utils/media-utils?

- **Pure JavaScript**: No reliance on FFmpeg, WASM, or any 3rd party media parsing or processing tools or packages.
- **Universal Compatibility**: Fully compatible with both Node.js and Browser environments.
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
| **asf/wma**      |             | wmav2          |             |    ✅     |
| **asf/wmv**      | wmv2        | wmav2          |             |    ✅     |
| **avi**          | h264        | adpcm_ms       |             |    ✅     |
| **avi**          | h264        | mp3            |             |    ✅     |
| **avi**          | h264        | pcm_s16le      |             |    ✅     |
| **avi**          | h264        | pcm_u8         |             |    ✅     |
| **avi**          | mjpeg       | pcm_s16le      |             |    ✅     |
| **avi**          | mpeg4       | ac3            | 5 channels  |    ✅     |
| **mkv**          | h264        | aac, aac       |             |    ✅     |
| **mkv**          | h264        | aac            |             |    ✅     |
| **mkv**          | h264        | mp3            |             |    ✅     |
| **mkv**          | msmpeg4v2   | mp3            |             |    ✅     |
| **mkv**          |             |                | streaming   |    ✅     |
| **mov**          | h264        | aac            |             |    ✅     |
| **mov**          | h264        | mp3            |             |    ✅     |
| **mov**          | h264        | pcm_s16le      |             |    ✅     |
| **mov**          | h264        | pcm_s32be      |             |    ✅     |
| **mp3**          |             | mp3            |             |    ✅     |
| **mp4**          | h264        | aac            |             |    ✅     |
| **mp4**          | h264        | mp3            |             |    ✅     |
| **mpegts**       | h264        | aac            |             |    ✅     |
| **mpegts**       | mpeg2video  | mp2            |             |    ✅     |
| **mxf**          | h264        | pcm_s24le      |             |    ✅     |
| **mxf**          | mpeg2video  | pcm_s16le      |             |    ✅     |
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
- `remotion`: [@remotion/media-parser](https://www.npmjs.com/package/@remotion/media-parser), handles more formats than mp4box and isoboxer.

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
| **asf/wmv**      | wmv2        | wmav2          |             |    ✅     | **wmav2** in **asf**     |
| **avi**          | h264        | adpcm_ms       |             |    ✅     | **adpcm_ms** in **wav**  |
| **avi**          | h264        | mp3            |             |    ✅     | **mp3** in **mp3**       |
| **avi**          | h264        | pcm_s16le      |             |    ✅     | **pcm_s16le** in **wav** |
| **avi**          | h264        | pcm_u8         |             |    ✅     | **pcm_u8** in **wav**    |
| **avi**          | mjpeg       | pcm_s16le      |             |    ✅     | **pcm_s16le** in **wav** |
| **mkv**          | h264        | aac            |             |    ✅     | **aac** in **aac**       |
| **mkv**          | h264        | mp3            |             |    ✅     | **mp3** in **mp3**       |
| **mkv**          | msmpeg4v2   | mp3            |             |    ✅     | **mp3** in **mp3**       |
| **mov**          | h264        | aac            |             |    ✅     | **aac** in **aac**       |
| **mov**          | h264        | mp3            |             |    ✅     | **mp3** in **mp3**       |
| **mov**          | h264        | pcm_s16le      |             |    ✅     | **pcm_s16le** in **wav** |
| **mov**          | h264        | pcm_s32be      |             |    ✅     | **pcm_s32le** in **wav** |
| **mp4**          | h264        | aac            |             |    ✅     | **aac** in **aac**       |
| **mp4**          | h264        | mp3            |             |    ✅     | **mp3** in **mp3**       |
| **mpegts**       | h264        | aac            |             |    ✅     | **aac** in **aac**       |
| **mpegts**       | h264        | mp3            |             |    ✅     | **mp3** in **mp3**       |
| **mpegts**       | mpeg2video  | mp2            |             |    ✅     | **mp2** in **mp3**       |
| **mxf**          | h264        | pcm_s24le      |             |    ✅     | **pcm_s24le** in **wav** |
| **mxf**          | mpeg2video  | pcm_s16le      |             |    ✅     | **pcm_s16le** in **wav** |
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

## Input: Stream or Blob

`getMediaInfo()` and `extractAudio()` accept either a Web `ReadableStream` or a `Blob`.
A `File` in the browser is also a `Blob`, and in Node.js 19.8 or later `fs.openAsBlob(path)` opens a file as a `Blob`.
Both give the same results; they differ in how much data is read and kept in memory.

|                                                                                    | `ReadableStream`                                                                                        | `Blob` (including `File`)                                                                 |
| :--------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------- |
| Supported formats, parsers and results                                             | All                                                                                                     | All (same results, except `bytesRead`, see below)                                         |
| `maxBytesToRead` / `maxBytesToReadForMediaInfo`, `sampleTableInfo` and the `mediaInfo` option of `extractAudio()` | Supported                                                                                               | Supported                                                                                 |
| Reading                                                                            | Forward only, once                                                                                      | From any position, as many times as needed                                                |
| Data read for detecting the format                                                 | Kept in memory while detecting, so that another parser can start again from the beginning               | Not kept, each parser opens its own stream from the `Blob`                                |
| MP4/MOV with the `moov` box after the `mdat` box                                   | The whole file is read, and kept in memory while detecting (use `maxBytesToRead` to fail early instead) | The `mdat` box is skipped without being read (with the 'media-utils' parser)              |
| `bytesRead` in the result                                                          | Bytes read, including the ones read only to skip them                                                   | Bytes actually read, skipped bytes are not counted                                        |
| `maxBytesToRead` applies to                                                        | The total read from the stream                                                                          | Each parsing attempt                                                                      |
| `extractAudio()` without `mediaInfo`                                               | The stream is teed: what detection reads is kept until the extraction has processed it                  | The `Blob` is read once for detecting and once more for extracting, nothing extra is kept |

Notes:

- For most files, detection reads only the header, so the difference is small. It matters for MP4/MOV files with the `moov`
  box at the end (not "fast start"), and for formats whose parser reads the whole file (MXF, and MP3 without a VBR header):
  with a stream, all of it goes through memory.
- Only the built-in 'media-utils' MP4/MOV parser skips data in a `Blob`. The third-party parsers (`mp4box`, `remotion`, `isoboxer`)
  read a `Blob` from the beginning like a stream.
- `getMediaInfoFromFile()`, `extractAudioFromFile()` and `extractAudioFromFileToFile()` read the file as a `Blob` (using Node.js `fs.openAsBlob()`).

### Reading large files with limited memory

- **Use a `Blob` when you can**, for example a `File` from `<input type="file">` or drag and drop, rather than `file.stream()`.
- **With a stream, use `maxBytesToRead`.** If the information can't be determined within that number of bytes,
  `MaxBytesExceededError` is thrown instead of reading (and keeping) more.
- **Detect once, extract once.** Pass the result of `getMediaInfo(input, { useParser: 'media-utils', sampleTableInfo: true })`
  to `extractAudio()` as the `mediaInfo` option. Detection is then skipped, and the input is read only once for extracting the audio.

```typescript
import { extractAudio, getMediaInfo } from '@handy-common-utils/media-utils';

// In the browser, file comes from <input type="file"> or drag and drop
try {
  const mediaInfo = await getMediaInfo(file, { useParser: 'media-utils', sampleTableInfo: true, maxBytesToRead: 4 * 1024 * 1024 });
  await extractAudio(file, outputWritableStream, { mediaInfo });
} catch (error) {
  if ((error as any)?.isMaxBytesExceededError || (error as any)?.isUnsupportedFormatError) {
    // can't extract the audio, use the original file
  } else {
    throw error;
  }
}
```

## Errors

In case the input is corrupted or the format or codec is not recognisable, `UnsupportedFormatError` would be thrown.

In case the `maxBytesToRead` option is used and the media information can't be determined within that number of bytes,
`MaxBytesExceededError` would be thrown.

## Logging Control

Log messages are single line text strings printed to console.
The verbosity of the logging can be controlled through function options and environment variables.

Unless explicitly configured, nothing would be logged (`quiet` is `true` by default).

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

## Environment Compatibility

| Platform | Minimum for Stream APIs (`getMediaInfo`, `extractAudio`) | Minimum for File APIs (`*FromFile`, `*FromFileToFile`) |
| :--- | :--- | :--- |
| **Node.js** | **18.0.0** (released 2022) | **19.8.0** (released 2023) |
| **Chrome / Edge** | **93+** (released 2021) | *N/A (Node-only)* |
| **Firefox** | **100+** (released 2022) *(91+ for `getMediaInfo` only, released 2021)* | *N/A (Node-only)* |
| **Safari** | **15.4+** (released 2022) | *N/A (Node-only)* |

> **Browser Safety**: The Node-only functions (`getMediaInfoFromFile`, `extractAudioFromFile`, `extractAudioFromFileToFile`, etc.) import Node.js built-ins (`node:fs`, `node:path`, `node:stream`) lazily inside their function bodies. Modern bundlers (such as Vite, Webpack, or Rollup) targeting the browser will bundle the library cleanly without build-time errors unless those Node-only functions are actually invoked in browser code.

# API

<!-- API start -->
<a name="readmemd"></a>

## @handy-common-utils/media-utils

### Modules

| Module | Description |
| ------ | ------ |
| [extract-audio](#extract-audioreadmemd) | - |
| [get-media-info](#get-media-inforeadmemd) | - |
| [index](#indexreadmemd) | - |
| [input-streams](#input-streamsreadmemd) | - |
| [media-info](#media-inforeadmemd) | - |
| [utils](#utilsreadmemd) | - |

## Extract Audio


<a id="extract-audioreadmemd"></a>

### extract-audio

#### Interfaces

| Interface | Description |
| ------ | ------ |
| [ExtractAudioOptions](#extract-audiointerfacesextractaudiooptionsmd) | - |

#### Functions

| Function | Description |
| ------ | ------ |
| [extractAudio](#extract-audiofunctionsextractaudiomd) | Extract raw audio data from the input |
| [extractAudioFromFile](#extract-audiofunctionsextractaudiofromfilemd) | Extract raw audio data from a file The file is read as a Blob (using Node.js `fs.openAsBlob()`), which avoids buffering large amounts of data in memory. This function works in Node.js environment but not in browser. |
| [extractAudioFromFileToFile](#extract-audiofunctionsextractaudiofromfiletofilemd) | Extract raw audio data from a file and write to an output file This function works in Node.js environment but not in browser. |

### Functions


<a id="extract-audiofunctionsextractaudiomd"></a>

#### Function: extractAudio()

> **extractAudio**(`input`, `output`, `optionsInput?`): `Promise`\<`void`\>

Extract raw audio data from the input

How the input is read:
- If the `mediaInfo` option is provided, the input is read only once, for extracting the audio.
- Otherwise, if the input is a Blob, it is read once for detecting the format (large parts can be skipped
  without being read, see [MediaInput](#utilstype-aliasesmediainputmd)), and then once more for extracting the audio.
- Otherwise (the input is a stream without `mediaInfo`), the stream is teed: one branch for detecting the format and
  the other for extracting the audio. Everything read for detecting the format is kept in memory until the extraction
  has processed it. For an MP4/MOV file with the `moov` box after the `mdat` box, that is the whole file.
  Use the `maxBytesToReadForMediaInfo` option to limit it.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `input` | [`MediaInput`](#utilstype-aliasesmediainputmd) | The input data provided through a readable stream or a Blob (a File in the browser is also a Blob) |
| `output` | `WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\> | The output stream to write extracted audio to |
| `optionsInput?` | [`ExtractAudioOptions`](#extract-audiointerfacesextractaudiooptionsmd) | Options for the extraction process |

##### Returns

`Promise`\<`void`\>

Promise that resolves when extraction is complete


<a id="extract-audiofunctionsextractaudiofromfilemd"></a>

#### Function: extractAudioFromFile()

> **extractAudioFromFile**(`filePath`, `output`, `options?`): `Promise`\<`void`\>

Extract raw audio data from a file
The file is read as a Blob (using Node.js `fs.openAsBlob()`), which avoids buffering large amounts of data in memory.
This function works in Node.js environment but not in browser.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `filePath` | `string` | The path to the media file |
| `output` | `WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\> | The output stream to write extracted audio to |
| `options?` | [`ExtractAudioOptions`](#extract-audiointerfacesextractaudiooptionsmd) | Options for the extraction process |

##### Returns

`Promise`\<`void`\>


<a id="extract-audiofunctionsextractaudiofromfiletofilemd"></a>

#### Function: extractAudioFromFileToFile()

> **extractAudioFromFileToFile**(`inputFilePath`, `outputFilePath`, `options?`): `Promise`\<`void`\>

Extract raw audio data from a file and write to an output file
This function works in Node.js environment but not in browser.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `inputFilePath` | `string` | The path to the input media file |
| `outputFilePath` | `string` | The path to the output audio file |
| `options?` | [`ExtractAudioOptions`](#extract-audiointerfacesextractaudiooptionsmd) | Options for the extraction process |

##### Returns

`Promise`\<`void`\>

### Interfaces


<a id="extract-audiointerfacesextractaudiooptionsmd"></a>

#### Interface: ExtractAudioOptions

##### Extends

- [`ParserRelatedOptions`](#utilsinterfacesparserrelatedoptionsmd)

##### Properties

| Property | Type | Description | Inherited from |
| ------ | ------ | ------ | ------ |
| <a id="api-property-debug"></a> `debug?` | `boolean` | Whether to enable debug logging. Default value is false. | - |
| <a id="api-property-maxbytestoreadformediainfo"></a> `maxBytesToReadForMediaInfo?` | `number` | The maximum number of bytes that can be read from the input for detecting its format, see `GetMediaInfoOptions.maxBytesToRead`. It does not limit the reading for extracting the audio, and it is ignored when `mediaInfo` is provided. When the input is a stream, the bytes read for detecting the format are kept in memory until the extraction has processed them, so this option also limits the memory used. Default: no limit. | - |
| <a id="api-property-mediainfo"></a> `mediaInfo?` | [`GetMediaInfoResult`](#get-media-infotype-aliasesgetmediainforesultmd) | Media information of the input, obtained earlier from the same input by `getMediaInfo(input, { useParser: 'media-utils', sampleTableInfo: true })`. When provided, the input is not parsed again for detecting its format. The input is then read only once, from the beginning to the end, and nothing read from it is kept in memory apart from the data being processed. It must be the result for exactly the same input. `sampleTableInfo: true` is required for MP4/MOV inputs. A result for a different input can't be detected, and gives a corrupted output or an error. | - |
| <a id="api-property-onprogress"></a> `onProgress?` | (`progress`) => `void` | Optional callback to receive progress updates (0-100). | - |
| <a id="api-property-quiet"></a> `quiet?` | `boolean` | Whether to suppress console output. Default value is true. | - |
| <a id="api-property-streamindex"></a> `streamIndex?` | `number` | The index of the stream/track to extract audio from. If this option is provided, `trackId` is ignored. If `trackId` is not provided and this option is not specified, the first audio stream/track will be extracted. | - |
| <a id="api-property-trackid"></a> `trackId?` | `number` | The ID of the track to extract audio from If this option is provided, `streamIndex` is ignored. If both `trackId` and `streamIndex` are not provided, the first audio stream/track will be extracted. | - |
| <a id="api-property-useparser"></a> `useParser?` | `"auto"` \| `"mp4box"` \| `"remotion"` \| `"isoboxer"` \| `"media-utils"` | Which parser library/package to use The default is 'auto', which will try to use mp4box first and fallback to remotion if mp4box fails. | [`ParserRelatedOptions`](#utilsinterfacesparserrelatedoptionsmd).[`useParser`](#api-property-useparser) |

## Get Media Info


<a id="get-media-inforeadmemd"></a>

### get-media-info

#### Type Aliases

| Type Alias | Description |
| ------ | ------ |
| [GetMediaInfoOptions](#get-media-infotype-aliasesgetmediainfooptionsmd) | - |
| [GetMediaInfoResult](#get-media-infotype-aliasesgetmediainforesultmd) | - |

#### Functions

| Function | Description |
| ------ | ------ |
| [getMediaInfo](#get-media-infofunctionsgetmediainfomd) | Get media information from a stream or a Blob |
| [getMediaInfoFromFile](#get-media-infofunctionsgetmediainfofromfilemd) | Get media information from a file path. The file is read as a Blob (using Node.js `fs.openAsBlob()`), which allows random access without keeping much data in memory. This function works in Node.js environment but not in browser. |

### Functions


<a id="get-media-infofunctionsgetmediainfomd"></a>

#### Function: getMediaInfo()

> **getMediaInfo**(`input`, `optionsInput?`): `Promise`\<[`GetMediaInfoResult`](#get-media-infotype-aliasesgetmediainforesultmd)\>

Get media information from a stream or a Blob

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `input` | [`MediaInput`](#utilstype-aliasesmediainputmd) | The input, either a Web ReadableStream (not Node Readable) or a Blob (a File in the browser is also a Blob). To convert a Node Readable to Web ReadableStream, use `Readable.toWeb(nodeReadable)`. To open a file as a Blob in Node.js, use `fs.openAsBlob(path)`. A Blob is read without keeping much data in memory, see [MediaInput](#utilstype-aliasesmediainputmd). |
| `optionsInput?` | [`GetMediaInfoOptions`](#get-media-infotype-aliasesgetmediainfooptionsmd) | Options for the parser |

##### Returns

`Promise`\<[`GetMediaInfoResult`](#get-media-infotype-aliasesgetmediainforesultmd)\>

The media information


<a id="get-media-infofunctionsgetmediainfofromfilemd"></a>

#### Function: getMediaInfoFromFile()

> **getMediaInfoFromFile**(`filePath`, `options?`): `Promise`\<[`GetMediaInfoResult`](#get-media-infotype-aliasesgetmediainforesultmd)\>

Get media information from a file path.
The file is read as a Blob (using Node.js `fs.openAsBlob()`), which allows random access
without keeping much data in memory.
This function works in Node.js environment but not in browser.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `filePath` | `string` | The path to the media file |
| `options?` | [`GetMediaInfoOptions`](#get-media-infotype-aliasesgetmediainfooptionsmd) | Options for the parser |

##### Returns

`Promise`\<[`GetMediaInfoResult`](#get-media-infotype-aliasesgetmediainforesultmd)\>

The media information

### Type Aliases


<a id="get-media-infotype-aliasesgetmediainfooptionsmd"></a>

#### Type Alias: GetMediaInfoOptions

> **GetMediaInfoOptions** = [`ParserRelatedOptions`](#utilsinterfacesparserrelatedoptionsmd) & `object`

##### Type Declaration

| Name | Type | Description |
| ------ | ------ | ------ |
| `debug?` | `boolean` | Whether to enable debug logging. Default value is false. |
| `maxBytesToRead?` | `number` | The maximum number of bytes (a positive integer) that can be read from the input for determining the media information. If a parser needs to read more than this, a MaxBytesExceededError is thrown (its `isMaxBytesExceededError` is true, and no other parser is tried after it). When the input is a stream, the limit applies to the total number of bytes read from the stream. Because the data read from a stream is kept in memory while parsing (so that another parser can be tried from the beginning of the stream), this option also limits the memory used for a stream input. When the input is a Blob, nothing is kept in memory, and the limit applies to each parsing attempt. Bytes skipped without being read (see [MediaInput](#utilstype-aliasesmediainputmd)) are not counted. Parsers read in blocks (usually 64 KB, and 1 MB for the third-party parsers), and some formats are read to the end (for example MXF, and MP3 without a VBR header), or for some megabytes (MPEG-TS). MP4/MOV files with the `moov` box after the `mdat` box are read to the end too, unless the input is a Blob. So a limit of a few megabytes is recommended, and such files fail with it. Default: no limit. |
| `quiet?` | `boolean` | Whether to suppress console output. Default value is true. |
| `sampleTableInfo?` | `boolean` | Whether to keep and return the sample table information (`sampleTableInfo`) of MP4/MOV audio streams. It is needed when the result is passed to `extractAudio()` as the `mediaInfo` option for an MP4/MOV input. Only the 'media-utils' parser supports it; other parsers ignore it. Ignored for other formats. Default: false (sample tables are not returned to save memory) |


<a id="get-media-infotype-aliasesgetmediainforesultmd"></a>

#### Type Alias: GetMediaInfoResult

> **GetMediaInfoResult** = [`MediaInfo`](#media-infointerfacesmediainfomd) & `object`

##### Type Declaration

| Name | Type | Description |
| ------ | ------ | ------ |
| `bytesRead?` | `number` | Number of bytes read from the stream. In most cases, the parser does not need to read the whole stream. |
| `parser` | `Exclude`\<[`GetMediaInfoOptions`](#get-media-infotype-aliasesgetmediainfooptionsmd)\[`"useParser"`\], `undefined`\> | - |

## Index


<a id="indexreadmemd"></a>

### index

#### References

<a id="api-allaudiocodecs"></a>

##### allAudioCodecs

Re-exports [allAudioCodecs](#media-infofunctionsallaudiocodecsmd)

***

<a id="api-allcontainers"></a>

##### allContainers

Re-exports [allContainers](#media-infofunctionsallcontainersmd)

***

<a id="api-allvideocodecs"></a>

##### allVideoCodecs

Re-exports [allVideoCodecs](#media-infofunctionsallvideocodecsmd)

***

<a id="api-audiocodecdetails"></a>

##### AudioCodecDetails

Re-exports [AudioCodecDetails](#media-infoclassesaudiocodecdetailsmd)

***

<a id="api-audiocodectype"></a>

##### AudioCodecType

Re-exports [AudioCodecType](#media-infotype-aliasesaudiocodectypemd)

***

<a id="api-audiostreaminfo"></a>

##### AudioStreamInfo

Re-exports [AudioStreamInfo](#media-infointerfacesaudiostreaminfomd)

***

<a id="api-containerdetails"></a>

##### ContainerDetails

Re-exports [ContainerDetails](#media-infoclassescontainerdetailsmd)

***

<a id="api-containertype"></a>

##### ContainerType

Re-exports [ContainerType](#media-infotype-aliasescontainertypemd)

***

<a id="api-createreadablestreamfromfile"></a>

##### createReadableStreamFromFile

Re-exports [createReadableStreamFromFile](#utilsfunctionscreatereadablestreamfromfilemd)

***

<a id="api-createwritablestreamfromfile"></a>

##### createWritableStreamFromFile

Re-exports [createWritableStreamFromFile](#utilsfunctionscreatewritablestreamfromfilemd)

***

<a id="api-ensurebufferdata"></a>

##### ensureBufferData

Re-exports [ensureBufferData](#utilsfunctionsensurebufferdatamd)

***

<a id="api-extractaudio"></a>

##### extractAudio

Re-exports [extractAudio](#extract-audiofunctionsextractaudiomd)

***

<a id="api-extractaudiofromfile"></a>

##### extractAudioFromFile

Re-exports [extractAudioFromFile](#extract-audiofunctionsextractaudiofromfilemd)

***

<a id="api-extractaudiofromfiletofile"></a>

##### extractAudioFromFileToFile

Re-exports [extractAudioFromFileToFile](#extract-audiofunctionsextractaudiofromfiletofilemd)

***

<a id="api-extractaudiooptions"></a>

##### ExtractAudioOptions

Re-exports [ExtractAudioOptions](#extract-audiointerfacesextractaudiooptionsmd)

***

<a id="api-findaudiocodec"></a>

##### findAudioCodec

Re-exports [findAudioCodec](#media-infofunctionsfindaudiocodecmd)

***

<a id="api-findcontainer"></a>

##### findContainer

Re-exports [findContainer](#media-infofunctionsfindcontainermd)

***

<a id="api-findvideocodec"></a>

##### findVideoCodec

Re-exports [findVideoCodec](#media-infofunctionsfindvideocodecmd)

***

<a id="api-getgloballogger"></a>

##### getGlobalLogger

Re-exports [getGlobalLogger](#utilsfunctionsgetgloballoggermd)

***

<a id="api-getmediainfo"></a>

##### getMediaInfo

Re-exports [getMediaInfo](#get-media-infofunctionsgetmediainfomd)

***

<a id="api-getmediainfofromfile"></a>

##### getMediaInfoFromFile

Re-exports [getMediaInfoFromFile](#get-media-infofunctionsgetmediainfofromfilemd)

***

<a id="api-getmediainfooptions"></a>

##### GetMediaInfoOptions

Re-exports [GetMediaInfoOptions](#get-media-infotype-aliasesgetmediainfooptionsmd)

***

<a id="api-getmediainforesult"></a>

##### GetMediaInfoResult

Re-exports [GetMediaInfoResult](#get-media-infotype-aliasesgetmediainforesultmd)

***

<a id="api-isblobinput"></a>

##### isBlobInput

Re-exports [isBlobInput](#utilsfunctionsisblobinputmd)

***

<a id="api-ispcm"></a>

##### isPCM

Re-exports [isPCM](#media-infofunctionsispcmmd)

***

<a id="api-iswma"></a>

##### isWMA

Re-exports [isWMA](#media-infofunctionsiswmamd)

***

<a id="api-maxbytesexceedederror"></a>

##### MaxBytesExceededError

Re-exports [MaxBytesExceededError](#utilsclassesmaxbytesexceedederrormd)

***

<a id="api-mediainfo"></a>

##### MediaInfo

Re-exports [MediaInfo](#media-infointerfacesmediainfomd)

***

<a id="api-mediainput"></a>

##### MediaInput

Re-exports [MediaInput](#utilstype-aliasesmediainputmd)

***

<a id="api-parserrelatedoptions"></a>

##### ParserRelatedOptions

Re-exports [ParserRelatedOptions](#utilsinterfacesparserrelatedoptionsmd)

***

<a id="api-parsingerror"></a>

##### ParsingError

Re-exports [ParsingError](#utilsinterfacesparsingerrormd)

***

<a id="api-readbeginning"></a>

##### readBeginning

Re-exports [readBeginning](#utilsfunctionsreadbeginningmd)

***

<a id="api-readfromstreamtofile"></a>

##### readFromStreamToFile

Re-exports [readFromStreamToFile](#utilsfunctionsreadfromstreamtofilemd)

***

<a id="api-setupgloballogger"></a>

##### setupGlobalLogger

Re-exports [setupGlobalLogger](#utilsfunctionssetupgloballoggermd)

***

<a id="api-toaudiocodec"></a>

##### toAudioCodec

Re-exports [toAudioCodec](#media-infofunctionstoaudiocodecmd)

***

<a id="api-tocontainer"></a>

##### toContainer

Re-exports [toContainer](#media-infofunctionstocontainermd)

***

<a id="api-tovideocodec"></a>

##### toVideoCodec

Re-exports [toVideoCodec](#media-infofunctionstovideocodecmd)

***

<a id="api-unsupportedformaterror"></a>

##### UnsupportedFormatError

Re-exports [UnsupportedFormatError](#utilsclassesunsupportedformaterrormd)

***

<a id="api-videocodecdetails"></a>

##### VideoCodecDetails

Re-exports [VideoCodecDetails](#media-infoclassesvideocodecdetailsmd)

***

<a id="api-videocodectype"></a>

##### VideoCodecType

Re-exports [VideoCodecType](#media-infotype-aliasesvideocodectypemd)

***

<a id="api-videostreaminfo"></a>

##### VideoStreamInfo

Re-exports [VideoStreamInfo](#media-infointerfacesvideostreaminfomd)

## Input Streams


<a id="input-streamsreadmemd"></a>

### input-streams

#### Interfaces

| Interface | Description |
| ------ | ------ |
| [LimitedStream](#input-streamsinterfaceslimitedstreammd) | A stream that counts and limits the bytes read from an underlying stream. |
| [RandomAccessInput](#input-streamsinterfacesrandomaccessinputmd) | Random access to the input, available when the input is a Blob. |
| [ReadCounter](#input-streamsinterfacesreadcountermd) | Shared byte counter used by [createLimitedStream](#input-streamsfunctionscreatelimitedstreammd). |

#### Functions

| Function | Description |
| ------ | ------ |
| [createLimitedStream](#input-streamsfunctionscreatelimitedstreammd) | Wraps a stream so that the bytes read are counted, and the stream errors with [MaxBytesExceededError](#utilsclassesmaxbytesexceedederrormd) when more than `counter.maxBytesToRead` bytes would be needed. |
| [createRandomAccessInput](#input-streamsfunctionscreaterandomaccessinputmd) | Creates the random access helper for a Blob, with all the streams sharing the same counter. |
| [openInputStream](#input-streamsfunctionsopeninputstreammd) | Opens a stream from the beginning of the input. If the input is a Blob, a new stream is created from it and the limit is applied to it. If the input is a stream, it is returned as is (the limit, if any, is applied by the caller). |
| [validateMaxBytesToRead](#input-streamsfunctionsvalidatemaxbytestoreadmd) | Validates the `maxBytesToRead` option. |

### Functions


<a id="input-streamsfunctionscreatelimitedstreammd"></a>

#### Function: createLimitedStream()

> **createLimitedStream**(`source`, `counter`): [`LimitedStream`](#input-streamsinterfaceslimitedstreammd)

**`Internal`**

Wraps a stream so that the bytes read are counted, and the stream errors with [MaxBytesExceededError](#utilsclassesmaxbytesexceedederrormd)
when more than `counter.maxBytesToRead` bytes would be needed.

Bytes are pulled from the underlying stream only when the returned stream is read (high water mark 0),
so that nothing is read ahead.
Several limited streams can share the same counter, the limit then applies to the total.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `source` | `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\> | The underlying stream |
| `counter` | [`ReadCounter`](#input-streamsinterfacesreadcountermd) | The counter, possibly shared |

##### Returns

[`LimitedStream`](#input-streamsinterfaceslimitedstreammd)

The limited stream and a function for cancelling the underlying stream


<a id="input-streamsfunctionscreaterandomaccessinputmd"></a>

#### Function: createRandomAccessInput()

> **createRandomAccessInput**(`blob`, `counter`): [`RandomAccessInput`](#input-streamsinterfacesrandomaccessinputmd)

**`Internal`**

Creates the random access helper for a Blob, with all the streams sharing the same counter.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `blob` | `Blob` | The Blob |
| `counter` | [`ReadCounter`](#input-streamsinterfacesreadcountermd) | The counter, which also carries the limit |

##### Returns

[`RandomAccessInput`](#input-streamsinterfacesrandomaccessinputmd)

The random access helper


<a id="input-streamsfunctionsopeninputstreammd"></a>

#### Function: openInputStream()

> **openInputStream**(`input`, `maxBytesToRead?`): `object`

**`Internal`**

Opens a stream from the beginning of the input.
If the input is a Blob, a new stream is created from it and the limit is applied to it.
If the input is a stream, it is returned as is (the limit, if any, is applied by the caller).

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `input` | [`MediaInput`](#utilstype-aliasesmediainputmd) | The input |
| `maxBytesToRead?` | `number` | Optional limit, only applied when the input is a Blob |

##### Returns

`object`

The stream, and a function to be called when done, which cancels the stream if it was opened from a Blob

| Name | Type |
| ------ | ------ |
| `close()` | () => `void` |
| `stream` | `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\> |


<a id="input-streamsfunctionsvalidatemaxbytestoreadmd"></a>

#### Function: validateMaxBytesToRead()

> **validateMaxBytesToRead**(`maxBytesToRead`): `number` \| `undefined`

Validates the `maxBytesToRead` option.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `maxBytesToRead` | `number` \| `null` \| `undefined` | The value of the option |

##### Returns

`number` \| `undefined`

The value if it is valid, or undefined if there is no limit

### Interfaces


<a id="input-streamsinterfaceslimitedstreammd"></a>

#### Interface: LimitedStream

**`Internal`**

A stream that counts and limits the bytes read from an underlying stream.

##### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="api-property-stream"></a> `stream` | `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\> | The stream to be read |

##### Methods

<a id="api-cancelsource"></a>

###### cancelSource()

> **cancelSource**(): `void`

Stops reading from the underlying stream and cancels it immediately, without waiting for the cancellation to complete.
(Cancelling a branch of a teed stream doesn't complete until the other branch is cancelled too.)
The limited stream closes, as if the underlying stream had ended.

####### Returns

`void`


<a id="input-streamsinterfacesrandomaccessinputmd"></a>

#### Interface: RandomAccessInput

**`Internal`**

Random access to the input, available when the input is a Blob.

##### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="api-property-size"></a> `size` | `number` | Total size of the input in bytes |

##### Methods

<a id="api-close"></a>

###### close()

> **close**(): `void`

Cancels all the streams opened by `streamFrom()`, whether or not their readers have been released.

####### Returns

`void`

***

<a id="api-streamfrom"></a>

###### streamFrom()

> **streamFrom**(`offset`): `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Opens a new stream that starts at the given offset

####### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `offset` | `number` | The offset from the beginning of the input |

####### Returns

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The stream


<a id="input-streamsinterfacesreadcountermd"></a>

#### Interface: ReadCounter

**`Internal`**

Shared byte counter used by [createLimitedStream](#input-streamsfunctionscreatelimitedstreammd).

##### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="api-property-bytesread"></a> `bytesRead` | `number` | Number of bytes passed through so far |
| <a id="api-property-maxbytestoread"></a> `maxBytesToRead?` | `number` | Maximum number of bytes allowed to pass through, undefined means no limit |

## Media Info


<a id="media-inforeadmemd"></a>

### media-info

#### Classes

| Class | Description |
| ------ | ------ |
| [AudioCodecDetails](#media-infoclassesaudiocodecdetailsmd) | - |
| [ContainerDetails](#media-infoclassescontainerdetailsmd) | - |
| [VideoCodecDetails](#media-infoclassesvideocodecdetailsmd) | - |

#### Interfaces

| Interface | Description |
| ------ | ------ |
| [AudioStreamInfo](#media-infointerfacesaudiostreaminfomd) | - |
| [MediaInfo](#media-infointerfacesmediainfomd) | - |
| [VideoStreamInfo](#media-infointerfacesvideostreaminfomd) | - |

#### Type Aliases

| Type Alias | Description |
| ------ | ------ |
| [AudioCodecType](#media-infotype-aliasesaudiocodectypemd) | - |
| [ContainerType](#media-infotype-aliasescontainertypemd) | - |
| [VideoCodecType](#media-infotype-aliasesvideocodectypemd) | - |

#### Functions

| Function | Description |
| ------ | ------ |
| [allAudioCodecs](#media-infofunctionsallaudiocodecsmd) | Get all audio codecs with their details |
| [allContainers](#media-infofunctionsallcontainersmd) | Get all containers with their details |
| [allVideoCodecs](#media-infofunctionsallvideocodecsmd) | Get all video codecs with their details |
| [findAudioCodec](#media-infofunctionsfindaudiocodecmd) | Find the matching audio codec for a given code |
| [findContainer](#media-infofunctionsfindcontainermd) | Find the matching container for a given code |
| [findVideoCodec](#media-infofunctionsfindvideocodecmd) | Find the matching video codec for a given code |
| [isPCM](#media-infofunctionsispcmmd) | Check if the audio codec is a PCM (including ADPCM) codec |
| [isWMA](#media-infofunctionsiswmamd) | Check if the audio codec is a WMA codec |
| [toAudioCodec](#media-infofunctionstoaudiocodecmd) | Find the matching audio codec for a given code |
| [toContainer](#media-infofunctionstocontainermd) | Find the matching container for a given code |
| [toVideoCodec](#media-infofunctionstovideocodecmd) | Find the matching video codec for a given code |

### Classes


<a id="media-infoclassesaudiocodecdetailsmd"></a>

#### Class: AudioCodecDetails\<T\>

##### Type Parameters

| Type Parameter |
| ------ |
| <a id="api-type-parameter-t"></a> `T` *extends* `string` |

##### Constructors

<a id="api-constructor"></a>

###### Constructor

> **new AudioCodecDetails**\<`T`\>(`code`, `defaultContainer`, `aliases`): `AudioCodecDetails`\<`T`\>

####### Parameters

| Parameter | Type |
| ------ | ------ |
| `code` | `T` |
| `defaultContainer` | `"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"mxf"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` |
| `aliases` | (`string` \| `RegExp`)[] |

####### Returns

`AudioCodecDetails`\<`T`\>

##### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="api-property-aliases"></a> `aliases` | `public readonly` | (`string` \| `RegExp`)[] |
| <a id="api-property-code"></a> `code` | `public readonly` | `T` |
| <a id="api-property-defaultcontainer"></a> `defaultContainer` | `public readonly` | `"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"mxf"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` |


<a id="media-infoclassescontainerdetailsmd"></a>

#### Class: ContainerDetails\<T\>

##### Type Parameters

| Type Parameter |
| ------ |
| <a id="api-type-parameter-t"></a> `T` *extends* `string` |

##### Constructors

<a id="api-constructor"></a>

###### Constructor

> **new ContainerDetails**\<`T`\>(`code`, `fileExtension`, `aliases`): `ContainerDetails`\<`T`\>

####### Parameters

| Parameter | Type |
| ------ | ------ |
| `code` | `T` |
| `fileExtension` | `string` |
| `aliases` | (`string` \| `RegExp`)[] |

####### Returns

`ContainerDetails`\<`T`\>

##### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="api-property-aliases"></a> `aliases` | `public readonly` | (`string` \| `RegExp`)[] |
| <a id="api-property-code"></a> `code` | `public readonly` | `T` |
| <a id="api-property-fileextension"></a> `fileExtension` | `public readonly` | `string` |


<a id="media-infoclassesvideocodecdetailsmd"></a>

#### Class: VideoCodecDetails\<T\>

##### Type Parameters

| Type Parameter |
| ------ |
| <a id="api-type-parameter-t"></a> `T` *extends* `string` |

##### Constructors

<a id="api-constructor"></a>

###### Constructor

> **new VideoCodecDetails**\<`T`\>(`code`, `aliases`): `VideoCodecDetails`\<`T`\>

####### Parameters

| Parameter | Type |
| ------ | ------ |
| `code` | `T` |
| `aliases` | (`string` \| `RegExp`)[] |

####### Returns

`VideoCodecDetails`\<`T`\>

##### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="api-property-aliases"></a> `aliases` | `public readonly` | (`string` \| `RegExp`)[] |
| <a id="api-property-code"></a> `code` | `public readonly` | `T` |

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

> **allContainers**(): [`ContainerDetails`](#media-infoclassescontainerdetailsmd)\<`"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"mxf"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"`\>[]

Get all containers with their details

##### Returns

[`ContainerDetails`](#media-infoclassescontainerdetailsmd)\<`"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"mxf"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"`\>[]

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

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `code` | `string` \| `null` \| `undefined` | A code which could be a codec identifier (e.g., "mp4a.40.2", "opus", "mp3") or anything else |

##### Returns

[`AudioCodecDetails`](#media-infoclassesaudiocodecdetailsmd)\<`"unknown"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` \| `"opus"` \| `"aac_latm"` \| `"wmav1"` \| `"wmav2"` \| `"wmapro"` \| `"wmalossless"` \| `"vorbis"` \| `"pcm_u8"` \| `"pcm_s16le"` \| `"pcm_s24le"` \| `"pcm_s32le"` \| `"pcm_s16be"` \| `"pcm_s24be"` \| `"pcm_s32be"` \| `"pcm_f32le"` \| `"pcm_alaw"` \| `"pcm_mulaw"` \| `"alac"` \| `"adpcm_ms"` \| `"adpcm_ima_wav"` \| `"eac3"`\> \| `undefined`

Details of the audio codec found, or undefined if no matching codec can be found.


<a id="media-infofunctionsfindcontainermd"></a>

#### Function: findContainer()

> **findContainer**(`code`): [`ContainerDetails`](#media-infoclassescontainerdetailsmd)\<`"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"mxf"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"`\> \| `undefined`

Find the matching container for a given code

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `code` | `string` \| `null` \| `undefined` | A code which could be a MP4 brand identifier (e.g., "isom", "iso2", "mp41") or anything else |

##### Returns

[`ContainerDetails`](#media-infoclassescontainerdetailsmd)\<`"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"mxf"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"`\> \| `undefined`

Details of the container found, or undefined if no matching container can be found.


<a id="media-infofunctionsfindvideocodecmd"></a>

#### Function: findVideoCodec()

> **findVideoCodec**(`code`): [`VideoCodecDetails`](#media-infoclassesvideocodecdetailsmd)\<`"unknown"` \| `"h264"` \| `"hevc"` \| `"vp8"` \| `"vp9"` \| `"wmv2"` \| `"av1"` \| `"prores"` \| `"mpeg4"` \| `"mpeg2video"` \| `"theora"` \| `"mjpeg"` \| `"msmpeg4v2"` \| `"mpeg1video"`\> \| `undefined`

Find the matching video codec for a given code

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `code` | `string` \| `null` \| `undefined` | A code which could be a codec identifier (e.g., "avc", "hevc", "vp09") or anything else |

##### Returns

[`VideoCodecDetails`](#media-infoclassesvideocodecdetailsmd)\<`"unknown"` \| `"h264"` \| `"hevc"` \| `"vp8"` \| `"vp9"` \| `"wmv2"` \| `"av1"` \| `"prores"` \| `"mpeg4"` \| `"mpeg2video"` \| `"theora"` \| `"mjpeg"` \| `"msmpeg4v2"` \| `"mpeg1video"`\> \| `undefined`

Details of the video codec found, or undefined if no matching codec can be found.


<a id="media-infofunctionsispcmmd"></a>

#### Function: isPCM()

> **isPCM**(`audioCodec`): `boolean`

Check if the audio codec is a PCM (including ADPCM) codec

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `audioCodec` | `string` \| `null` \| `undefined` | The audio codec to check |

##### Returns

`boolean`

True if the audio codec is a PCM codec, false otherwise


<a id="media-infofunctionsiswmamd"></a>

#### Function: isWMA()

> **isWMA**(`audioCodec`): `boolean`

Check if the audio codec is a WMA codec

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `audioCodec` | `string` \| `null` \| `undefined` | The audio codec to check |

##### Returns

`boolean`

True if the audio codec is a WMA codec, false otherwise


<a id="media-infofunctionstoaudiocodecmd"></a>

#### Function: toAudioCodec()

> **toAudioCodec**(`code`): [`AudioCodecDetails`](#media-infoclassesaudiocodecdetailsmd)\<`"unknown"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` \| `"opus"` \| `"aac_latm"` \| `"wmav1"` \| `"wmav2"` \| `"wmapro"` \| `"wmalossless"` \| `"vorbis"` \| `"pcm_u8"` \| `"pcm_s16le"` \| `"pcm_s24le"` \| `"pcm_s32le"` \| `"pcm_s16be"` \| `"pcm_s24be"` \| `"pcm_s32be"` \| `"pcm_f32le"` \| `"pcm_alaw"` \| `"pcm_mulaw"` \| `"alac"` \| `"adpcm_ms"` \| `"adpcm_ima_wav"` \| `"eac3"`\>

Find the matching audio codec for a given code

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `code` | `string` \| `null` \| `undefined` | A code which could be a codec identifier (e.g., "mp4a.40.2", "opus", "mp3") or anything else |

##### Returns

[`AudioCodecDetails`](#media-infoclassesaudiocodecdetailsmd)\<`"unknown"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` \| `"opus"` \| `"aac_latm"` \| `"wmav1"` \| `"wmav2"` \| `"wmapro"` \| `"wmalossless"` \| `"vorbis"` \| `"pcm_u8"` \| `"pcm_s16le"` \| `"pcm_s24le"` \| `"pcm_s32le"` \| `"pcm_s16be"` \| `"pcm_s24be"` \| `"pcm_s32be"` \| `"pcm_f32le"` \| `"pcm_alaw"` \| `"pcm_mulaw"` \| `"alac"` \| `"adpcm_ms"` \| `"adpcm_ima_wav"` \| `"eac3"`\>

Details of the audio codec found, or throws an error if no matching codec can be found.


<a id="media-infofunctionstocontainermd"></a>

#### Function: toContainer()

> **toContainer**(`code`): [`ContainerDetails`](#media-infoclassescontainerdetailsmd)\<`"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"mxf"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"`\>

Find the matching container for a given code

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `code` | `string` \| `string`[] \| `null` \| `undefined` | A code or an array of MP4 brand identifiers (e.g., ["isom", "iso2", "mp41"]) |

##### Returns

[`ContainerDetails`](#media-infoclassescontainerdetailsmd)\<`"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"mxf"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"`\>

Details of the container found, or throws an error if no matching container can be found.


<a id="media-infofunctionstovideocodecmd"></a>

#### Function: toVideoCodec()

> **toVideoCodec**(`code`): [`VideoCodecDetails`](#media-infoclassesvideocodecdetailsmd)\<`"unknown"` \| `"h264"` \| `"hevc"` \| `"vp8"` \| `"vp9"` \| `"wmv2"` \| `"av1"` \| `"prores"` \| `"mpeg4"` \| `"mpeg2video"` \| `"theora"` \| `"mjpeg"` \| `"msmpeg4v2"` \| `"mpeg1video"`\>

Find the matching video codec for a given code

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `code` | `string` \| `null` \| `undefined` | A code which could be a codec identifier (e.g., "avc", "hevc", "vp09") or anything else |

##### Returns

[`VideoCodecDetails`](#media-infoclassesvideocodecdetailsmd)\<`"unknown"` \| `"h264"` \| `"hevc"` \| `"vp8"` \| `"vp9"` \| `"wmv2"` \| `"av1"` \| `"prores"` \| `"mpeg4"` \| `"mpeg2video"` \| `"theora"` \| `"mjpeg"` \| `"msmpeg4v2"` \| `"mpeg1video"`\>

Details of the video codec found, or throws an error if no matching codec can be found.

### Interfaces


<a id="media-infointerfacesaudiostreaminfomd"></a>

#### Interface: AudioStreamInfo

##### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="api-property-audiotype"></a> `audioType?` | `string` | Such like Music, Effects, Visual impaired / Audio description, Hearing impaired |
| <a id="api-property-bitrate"></a> `bitrate?` | `number` | - |
| <a id="api-property-bitspersample"></a> `bitsPerSample?` | `number` | - |
| <a id="api-property-channelcount"></a> `channelCount?` | `number` | - |
| <a id="api-property-codec"></a> `codec` | `"unknown"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` \| `"opus"` \| `"aac_latm"` \| `"wmav1"` \| `"wmav2"` \| `"wmapro"` \| `"wmalossless"` \| `"vorbis"` \| `"pcm_u8"` \| `"pcm_s16le"` \| `"pcm_s24le"` \| `"pcm_s32le"` \| `"pcm_s16be"` \| `"pcm_s24be"` \| `"pcm_s32be"` \| `"pcm_f32le"` \| `"pcm_alaw"` \| `"pcm_mulaw"` \| `"alac"` \| `"adpcm_ms"` \| `"adpcm_ima_wav"` \| `"eac3"` | - |
| <a id="api-property-codecdetail"></a> `codecDetail?` | `string` | Parser-specific codec information |
| <a id="api-property-codecdetails"></a> `codecDetails?` | `object` | Codec-specific details (stream-level properties) For ADPCM codecs (MS ADPCM, IMA ADPCM, etc.), these properties are constant for the entire audio stream and stored once in the container's format header: - WAV: in the fmt chunk - AVI: in the stream format chunk (strf) - MKV (A_MS/ACM): inside the CodecPrivate WAVEFORMATEX These values do NOT change per block/frame. |
| `codecDetails.asvc?` | `number` | - |
| `codecDetails.blockAlign?` | `number` | Block align (nBlockAlign) — STREAM LEVEL The size (in bytes) of each encoded ADPCM block. Must remain constant for the whole stream. - Containers expect every read operation to start on a block boundary - ADPCM decoding requires knowing block size ahead of time - Every ADPCM block in the stream must be exactly blockAlign bytes Not stored per block — the block itself does not announce its own length. |
| `codecDetails.bsmod?` | `number` | - |
| `codecDetails.componentType?` | `number` | - |
| `codecDetails.essenceTrackNumber?` | `number` | In an MXF file, the video and audio data (the "essence") are stored in packets called KLVs. Every essence KLV starts with a 16-byte Universal Label (UL) that acts as a header. The essenceTrackNumber is a 4-byte value (e.g., 0x15010000 or 0x16010000) that is embedded inside those 16-byte headers to identify which stream the data belongs to. - Prefix 0x15: Usually indicates Video essence. - Prefix 0x16: Usually indicates Sound essence. - The suffix: Differentiates between multiple tracks of the same type (e.g., 0x1601 for the first audio track, 0x1602 for the second). |
| `codecDetails.formatTag?` | `number` | Format tag (wFormatTag) — STREAM LEVEL Identifies the codec type: - 0x0001 = PCM - 0x0002 = MS ADPCM - 0x0011 = IMA ADPCM - etc. Stored once in the container's format header, not in each block. |
| `codecDetails.layer?` | `number` | Something like layer I, II, III |
| `codecDetails.mainId?` | `number` | - |
| `codecDetails.padding?` | `number` | - |
| `codecDetails.samplesPerBlock?` | `number` | Samples per block — STREAM LEVEL Tells the decoder how many PCM samples will come out of each compressed block. Derived from the codec and blockAlign. Needed because ADPCM uses: - Warm-up samples - 4-bit deltas Also constant for the entire stream. Not stored per block. The block itself contains: - Predictor index - Delta (step size) - Warm-up samples - 4-bit deltas ...but NOT samples-per-block (that's known from the stream header). |
| <a id="api-property-durationinseconds"></a> `durationInSeconds?` | `number` | - |
| <a id="api-property-id"></a> `id` | `number` | - |
| <a id="api-property-language"></a> `language?` | `string` | Usually it is ISO-639 string |
| <a id="api-property-level"></a> `level?` | `string` | - |
| <a id="api-property-profile"></a> `profile?` | `string` | - |
| <a id="api-property-samplerate"></a> `sampleRate?` | `number` | - |
| <a id="api-property-surroundmode"></a> `surroundMode?` | `string` | DTS surround mode |


<a id="media-infointerfacesmediainfomd"></a>

#### Interface: MediaInfo

##### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="api-property-audiostreams"></a> `audioStreams` | [`AudioStreamInfo`](#media-infointerfacesaudiostreaminfomd)[] | - |
| <a id="api-property-container"></a> `container` | `"unknown"` \| `"mp4"` \| `"mov"` \| `"m4a"` \| `"webm"` \| `"mkv"` \| `"avi"` \| `"mpegts"` \| `"mxf"` \| `"wma"` \| `"asf"` \| `"ogg"` \| `"aac"` \| `"mp3"` \| `"flac"` \| `"wav"` \| `"ac3"` \| `"mp2"` \| `"mp1"` \| `"dts"` | - |
| <a id="api-property-containerdetail"></a> `containerDetail?` | `string` | Parser-specific container information |
| <a id="api-property-durationinseconds"></a> `durationInSeconds?` | `number` | - |
| <a id="api-property-mimetype"></a> `mimeType?` | `string` | - |
| <a id="api-property-videostreams"></a> `videoStreams` | [`VideoStreamInfo`](#media-infointerfacesvideostreaminfomd)[] | - |


<a id="media-infointerfacesvideostreaminfomd"></a>

#### Interface: VideoStreamInfo

##### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="api-property-bitrate"></a> `bitrate?` | `number` | - |
| <a id="api-property-codec"></a> `codec` | `"unknown"` \| `"h264"` \| `"hevc"` \| `"vp8"` \| `"vp9"` \| `"wmv2"` \| `"av1"` \| `"prores"` \| `"mpeg4"` \| `"mpeg2video"` \| `"theora"` \| `"mjpeg"` \| `"msmpeg4v2"` \| `"mpeg1video"` | - |
| <a id="api-property-codecdetail"></a> `codecDetail?` | `string` | Parser-specific codec information |
| <a id="api-property-codecdetails"></a> `codecDetails?` | `object` | - |
| `codecDetails.essenceTrackNumber?` | `number` | In an MXF file, the video and audio data (the "essence") are stored in packets called KLVs. Every essence KLV starts with a 16-byte Universal Label (UL) that acts as a header. The essenceTrackNumber is a 4-byte value (e.g., 0x15010000 or 0x16010000) that is embedded inside those 16-byte headers to identify which stream the data belongs to. - Prefix 0x15: Usually indicates Video essence. - Prefix 0x16: Usually indicates Sound essence. - The suffix: Differentiates between multiple tracks of the same type (e.g., 0x1601 for the first audio track, 0x1602 for the second). |
| <a id="api-property-durationinseconds"></a> `durationInSeconds?` | `number` | - |
| <a id="api-property-fps"></a> `fps?` | `number` | - |
| <a id="api-property-height"></a> `height?` | `number` | - |
| <a id="api-property-id"></a> `id` | `number` | - |
| <a id="api-property-level"></a> `level?` | `string` | - |
| <a id="api-property-profile"></a> `profile?` | `string` | - |
| <a id="api-property-width"></a> `width?` | `number` | - |

### Type Aliases


<a id="media-infotype-aliasesaudiocodectypemd"></a>

#### Type Alias: AudioCodecType

> **AudioCodecType** = keyof *typeof* `audioCodecs`


<a id="media-infotype-aliasescontainertypemd"></a>

#### Type Alias: ContainerType

> **ContainerType** = keyof *typeof* `containers`


<a id="media-infotype-aliasesvideocodectypemd"></a>

#### Type Alias: VideoCodecType

> **VideoCodecType** = keyof *typeof* `videoCodecs`

## Utils


<a id="utilsreadmemd"></a>

### utils

#### Classes

| Class | Description |
| ------ | ------ |
| [MaxBytesExceededError](#utilsclassesmaxbytesexceedederrormd) | Error thrown when the media information could not be determined without reading more than the number of bytes allowed by the `maxBytesToRead` option. |
| [UnsupportedFormatError](#utilsclassesunsupportedformaterrormd) | Error thrown when a parser encounters an unsupported file format or invalid data. |

#### Interfaces

| Interface | Description |
| ------ | ------ |
| [ParserRelatedOptions](#utilsinterfacesparserrelatedoptionsmd) | - |
| [ParsingError](#utilsinterfacesparsingerrormd) | - |

#### Type Aliases

| Type Alias | Description |
| ------ | ------ |
| [MediaInput](#utilstype-aliasesmediainputmd) | The input of the functions that read media data. It can be a Web ReadableStream, or a Blob (a File in the browser is also a Blob). |

#### Functions

| Function | Description |
| ------ | ------ |
| [createReadableStreamFromFile](#utilsfunctionscreatereadablestreamfromfilemd) | Creates a Web ReadableStream from a Node.js file path. This function works in Node.js environment but not in browser. |
| [createWritableStreamFromFile](#utilsfunctionscreatewritablestreamfromfilemd) | Creates a Web WritableStream from a Node.js file path. This function works in Node.js environment but not in browser. |
| [ensureBufferData](#utilsfunctionsensurebufferdatamd) | Ensures that the buffer has enough data by reading from the stream if necessary. This function manages buffer compaction and appending new data. |
| [getGlobalLogger](#utilsfunctionsgetgloballoggermd) | Returns the global logger for the library. If the logger has not been set, it will be initialized default settings which discards all logs. Please note that environment variables MEDIA_UTILS_LOG_QUIET and MEDIA_UTILS_LOG_DEBUG can be used to override the logging behavior. |
| [isBlobInput](#utilsfunctionsisblobinputmd) | Checks whether the input is a Blob (including File) rather than a ReadableStream. |
| [readBeginning](#utilsfunctionsreadbeginningmd) | Reads the beginning of a stream up to a specified size. This function handles reading, buffering, and closing the reader. |
| [readFromStreamToFile](#utilsfunctionsreadfromstreamtofilemd) | Reads a Web ReadableStream and writes it to a file. This function works in Node.js environment but not in browser. |
| [setupGlobalLogger](#utilsfunctionssetupgloballoggermd) | Set the global logger for the library to a new console logger. Please note that environment variables MEDIA_UTILS_LOG_QUIET and MEDIA_UTILS_LOG_DEBUG can be used to override the logging behavior. |

### Classes


<a id="utilsclassesmaxbytesexceedederrormd"></a>

#### Class: MaxBytesExceededError

Error thrown when the media information could not be determined
without reading more than the number of bytes allowed by the `maxBytesToRead` option.

##### Extends

- `Error`

##### Implements

- [`ParsingError`](#utilsinterfacesparsingerrormd)

##### Constructors

<a id="api-constructor"></a>

###### Constructor

> **new MaxBytesExceededError**(`maxBytesToRead`): `MaxBytesExceededError`

####### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `maxBytesToRead` | `number` | The limit that has been reached |

####### Returns

`MaxBytesExceededError`

####### Overrides

`Error.constructor`

##### Properties

| Property | Modifier | Type | Default value | Description |
| ------ | ------ | ------ | ------ | ------ |
| <a id="api-property-ismaxbytesexceedederror"></a> `isMaxBytesExceededError` | `readonly` | `true` | `true` | - |
| <a id="api-property-maxbytestoread"></a> `maxBytesToRead` | `readonly` | `number` | `undefined` | The limit that has been reached |


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

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |

####### Returns

`UnsupportedFormatError`

####### Overrides

`Error.constructor`

##### Properties

| Property | Modifier | Type | Default value |
| ------ | ------ | ------ | ------ |
| <a id="api-property-isunsupportedformaterror"></a> `isUnsupportedFormatError` | `readonly` | `true` | `true` |

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

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `filePath` | `string` | The path to the file |

##### Returns

`Promise`\<`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>\>

A (web) ReadableStream of Uint8Array chunks


<a id="utilsfunctionscreatewritablestreamfromfilemd"></a>

#### Function: createWritableStreamFromFile()

> **createWritableStreamFromFile**(`filePath`): `Promise`\<`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>\>

Creates a Web WritableStream from a Node.js file path.
This function works in Node.js environment but not in browser.

**Important:** The caller is responsible for properly consuming or cancelling
the returned stream to ensure the underlying file handle is released.
If the stream is not fully consumed, call `stream.cancel()` to clean up resources.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `filePath` | `string` | The path to the file |

##### Returns

`Promise`\<`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>\>

A (web) WritableStream of Uint8Array chunks


<a id="utilsfunctionsensurebufferdatamd"></a>

#### Function: ensureBufferData()

> **ensureBufferData**(`reader`, `buffer?`, `bufferOffset?`, `size?`): `Promise`\<\{ `buffer`: `Uint8Array`; `bufferOffset`: `number`; `bytesRead`: `number`; `done`: `boolean`; \}\>

Ensures that the buffer has enough data by reading from the stream if necessary.
This function manages buffer compaction and appending new data.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `reader` | `ReadableStreamDefaultReader`\<`Uint8Array`\<`ArrayBufferLike`\>\> | The ReadableStreamDefaultReader to read from |
| `buffer?` | `Uint8Array`\<`ArrayBufferLike`\> | The current data buffer (optional, defaults to empty buffer) |
| `bufferOffset?` | `number` | The current offset in the buffer (optional, defaults to 0) |
| `size?` | `number` | The minimum required size of data available in the buffer (buffer.length - bufferOffset) |

##### Returns

`Promise`\<\{ `buffer`: `Uint8Array`; `bufferOffset`: `number`; `bytesRead`: `number`; `done`: `boolean`; \}\>

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


<a id="utilsfunctionsisblobinputmd"></a>

#### Function: isBlobInput()

> **isBlobInput**(`input`): `input is Blob`

Checks whether the input is a Blob (including File) rather than a ReadableStream.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `input` | `unknown` | The input |

##### Returns

`input is Blob`

true if the input is a Blob


<a id="utilsfunctionsreadbeginningmd"></a>

#### Function: readBeginning()

> **readBeginning**(`reader`, `size?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Reads the beginning of a stream up to a specified size.
This function handles reading, buffering, and closing the reader.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `reader` | `ReadableStreamDefaultReader`\<`Uint8Array`\<`ArrayBufferLike`\>\> | The ReadableStreamDefaultReader to read from |
| `size?` | `number` | The amount of data to read (optional, defaults to 64KB) |

##### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The read data as a Uint8Array


<a id="utilsfunctionsreadfromstreamtofilemd"></a>

#### Function: readFromStreamToFile()

> **readFromStreamToFile**(`stream`, `filePath`): `Promise`\<`void`\>

Reads a Web ReadableStream and writes it to a file.
This function works in Node.js environment but not in browser.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `stream` | `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\> | The readable stream to read from |
| `filePath` | `string` | The path to the file to write to |

##### Returns

`Promise`\<`void`\>


<a id="utilsfunctionssetupgloballoggermd"></a>

#### Function: setupGlobalLogger()

> **setupGlobalLogger**(`flags`): `LineLogger`

Set the global logger for the library to a new console logger.
Please note that environment variables MEDIA_UTILS_LOG_QUIET and MEDIA_UTILS_LOG_DEBUG can be used to override the logging behavior.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `flags` | \{ `debug?`: `boolean`; `quiet?`: `boolean`; \} \| `null` \| `undefined` | The flags to pass to the console logger. |

##### Returns

`LineLogger`

The global logger for the library.

### Interfaces


<a id="utilsinterfacesparserrelatedoptionsmd"></a>

#### Interface: ParserRelatedOptions

##### Extended by

- [`ExtractAudioOptions`](#extract-audiointerfacesextractaudiooptionsmd)

##### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="api-property-useparser"></a> `useParser?` | `"auto"` \| `"mp4box"` \| `"remotion"` \| `"isoboxer"` \| `"media-utils"` | Which parser library/package to use The default is 'auto', which will try to use mp4box first and fallback to remotion if mp4box fails. |


<a id="utilsinterfacesparsingerrormd"></a>

#### Interface: ParsingError

##### Properties

| Property | Type |
| ------ | ------ |
| <a id="api-property-ismaxbytesexceedederror"></a> `isMaxBytesExceededError?` | `boolean` |
| <a id="api-property-isunsupportedformaterror"></a> `isUnsupportedFormatError?` | `boolean` |

### Type Aliases


<a id="utilstype-aliasesmediainputmd"></a>

#### Type Alias: MediaInput

> **MediaInput** = `ReadableStream`\<`Uint8Array`\> \| `Blob`

The input of the functions that read media data.
It can be a Web ReadableStream, or a Blob (a File in the browser is also a Blob).

A Blob allows random access, so that the data can be read more than once and parts of it can be skipped.
For example, for an MP4/MOV file with the `moov` box after the `mdat` box,
the media data in the `mdat` box is skipped instead of being read.
In Node.js (19.8 or later), a file can be opened as a Blob with `fs.openAsBlob(path)`.
<!-- API end -->
