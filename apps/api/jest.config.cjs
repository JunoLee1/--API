const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  testPathIgnorePatterns: ['/node_modules/', '/.claude/'],
  ...(compilerOptions.paths
    ? { moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/src' }) }
    : {}),
};