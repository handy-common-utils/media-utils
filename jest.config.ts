import { createDefaultPreset, type JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  ...createDefaultPreset({
    tsconfig: 'tsconfig.test.json',
  }),
  testEnvironment: 'node',
  collectCoverage: true,
  collectCoverageFrom: ['./src/**/*.{js,jsx,ts,tsx}'],
};

export default config;
