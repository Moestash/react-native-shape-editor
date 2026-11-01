const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['dist/**', 'node_modules/**', 'website/**', 'stories/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'example/**/*.js', 'phone-demo/App.js'],
    languageOptions: {
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.jest, requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' },
    },
    rules: { 'no-unused-vars': 'off' },
  },
];
