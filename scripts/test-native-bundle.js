const path = require('node:path');
const fs = require('node:fs');
const Metro = require('metro');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build', 'native-smoke');
fs.mkdirSync(output, { recursive: true });
const config = mergeConfig(getDefaultConfig(root), {
  projectRoot: root,
  watchFolders: [root],
  maxWorkers: 2,
  reporter: { update: () => {} },
  resolver: { useWatchman: false, extraNodeModules: { 'react-native-shape-editor': root } },
  transformer: {
    enableBabelRCLookup: false,
  },
});
(async () => {
  for (const platform of ['ios', 'android']) {
    await Metro.runBuild(config, {
      entry: 'test-config/native-entry.js', platform, dev: false, minify: false,
      out: path.join(output, `${platform}.js`),
    });
    console.log(`Native example bundled successfully for ${platform}.`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
