import assert from 'node:assert/strict';

import {
  findPackagePublishAllowlistIssues,
  findPublishablePackagesWithoutFiles,
  formatPublishAllowlistIssues,
} from './check-package-publish-allowlists.mjs';

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

const allowlistPolicyPackages = [
  {
    path: 'lib/runtime-only/package.json',
    manifest: {
      name: '@agent-harness/runtime-only',
      files: ['README.md', 'src/index.ts'],
    },
  },
  {
    path: 'lib/tsx-source/package.json',
    manifest: {
      name: '@agent-harness/tsx-source',
      files: [
        'README.md',
        'src/**/*.{ts,tsx}',
        '!src/**/*.test.ts',
        '!src/__tests__/**',
      ],
    },
  },
  {
    path: 'lib/hardened-source/package.json',
    manifest: {
      name: '@agent-harness/hardened-source',
      files: [
        'README.md',
        'src/**/*.ts',
        'src/**/*.tsx',
        '!src/**/*.test.ts',
        '!src/**/*.test.tsx',
        '!src/__tests__/**',
      ],
    },
  },
];

assert.deepEqual(findPackagePublishAllowlistIssues(allowlistPolicyPackages), [
  {
    name: '@agent-harness/tsx-source',
    path: 'lib/tsx-source/package.json',
    issues: ['missing !src/**/*.test.tsx for recursive src tsx publish pattern'],
  },
]);

assert.equal(
  formatPublishAllowlistIssues(findPackagePublishAllowlistIssues(allowlistPolicyPackages)),
  [
    'Publishable workspace packages must keep package.json files allowlists explicit and test-free:',
    '- lib/tsx-source/package.json (@agent-harness/tsx-source)',
    '  - missing !src/**/*.test.tsx for recursive src tsx publish pattern',
  ].join('\n'),
);

console.log('package publish allowlist checks passed');
