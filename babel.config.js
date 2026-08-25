module.exports = function (api) {
  // react-native-dotenv's own docs call this out explicitly: without
  // resetting Babel's cache, files that import '@env' can keep the
  // untransformed import around from before the plugin was wired in,
  // which is exactly the "Unable to resolve module @env" error this fixes.
  api.cache(false);

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: ['module:react-native-dotenv'],
  };
};
