/* eslint-disable unicorn/prefer-module */
import { replaceInFile } from '@handy-common-utils/fs-utils';
import fs from 'node:fs';
import path from 'node:path';

import { ExtractAudioTestReportItem, GetMediaInfoTestReportItem, TestReportData } from './test-utils';

/**
 * Sorts a Map by its keys and returns a new sorted Map.
 *
 * @param originalMap The Map to be sorted.
 * @returns A new Map with entries sorted by key.
 */
function toSortedMap<T>(originalMap: Map<string, T>): Map<string, T> {
  const entriesArray = [...originalMap.entries()];
  entriesArray.sort((a, b) => a[0].localeCompare(b[0]));
  return new Map(entriesArray);
}

function summariseGetMediaInfo(items: GetMediaInfoTestReportItem[], parser: string) {
  const summary = new Map<string, GetMediaInfoTestReportItem>();
  for (const item of items) {
    if (item.parser !== parser) {
      continue;
    }
    const key = `${item.container}|${item.videoCodec}|${item.audioCodec}|${item.fileRemark}`;
    if (summary.has(key)) {
      const value = summary.get(key)!;
      value.succeeded = value.succeeded && item.succeeded;
    } else {
      summary.set(key, item);
    }
  }
  return toSortedMap(summary);
}

function generateGetMediaInfoMarkdownTable(data: Map<string, GetMediaInfoTestReportItem>): string {
  const lines = new Array<string>();
  lines.push('| Format/Container | Video Codec | Audio Codec(s) | File Remark | Supported |', '| :--- | :--- | :--- | :--- | :---: |');

  for (const [_, entry] of data) {
    const supportedMark = entry.succeeded ? '✅' : '❌';
    const row = `| __${entry.container}__ | ${entry.videoCodec || ''} | ${entry.audioCodec || ''} | ${entry.fileRemark || ''} | ${supportedMark} |`;
    lines.push(row);
  }
  return lines.join('\n');
}

function summariseExtractAudio(items: ExtractAudioTestReportItem[]) {
  const summary = new Map<string, ExtractAudioTestReportItem>();
  for (const item of items) {
    const key = `${item.container}|${item.videoCodec}|${item.audioCodec}|${item.fileRemark}|${item.extractedAudioCodec}`;
    if (summary.has(key)) {
      const value = summary.get(key)!;
      value.succeeded = value.succeeded && item.succeeded;
    } else {
      summary.set(key, item);
    }
  }
  return toSortedMap(summary);
}

function generateExtractAudioMarkdownTable(data: Map<string, ExtractAudioTestReportItem>): string {
  const lines = new Array<string>();
  lines.push(
    '| Format/Container | Video Codec | Audio Codec(s) | File Remark | Supported | Extracted Audio |',
    '| :--- | :--- | :--- | :--- | :---: | :--- |',
  );

  for (const [_, entry] of data) {
    const supportedMark = entry.succeeded ? '✅' : '❌';
    const row = `| __${entry.container}__ | ${entry.videoCodec || ''} | ${entry.audioCodec || ''} | ${entry.fileRemark || ''} | ${supportedMark} | ${entry.succeeded ? `__${entry.extractedAudioCodec}__ in __${entry.extractedAudioContainer}__` : ''} |`;
    lines.push(row);
  }
  return lines.join('\n');
}

/**
 * Main function to read the file, process data, and generate the table.
 */
async function main() {
  const dataFilePath = path.resolve(__dirname, 'output/test-report.json');

  const dataFileContent = fs.readFileSync(dataFilePath, 'utf8');
  const reportData = JSON.parse(dataFileContent) as TestReportData;

  const getMediaInfoSummary = summariseGetMediaInfo(reportData.getMediaInfo, 'media-utils');
  const getMediaInfoMarkdownTable = generateGetMediaInfoMarkdownTable(getMediaInfoSummary);
  await replaceInFile(
    path.resolve(__dirname, '../README.md'),
    /<!-- getMediaInfo table start -->.*<!-- getMediaInfo table end -->/s,
    `<!-- getMediaInfo table start -->\n${getMediaInfoMarkdownTable}\n<!-- getMediaInfo table end -->`,
  );

  const extractAudioSummary = summariseExtractAudio(reportData.extractAudio);
  const extractAudioMarkdownTable = generateExtractAudioMarkdownTable(extractAudioSummary);
  await replaceInFile(
    path.resolve(__dirname, '../README.md'),
    /<!-- extractAudio table start -->.*<!-- extractAudio table end -->/s,
    `<!-- extractAudio table start -->\n${extractAudioMarkdownTable}\n<!-- extractAudio table end -->`,
  );
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main();
