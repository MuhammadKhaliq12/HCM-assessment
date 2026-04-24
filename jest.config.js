/**
 * Root Jest configuration for NestJS unit tests (specs live under `src/`).
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.service.ts',
    'modules/hcm/hcm-api.service.ts',
    '!**/*.spec.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/../test/setup.ts'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
    '^test/(.*)$': '<rootDir>/../test/$1',
  },
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageThreshold: {
    global: {
      // Branch-heavy defensive code (HTTP mapping, webhook routing) is difficult to saturate to 80%
      // without enormous boilerplate; keep other dimensions strict.
      branches: 55,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
