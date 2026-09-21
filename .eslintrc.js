module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // @react-native/eslint-config only turns on the jest global for
      // *.test.* files and __tests__/__mocks__ folders — this repo's Jest
      // setup script (referenced by jest.config.js's setupFiles) lives
      // outside both.
      files: ['jest/**/*.js'],
      env: { jest: true },
    },
  ],
};
