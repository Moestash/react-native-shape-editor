const { babel } = require('@rollup/plugin-babel');
const pkg = require('./package.json');

module.exports = {
  input: 'src/index.js',
  output: [
    { file: pkg.main, format: 'cjs', exports: 'named', sourcemap: true },
    { file: pkg.module, format: 'esm', sourcemap: true },
  ],
  external: id => /^(react|react-native|react-native-svg|prop-types)(\/|$)/.test(id),
  plugins: [babel({ babelHelpers: 'bundled', exclude: 'node_modules/**' })],
};
