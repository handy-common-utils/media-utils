import { afterAll, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

import { extractAudioFromFileToFile, ExtractAudioOptions } from '../src/extract-audio';
import { getMediaInfoFromFile, GetMediaInfoOptions, GetMediaInfoResult } from '../src/get-media-info';
import { MediaInfo, toAudioCodec, toContainer } from '../src/media-info';
import { AsfMediaInfo } from '../src/parsers/asf';
import { Mp4MediaInfo } from '../src/parsers/mp4';

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
  parser: GetMediaInfoResult['parser'];
  filename: string;
  container: string;
  videoCodec?: string;
  audioCodec?: string;
  succeeded: boolean;
  fileRemark?: string;
  testRemark?: string;
}

export type ExtractAudioTestReportItem = Omit<GetMediaInfoTestReportItem, 'parser'> & {
  extractedAudioCodec?: string;
  extractedAudioContainer?: string;
};

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
  item: Pick<GetMediaInfoTestReportItem, 'parser' | 'filename' | 'succeeded' | 'fileRemark' | 'testRemark'>,
  mediaInfo: MediaInfo | AsfMediaInfo | Mp4MediaInfo,
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
  audioMediaInfo?: MediaInfo | AsfMediaInfo | Mp4MediaInfo,
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
  expectedMediaInfo: GetMediaInfoResult | AsfMediaInfo | Mp4MediaInfo;
  shouldFail?: boolean;
  fileRemark?: string;
  testRemark?: string;
}

/**
 * Find and return a test case by filename
 * @param testCases Array of test cases to search
 * @param filename The filename to find in the test cases
 * @returns The test case matching the filename
 * @throws Error if no test case with the given filename is found
 */
export function getGetMediaInfoTestCase(testCases: GetMediaInfoTestCase[], filename: string): GetMediaInfoTestCase {
  const result = testCases.find((tc) => tc.filename === filename);
  if (!result) {
    throw new Error(`Test case with filename ${filename} not found`);
  }
  return result;
}

/**
 * Get all test cases matching the given filenames
 * @param testCases Array of test cases to search
 * @param filenames Array of filenames to find in the test cases
 * @returns Array of test cases matching the given filenames
 * @throws Error if any filename does not have a matching test case
 */
export function getGetMediaInfoTestCases(testCases: GetMediaInfoTestCase[], ...filenames: string[]): GetMediaInfoTestCase[] {
  const results: GetMediaInfoTestCase[] = [];
  for (const filename of filenames) {
    const result = testCases.find((tc) => tc.filename === filename);
    if (!result) {
      throw new Error(`Test case with filename ${filename} not found`);
    }
    results.push(result);
  }
  return results;
}

/**
 * Run multiple test cases for getMediaInfo function
 * @param testCases Array of test case configurations
 * @param useParser The useParser option that overrides test case configurations
 */
export function runGetMediaInfoTestCases(testCases: GetMediaInfoTestCase[], useParser?: GetMediaInfoOptions['useParser']) {
  for (const { shouldFail, filename, options, expectedMediaInfo, fileRemark, testRemark } of testCases) {
    const optionsWithUseParser = { ...options, useParser };
    it(`should getMediaInfo ${shouldFail ? 'fail' : 'work'} with ${filename}${fileRemark ? ` (${fileRemark})` : ''}${testRemark ? ` - ${testRemark}` : ''}`, async () => {
      if (shouldFail) {
        try {
          await getMediaInfoFromFile(sampleFile(filename), optionsWithUseParser);
          expect('').toEqual('getMediaInfoFromFile is expected to fail');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty('isUnsupportedFormatError', true);
          addGetMediaInfoTestReportItem(
            { succeeded: false, filename, fileRemark, testRemark, parser: optionsWithUseParser.useParser ?? 'auto' },
            expectedMediaInfo,
          );
        }
      } else {
        const info = await getMediaInfoFromFile(sampleFile(filename), optionsWithUseParser);
        expect(info).toEqual(expectedMediaInfo);
        addGetMediaInfoTestReportItem(
          { succeeded: true, filename, fileRemark, testRemark, parser: optionsWithUseParser.useParser ?? 'auto' },
          expectedMediaInfo,
        );
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
  expectedMediaInfo: GetMediaInfoResult | AsfMediaInfo | Mp4MediaInfo;
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
      const outputFilename = `extracted-from-${filename}.audio`;
      if (shouldFail) {
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
        fs.renameSync(
          outputFile(outputFilename),
          outputFile(outputFilename.replace(/\.audio$/, `.${toContainer(toAudioCodec(info.audioStreams[0].codec).defaultContainer).fileExtension}`)),
        );
        addExtractAudioTestReportItem({ succeeded: true, filename, fileRemark, testRemark }, sourceMediaInfo, expectedMediaInfo);
      }
    });
  }
}
