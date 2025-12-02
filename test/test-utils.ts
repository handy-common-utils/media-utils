import { afterAll } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

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
