import assert from 'node:assert/strict';

import { findPublishablePackagesWithoutFiles } from './check-package-publish-allowlists.mjs';

const packages = [
  {
    path: 'package.json',
    manifest: {
      name: 'private-root',
      private: true,
    },
  },
  {
    path: 'lib/with-allowlist/package.json',
    manifest: {
      name: '@agent-harness/with-allowlist',
      files: ['src/**/*.ts'],
    },
  },
  {
    path: 'lib/missing-allowlist/package.json',
    manifest: {
      name: '@agent-harness/missing-allowlist',
    },
  },
];

assert.deepEqual(findPublishablePackagesWithoutFiles(packages), [
  {
    name: '@agent-harness/missing-allowlist',
    path: 'lib/missing-allowlist/package.json',
  },
]);

console.log('package publish allowlist checks passed');
