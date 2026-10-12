module.exports = {
  preset: '@react-native/jest-preset',
  // backend/ is a separate Node project with its own Vitest suite and database.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/backend/'],
  setupFiles: ['./jest/setup.js'],
  // Several RN libraries (react-navigation, linear-gradient, and whichever
  // is added next) ship ESM in node_modules that Jest's default
  // transformIgnorePatterns (which skips all of node_modules) doesn't
  // transpile. Rather than maintain a growing per-package include-list,
  // just transform everything.
  transformIgnorePatterns: [],
};
