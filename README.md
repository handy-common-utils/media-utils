# @handy-common-utils/media-utils

A pure-JS, no-FFmpeg media info parser and audio stream extractor which works with popular formats and codecs.

## Getting Media Information

This library provides a unified interface to extract media information (duration, video/audio streams, codecs, etc.) from various media formats. It can use its own lightweight in-house parsers or different 3rd party parsers (`mp4box`, `codem-isoboxer`, `@remotion/media-parser`). Those 3rd party parsers are optional dependencies of this library.

### Key Features

- **Unified API**: Get consistent `MediaInfo` object regardless of the parser used.
- **Browser & Node.js**: Works in both environments (file system helpers are Node.js only).
- **Smart Fallback**: The `auto` mode tries parsers in this order:
  1. `media-utils` (In-house): Fast, lightweight, for raw AAC/MP3 files.
  2. `mp4box`: Robust for MP4/MOV files.
  3. `isoboxer`: Alternative for MP4/MOV.
  4. `remotion`: Supports a wider range of formats (WebM, etc.).

### Verified Combinations

| Format   | Codecs      | `auto` | `media-utils` | `mp4box` | `isoboxer` | `remotion` |
| :------- | :---------- | :----: | :-----------: | :------: | :--------: | :--------: |
| **MP4**  | H.264 / AAC |   ✅   |               |    ✅    |     ✅     |     ✅     |
| **MP4**  | H.264 / MP3 |   ✅   |               |    ✅    |     ✅     |     ✅     |
| **MOV**  | H.264 / AAC |   ✅   |               |    ✅    |     ✅     |     ✅     |
| **MOV**  | H.264 / MP3 |   ✅   |               |    ✅    |     ✅     |            |
| **WebM** | VP9 / Opus  |   ✅   |               |          |            |     ✅     |
| **AAC**  | AAC         |   ✅   |      ✅       |          |            |     ✅     |
| **MP3**  | MP3         |   ✅   |      ✅       |          |            |     ✅     |

### Optional Dependencies

To support different formats, you may need to install optional dependencies:

- `mp4box`: Recommended for MP4/MOV support.
- `codem-isoboxer`: Alternative for MP4/MOV.
- `@remotion/media-parser`: Required for WebM and other formats.

This library picks them up automatically if they are installed.

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

You can extract raw audio streams from video files (MP4, MOV) without re-encoding. This is fast and preserves original quality.

### Supported Scenarios

- **Containers**: MP4, MOV (ISO BMFF based).
- **Audio Codecs**:
  - **AAC**: Can be saved as .aac
  - **MP3**: Can be saved as .mp3

### Dependencies

- Requires `mp4box` to be installed.

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

| Module                                                       | Description |
| ------------------------------------------------------------ | ----------- |
| [get-media-info](#get-media-inforeadmemd)                    | -           |
| [index](#indexreadmemd)                                      | -           |
| [media-info](#media-inforeadmemd)                            | -           |
| [parsers/adapter](#parsersadapterreadmemd)                   | -           |
| [parsers/isoboxer-adapter](#parsersisoboxer-adapterreadmemd) | -           |
| [parsers/mp4box-adapter](#parsersmp4box-adapterreadmemd)     | -           |
| [parsers/remotion-adapter](#parsersremotion-adapterreadmemd) | -           |
| [utils](#utilsreadmemd)                                      | -           |

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

> **getMediaInfo**(`stream`, `options?`): `Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd) & `object`\>

Get media information from a stream

##### Parameters

| Parameter  | Type                                                             | Description                                                                                                                             |
| ---------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `stream`   | `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>            | The input Web ReadableStream (not Node Readable). To convert a Node Readable to Web ReadableStream, use `Readable.toWeb(nodeReadable)`. |
| `options?` | [`ParserRelatedOptions`](#utilsinterfacesparserrelatedoptionsmd) | Options for the parser                                                                                                                  |

##### Returns

`Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd) & `object`\>

The media information

<a id="get-media-infofunctionsgetmediainfofromfilemd"></a>

#### Function: getMediaInfoFromFile()

> **getMediaInfoFromFile**(`filePath`, `options?`): `Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd)\>

Get media information from a file path.
This function works in Node.js environment but not in browser.

##### Parameters

| Parameter  | Type                                                             | Description                |
| ---------- | ---------------------------------------------------------------- | -------------------------- |
| `filePath` | `string`                                                         | The path to the media file |
| `options?` | [`ParserRelatedOptions`](#utilsinterfacesparserrelatedoptionsmd) | Options for the parser     |

##### Returns

`Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd)\>

The media information

### Type Aliases

<a id="get-media-infotype-aliasesgetmediainfooptionsmd"></a>

#### Type Alias: GetMediaInfoOptions

> **GetMediaInfoOptions** = [`ParserRelatedOptions`](#utilsinterfacesparserrelatedoptionsmd)

## Index

<a id="indexreadmemd"></a>

### index

#### Functions

| Function                                      | Description                           |
| --------------------------------------------- | ------------------------------------- |
| [extractAudio](#indexfunctionsextractaudiomd) | Extract raw audio data from the input |

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

<a id="api-toaudiocodectype"></a>

##### toAudioCodecType

Re-exports [toAudioCodecType](#media-infofunctionstoaudiocodectypemd)

---

<a id="api-tocontainertype"></a>

##### toContainerType

Re-exports [toContainerType](#media-infofunctionstocontainertypemd)

---

<a id="api-tovideocodectype"></a>

##### toVideoCodecType

Re-exports [toVideoCodecType](#media-infofunctionstovideocodectypemd)

---

<a id="api-videocodectype"></a>

##### VideoCodecType

Re-exports [VideoCodecType](#media-infotype-aliasesvideocodectypemd)

---

<a id="api-videostreaminfo"></a>

##### VideoStreamInfo

Re-exports [VideoStreamInfo](#media-infointerfacesvideostreaminfomd)

### Functions

<a id="indexfunctionsextractaudiomd"></a>

#### Function: extractAudio()

> **extractAudio**(`_input`, `_audioStreamIndex?`): `Promise`\<`ReadableStream`\<`any`\>\>

Extract raw audio data from the input

##### Parameters

| Parameter            | Type             | Description                                         |
| -------------------- | ---------------- | --------------------------------------------------- |
| `_input`             | `ReadableStream` | The input data provided through a readable stream   |
| `_audioStreamIndex?` | `number`         | Index of the audio stream to extract from the input |

##### Returns

`Promise`\<`ReadableStream`\<`any`\>\>

The audio data extracted, as a readable stream

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

#### Functions

| Function                                                   | Description                                              |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| [toAudioCodecType](#media-infofunctionstoaudiocodectypemd) | Converts audio codec string to AudioCodecType            |
| [toContainerType](#media-infofunctionstocontainertypemd)   | Converts brand array or container stringto ContainerType |
| [toVideoCodecType](#media-infofunctionstovideocodectypemd) | Converts video codec string to VideoCodecType            |

### Functions

<a id="media-infofunctionstoaudiocodectypemd"></a>

#### Function: toAudioCodecType()

> **toAudioCodecType**(`codecDetail`): `MediaParserAudioCodec`

Converts audio codec string to AudioCodecType

##### Parameters

| Parameter     | Type                              | Description                                     |
| ------------- | --------------------------------- | ----------------------------------------------- |
| `codecDetail` | `string` \| `null` \| `undefined` | codec string (e.g., "mp4a.40.2", "opus", "mp3") |

##### Returns

`MediaParserAudioCodec`

Standardized audio codec identifier

<a id="media-infofunctionstocontainertypemd"></a>

#### Function: toContainerType()

> **toContainerType**(`brands`): `MediaParserContainer`

Converts brand array or container stringto ContainerType

##### Parameters

| Parameter | Type                                            | Description                                                                        |
| --------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| `brands`  | `string` \| `string`[] \| `null` \| `undefined` | Array of MP4 brand identifiers (e.g., ["isom", "iso2", "mp41"]) or a single string |

##### Returns

`MediaParserContainer`

Standardized container format identifier

<a id="media-infofunctionstovideocodectypemd"></a>

#### Function: toVideoCodecType()

> **toVideoCodecType**(`codecDetail`): `MediaParserVideoCodec`

Converts video codec string to VideoCodecType

##### Parameters

| Parameter     | Type                              | Description                                        |
| ------------- | --------------------------------- | -------------------------------------------------- |
| `codecDetail` | `string` \| `null` \| `undefined` | codec string (e.g., "avc1.64001f", "hvc1", "vp09") |

##### Returns

`MediaParserVideoCodec`

Standardized video codec identifier

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
| <a id="api-samplerate"></a> `sampleRate?`               | `number`                | -                                 |

<a id="media-infointerfacesmediainfomd"></a>

#### Interface: MediaInfo

##### Properties

| Property                                                | Type                                                          | Description                           |
| ------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| <a id="api-audiostreams"></a> `audioStreams`            | [`AudioStreamInfo`](#media-infointerfacesaudiostreaminfomd)[] | -                                     |
| <a id="api-container"></a> `container`                  | `MediaParserContainer`                                        | -                                     |
| <a id="api-containerdetail"></a> `containerDetail?`     | `string`                                                      | Parser-specific container information |
| <a id="api-durationinseconds"></a> `durationInSeconds?` | `number`                                                      | -                                     |
| <a id="api-mimetype"></a> `mimeType?`                   | `string`                                                      | -                                     |
| <a id="api-parser"></a> `parser`                        | `"mp4box"` \| `"remotion"` \| `"isoboxer"` \| `"auto"`        | -                                     |
| <a id="api-videostreams"></a> `videoStreams`            | [`VideoStreamInfo`](#media-infointerfacesvideostreaminfomd)[] | -                                     |

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

## Parsers

### Adapter

<a id="parsersadapterreadmemd"></a>

#### parsers/adapter

##### Classes

| Class                                                                            | Description                                                                                                             |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [FallbackChainParserAdapter](#parsersadapterclassesfallbackchainparseradaptermd) | A composite parser adapter that tries multiple adapters in sequence. It implements the Chain of Responsibility pattern. |

##### Interfaces

| Interface                                                           | Description                                                                                                                                                                               |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [MediaParserAdapter](#parsersadapterinterfacesmediaparseradaptermd) | Interface for media parser adapters. Adapters bridge the gap between the generic media info extraction logic and specific parser implementations (like mp4box or @remotion/media-parser). |
| [ParsingError](#parsersadapterinterfacesparsingerrormd)             | -                                                                                                                                                                                         |

#### Classes

<a id="parsersadapterclassesfallbackchainparseradaptermd"></a>

##### Class: FallbackChainParserAdapter

A composite parser adapter that tries multiple adapters in sequence.
It implements the Chain of Responsibility pattern.

###### Implements

- [`MediaParserAdapter`](#parsersadapterinterfacesmediaparseradaptermd)

###### Constructors

<a id="api-constructor"></a>

####### Constructor

> **new FallbackChainParserAdapter**(`adapters`): `FallbackChainParserAdapter`

Creates a new FallbackChainParserAdapter.

######## Parameters

| Parameter  | Type                                                                    | Description                            |
| ---------- | ----------------------------------------------------------------------- | -------------------------------------- |
| `adapters` | [`MediaParserAdapter`](#parsersadapterinterfacesmediaparseradaptermd)[] | The list of adapters to try, in order. |

######## Returns

`FallbackChainParserAdapter`

###### Methods

<a id="api-parse"></a>

####### parse()

> **parse**(`stream`, `options?`): `Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd)\>

Tries to parse the stream using the first adapter that supports it.

######## Parameters

| Parameter  | Type                                                             | Description                      |
| ---------- | ---------------------------------------------------------------- | -------------------------------- |
| `stream`   | `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>            | The input media stream.          |
| `options?` | [`ParserRelatedOptions`](#utilsinterfacesparserrelatedoptionsmd) | Optional options for the parser. |

######## Returns

`Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd)\>

The extracted media information.

######## Throws

Error from the last paseing attempt.

######## Implementation of

[`MediaParserAdapter`](#parsersadapterinterfacesmediaparseradaptermd).[`parse`](#parse)

#### Interfaces

<a id="parsersadapterinterfacesmediaparseradaptermd"></a>

##### Interface: MediaParserAdapter

Interface for media parser adapters.
Adapters bridge the gap between the generic media info extraction logic
and specific parser implementations (like mp4box or @remotion/media-parser).

###### Methods

<a id="api-parse"></a>

####### parse()

> **parse**(`stream`, `options?`): `Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd)\>

Parses the stream and extracts media information.

######## Parameters

| Parameter  | Type                                                             | Description                      |
| ---------- | ---------------------------------------------------------------- | -------------------------------- |
| `stream`   | `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>            | The input media stream.          |
| `options?` | [`ParserRelatedOptions`](#utilsinterfacesparserrelatedoptionsmd) | Optional options for the parser. |

######## Returns

`Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd)\>

A promise that resolves to the extracted media information.

######## Throws

The Error thrown could implement the ParsingError interface to provide more information about the error.

<a id="parsersadapterinterfacesparsingerrormd"></a>

##### Interface: ParsingError

###### Properties

| Property                                                              | Type      |
| --------------------------------------------------------------------- | --------- |
| <a id="api-isunsupportedformaterror"></a> `isUnsupportedFormatError?` | `boolean` |

### Isoboxer Adapter

<a id="parsersisoboxer-adapterreadmemd"></a>

#### parsers/isoboxer-adapter

##### Classes

| Class                                                               | Description                                                                                                                                                                               |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [IsoBoxerAdapter](#parsersisoboxer-adapterclassesisoboxeradaptermd) | Interface for media parser adapters. Adapters bridge the gap between the generic media info extraction logic and specific parser implementations (like mp4box or @remotion/media-parser). |

#### Classes

<a id="parsersisoboxer-adapterclassesisoboxeradaptermd"></a>

##### Class: IsoBoxerAdapter

Interface for media parser adapters.
Adapters bridge the gap between the generic media info extraction logic
and specific parser implementations (like mp4box or @remotion/media-parser).

###### Implements

- [`MediaParserAdapter`](#parsersadapterinterfacesmediaparseradaptermd)

###### Constructors

<a id="api-constructor"></a>

####### Constructor

> **new IsoBoxerAdapter**(): `IsoBoxerAdapter`

######## Returns

`IsoBoxerAdapter`

###### Methods

<a id="api-parse"></a>

####### parse()

> **parse**(`stream`, `options?`): `Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd)\>

Parses the stream and extracts media information.

######## Parameters

| Parameter  | Type                                                             | Description                      |
| ---------- | ---------------------------------------------------------------- | -------------------------------- |
| `stream`   | `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>            | The input media stream.          |
| `options?` | [`ParserRelatedOptions`](#utilsinterfacesparserrelatedoptionsmd) | Optional options for the parser. |

######## Returns

`Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd)\>

A promise that resolves to the extracted media information.

######## Throws

The Error thrown could implement the ParsingError interface to provide more information about the error.

######## Implementation of

[`MediaParserAdapter`](#parsersadapterinterfacesmediaparseradaptermd).[`parse`](#parse)

### Mp 4 Box Adapter

<a id="parsersmp4box-adapterreadmemd"></a>

#### parsers/mp4box-adapter

##### Classes

| Class                                                         | Description                                                                                                                                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Mp4BoxAdapter](#parsersmp4box-adapterclassesmp4boxadaptermd) | Interface for media parser adapters. Adapters bridge the gap between the generic media info extraction logic and specific parser implementations (like mp4box or @remotion/media-parser). |

#### Classes

<a id="parsersmp4box-adapterclassesmp4boxadaptermd"></a>

##### Class: Mp4BoxAdapter

Interface for media parser adapters.
Adapters bridge the gap between the generic media info extraction logic
and specific parser implementations (like mp4box or @remotion/media-parser).

###### Implements

- [`MediaParserAdapter`](#parsersadapterinterfacesmediaparseradaptermd)

###### Constructors

<a id="api-constructor"></a>

####### Constructor

> **new Mp4BoxAdapter**(): `Mp4BoxAdapter`

######## Returns

`Mp4BoxAdapter`

###### Methods

<a id="api-parse"></a>

####### parse()

> **parse**(`stream`, `options?`): `Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd)\>

Parses the stream and extracts media information.

######## Parameters

| Parameter  | Type                                                             | Description                      |
| ---------- | ---------------------------------------------------------------- | -------------------------------- |
| `stream`   | `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>            | The input media stream.          |
| `options?` | [`ParserRelatedOptions`](#utilsinterfacesparserrelatedoptionsmd) | Optional options for the parser. |

######## Returns

`Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd)\>

A promise that resolves to the extracted media information.

######## Throws

The Error thrown could implement the ParsingError interface to provide more information about the error.

######## Implementation of

[`MediaParserAdapter`](#parsersadapterinterfacesmediaparseradaptermd).[`parse`](#parse)

### Remotion Adapter

<a id="parsersremotion-adapterreadmemd"></a>

#### parsers/remotion-adapter

##### Classes

| Class                                                               | Description                                                                                                                                                                               |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [RemotionAdapter](#parsersremotion-adapterclassesremotionadaptermd) | Interface for media parser adapters. Adapters bridge the gap between the generic media info extraction logic and specific parser implementations (like mp4box or @remotion/media-parser). |

#### Classes

<a id="parsersremotion-adapterclassesremotionadaptermd"></a>

##### Class: RemotionAdapter

Interface for media parser adapters.
Adapters bridge the gap between the generic media info extraction logic
and specific parser implementations (like mp4box or @remotion/media-parser).

###### Implements

- [`MediaParserAdapter`](#parsersadapterinterfacesmediaparseradaptermd)

###### Constructors

<a id="api-constructor"></a>

####### Constructor

> **new RemotionAdapter**(): `RemotionAdapter`

######## Returns

`RemotionAdapter`

###### Methods

<a id="api-parse"></a>

####### parse()

> **parse**(`stream`): `Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd)\>

Parses the stream and extracts media information.

######## Parameters

| Parameter | Type                                                  | Description             |
| --------- | ----------------------------------------------------- | ----------------------- |
| `stream`  | `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\> | The input media stream. |

######## Returns

`Promise`\<[`MediaInfo`](#media-infointerfacesmediainfomd)\>

A promise that resolves to the extracted media information.

######## Throws

The Error thrown could implement the ParsingError interface to provide more information about the error.

######## Implementation of

[`MediaParserAdapter`](#parsersadapterinterfacesmediaparseradaptermd).[`parse`](#parse)

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

### Functions

<a id="utilsfunctionscreatereadablestreamfromfilemd"></a>

#### Function: createReadableStreamFromFile()

> **createReadableStreamFromFile**(`filePath`): `Promise`\<`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>\>

Creates a Web ReadableStream from a Node.js file path.
This function works in Node.js environment but not in browser.

##### Parameters

| Parameter  | Type     | Description          |
| ---------- | -------- | -------------------- |
| `filePath` | `string` | The path to the file |

##### Returns

`Promise`\<`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>\>

A (web) ReadableStream of Uint8Array chunks

### Interfaces

<a id="utilsinterfacesparserrelatedoptionsmd"></a>

#### Interface: ParserRelatedOptions

##### Properties

| Property                                | Type                                                   | Description                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="api-useparser"></a> `useParser?` | `"mp4box"` \| `"remotion"` \| `"isoboxer"` \| `"auto"` | Which parser library/package to use The default is 'auto', which will try to use mp4box first and fallback to remotion if mp4box fails. |

<!-- API end -->
