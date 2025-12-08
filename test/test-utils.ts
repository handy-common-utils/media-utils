import { afterAll, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

import { extractAudioFromFileToFile, ExtractAudioOptions } from '../src/extract-audio';
import { getMediaInfoFromFile, GetMediaInfoOptions, GetMediaInfoResult } from '../src/get-media-info';
import { MediaInfo, toContainer } from '../src/media-info';

// eslint-disable-next-line unicorn/prefer-module
const SAMPLE_DIR = path.join(__dirname, 'sample-media-files');
// eslint-disable-next-line unicorn/prefer-module
const OUTPUT_DIR = path.join(__dirname, 'output');

/**
 * Get the full path to a sample media file
 * @param filename - The name of the sample file
 * @returns The full path to the sample file
 */
export function sampleFile(filename: string): string {
  return path.join(SAMPLE_DIR, filename);
}

/**
 * Get the full path to an output file
 * @param filename - The name of the output file
 * @returns The full path to the output file
 */
export function outputFile(filename: string): string {
  return path.join(OUTPUT_DIR, filename);
}

/**
 * Assert that the file size is within reasonable range
 * @param filePath - The path to the file to check
 * @param greaterThanKB - Optional minimum size in KB (default 0)
 * @param lessThanKB - Optional maximum size in KB
 */
export function assertFileSize(filePath: string, greaterThanKB = 0, lessThanKB?: number): void {
  const fileSizeInKB = fs.statSync(filePath).size / 1024;
  expect(fileSizeInKB).toBeGreaterThan(greaterThanKB);
  if (lessThanKB !== undefined) {
    expect(fileSizeInKB).toBeLessThan(lessThanKB);
  }
}

// Track files to clean up after tests
const filesToCleanup: string[] = [];

/**
 * Track a file for cleanup after tests complete
 * @param filePath - The path to the file to clean up
 */
export function trackFileForCleanup(filePath: string): void {
  filesToCleanup.push(filePath);
}

/**
 * Setup cleanup of tracked files after all tests complete
 */
export function setupCleanup(): void {
  afterAll(() => {
    // Clean up generated test files
    for (const file of filesToCleanup) {
      if (fs.existsSync(file)) {
        // fs.unlinkSync(file);
      }
    }
  });
}

export interface GetMediaInfoTestReportItem {
  filename: string;
  container: string;
  videoCodec?: string;
  audioCodec?: string;
  succeeded: boolean;
  fileRemark?: string;
  testRemark?: string;
}

export interface ExtractAudioTestReportItem extends GetMediaInfoTestReportItem {
  extractedAudioCodec?: string;
  extractedAudioContainer?: string;
}

export interface TestReportData {
  getMediaInfo: GetMediaInfoTestReportItem[];
  extractAudio: ExtractAudioTestReportItem[];
}

/**
 * Cleanup the test report data file
 */
export function cleanupTestReportData() {
  const reportFile = outputFile('test-report.json');
  fs.writeFileSync(reportFile, JSON.stringify({ getMediaInfo: [], extractAudio: [] }, null, 2), 'utf8');
}

/**
 * Add an item to the test report data for getMediaInfo
 * @param item The test report item to add
 * @param mediaInfo The media information about the file
 */
export function addGetMediaInfoTestReportItem(
  item: Pick<GetMediaInfoTestReportItem, 'filename' | 'succeeded' | 'fileRemark' | 'testRemark'>,
  mediaInfo: MediaInfo,
) {
  const reportFile = outputFile('test-report.json');
  if (!fs.existsSync(reportFile)) {
    cleanupTestReportData();
  }

  const content = fs.readFileSync(reportFile, 'utf8');
  const reportData = JSON.parse(content) as TestReportData;
  reportData.getMediaInfo.push({
    container: mediaInfo.container,
    videoCodec: mediaInfo.videoStreams?.map((vs) => vs.codec).join(', ') || undefined,
    audioCodec: mediaInfo.audioStreams?.map((as) => as.codec).join(', ') || undefined,
    ...item,
  });
  fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2), 'utf8');
}

/**
 * Add an item to the test report data for extractAudio
 * @param item The test report item to add
 * @param sourceMediaInfo The media information about the input file
 * @param audioMediaInfo The media information about the extracted audio
 */
export function addExtractAudioTestReportItem(
  item: Pick<ExtractAudioTestReportItem, 'filename' | 'succeeded' | 'fileRemark' | 'testRemark'>,
  sourceMediaInfo: MediaInfo,
  audioMediaInfo?: MediaInfo,
) {
  const reportFile = outputFile('test-report.json');
  if (!fs.existsSync(reportFile)) {
    cleanupTestReportData();
  }

  const content = fs.readFileSync(reportFile, 'utf8');
  const reportData = JSON.parse(content) as TestReportData;
  reportData.extractAudio.push({
    container: sourceMediaInfo.container,
    videoCodec: sourceMediaInfo.videoStreams?.map((vs) => vs.codec).join(', ') || undefined,
    audioCodec: sourceMediaInfo.audioStreams?.map((as) => as.codec).join(', ') || undefined,
    extractedAudioContainer: audioMediaInfo?.container || undefined,
    extractedAudioCodec: audioMediaInfo?.audioStreams?.map((as) => as.codec).join(', ') || undefined,
    ...item,
  });
  fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2), 'utf8');
}

export interface GetMediaInfoTestCase {
  /**
   * Name of the sample media file as input
   */
  filename: string;
  /**
   * Options for getMediaInfo function
   */
  options?: GetMediaInfoOptions;
  /**
   * Expected media information result
   */
  expectedMediaInfo: GetMediaInfoResult;
  shouldFail?: boolean;
  fileRemark?: string;
  testRemark?: string;
}

/**
 * Run multiple test cases for getMediaInfo function
 * @param testCases Array of test case configurations
 */
export function runGetMediaInfoTestCases(testCases: GetMediaInfoTestCase[]) {
  for (const { shouldFail, filename, options, expectedMediaInfo, fileRemark, testRemark } of testCases) {
    it(`should getMediaInfo ${shouldFail ? 'fail' : 'work'} with ${filename}${fileRemark ? ` (${fileRemark})` : ''}${testRemark ? ` - ${testRemark}` : ''}`, async () => {
      if (shouldFail) {
        try {
          await getMediaInfoFromFile(sampleFile(filename), options);
          expect('').toEqual('getMediaInfoFromFile is expected to fail');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty('isUnsupportedFormatError', true);
          addGetMediaInfoTestReportItem({ succeeded: false, filename, fileRemark, testRemark }, expectedMediaInfo);
        }
      } else {
        const info = await getMediaInfoFromFile(sampleFile(filename), options);
        expect(info).toEqual(expectedMediaInfo);
        addGetMediaInfoTestReportItem({ succeeded: true, filename, fileRemark, testRemark }, expectedMediaInfo);
      }
    });
  }
}

export interface ExtractAudioTestCase {
  /**
   * Name of the sample media file as input
   */
  filename: string;
  /**
   * Options for extractAudio function
   */
  options?: ExtractAudioOptions;
  /**
   * Expected media information of the extracted audio
   */
  expectedMediaInfo: GetMediaInfoResult;
  shouldFail?: boolean;
  fileRemark?: string;
  testRemark?: string;
  minSizeKB?: number;
  maxSizeKB?: number;
}

/**
 * Run multiple test cases for getMediaInfo function
 * @param testCases Array of test case configurations
 */
export function runExtractAudioTestCases(testCases: ExtractAudioTestCase[]) {
  for (const { shouldFail, filename, options, expectedMediaInfo, fileRemark, testRemark, minSizeKB, maxSizeKB } of testCases) {
    it(`should extractAudio ${shouldFail ? 'fail' : 'work'} with ${filename}${fileRemark ? ` (${fileRemark})` : ''}${testRemark ? ` - ${testRemark}` : ''}`, async () => {
      let sourceMediaInfo: MediaInfo;
      try {
        sourceMediaInfo = await getMediaInfoFromFile(sampleFile(filename));
      } catch (error) {
        console.error(`Failed to get media info for source file ${filename}: ${error}`);
        sourceMediaInfo = {
          parser: 'auto',
          container: 'unknown',
          audioStreams: [],
          videoStreams: [],
        };
      }
      const outputFilename = `extracted-from-${path.basename(filename, path.extname(filename))}.audio`;
      if (expectedMediaInfo === null) {
        try {
          await extractAudioFromFileToFile(sampleFile(filename), outputFile(outputFilename), options);
          expect('').toEqual('extractAudio is expected to fail');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty('isUnsupportedFormatError', true);
          addExtractAudioTestReportItem({ succeeded: false, filename, fileRemark, testRemark }, sourceMediaInfo);
        }
      } else {
        await extractAudioFromFileToFile(sampleFile(filename), outputFile(outputFilename), options);
        assertFileSize(outputFile(outputFilename), minSizeKB, maxSizeKB);
        const info = await getMediaInfoFromFile(outputFile(outputFilename));
        expect(info).toEqual(expectedMediaInfo);
        fs.renameSync(outputFile(outputFilename), outputFile(outputFilename.replace(/\.audio$/, `.${toContainer(info.container).fileExtension}`)));
        addExtractAudioTestReportItem({ succeeded: true, filename, fileRemark, testRemark }, sourceMediaInfo, expectedMediaInfo);
      }
    });
  }
}
