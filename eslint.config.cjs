const { buildESLintConfig } = require('@handy-common-utils/dev-dependencies-jest');
const { defineConfig } = require('eslint/config');

const config = buildESLintConfig({ defaultSourceType: 'commonjs' });

module.exports = defineConfig([
  {
    ignores: ['dist', 'coverage', 'report', 'node_modules'],
  },
  ...config,
  {
    rules: {
      'unicorn/number-literal-case': 'off',
    },
  },
]);
