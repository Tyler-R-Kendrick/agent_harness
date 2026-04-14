export default {
  paths: ['tests/features/**/*.feature'],
  import: ['tests/cucumber/support/*.mjs', 'tests/cucumber/step-definitions/*.mjs'],
  format: ['progress-bar'],
  parallel: 1,
  publishQuiet: true,
  tags: 'not @product-contract',
};