/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  transform: {},
  moduleFileExtensions: ['js', 'json'],
  verbose: true,
  testTimeout: 60000,
  forceExit: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/logs/**',
    '!src/database/seeders/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  // Floor for CI — raise as more modules get covered. Fail the build under this.
  coverageThreshold: {
    global: {
      branches: 35,
      functions: 50,
      lines: 55,
      statements: 55,
    },
  },
};
