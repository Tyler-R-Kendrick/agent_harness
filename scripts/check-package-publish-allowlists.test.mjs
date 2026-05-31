import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  findPackagePublishAllowlistIssues,
  findPublishablePackagesWithoutFiles,
  formatMissingAllowlists,
  formatPublishAllowlistIssues,
  readWorkspacePackages,
  runPackagePublishAllowlistCli,
} from './check-package-publish-allowlists.mjs';

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

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
  {
    path: 'lib/unnamed-missing-allowlist/package.json',
    manifest: {},
  },
];

assert.deepEqual(findPublishablePackagesWithoutFiles(packages), [
  {
    name: '@agent-harness/missing-allowlist',
    path: 'lib/missing-allowlist/package.json',
  },
  {
    name: '(unnamed package)',
    path: 'lib/unnamed-missing-allowlist/package.json',
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
  {
    path: 'ext/provider/dist-package/package.json',
    manifest: {
      name: '@agent-harness/dist-package',
      files: [
        'README.md',
        'dist/**',
      ],
    },
  },
  {
    path: 'ext/provider/hardened-dist-package/package.json',
    manifest: {
      name: '@agent-harness/hardened-dist-package',
      files: [
        'README.md',
        'dist/**',
        '!dist/**/*.map',
      ],
    },
  },
  {
    path: 'lib/missing-source-directory-denylist/package.json',
    manifest: {
      name: '@agent-harness/missing-source-directory-denylist',
      files: [
        'README.md',
        'src/**/*.ts',
        '!src/**/*.test.ts',
      ],
    },
  },
  {
    path: 'lib/no-files/package.json',
    manifest: {
      name: '@agent-harness/no-files',
    },
  },
  {
    path: 'lib/unnamed-no-files/package.json',
    manifest: {},
  },
  {
    path: 'lib/non-runtime-src-glob/package.json',
    manifest: {
      name: '@agent-harness/non-runtime-src-glob',
      files: [
        'README.md',
        'src/**/README.md',
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
  {
    name: '@agent-harness/dist-package',
    path: 'ext/provider/dist-package/package.json',
    issues: ['missing !dist/**/*.map for recursive dist publish pattern'],
  },
  {
    name: '@agent-harness/missing-source-directory-denylist',
    path: 'lib/missing-source-directory-denylist/package.json',
    issues: ['missing !src/__tests__/** for recursive src publish pattern'],
  },
  {
    name: '@agent-harness/no-files',
    path: 'lib/no-files/package.json',
    issues: ['missing package.json files allowlist'],
  },
  {
    name: '(unnamed package)',
    path: 'lib/unnamed-no-files/package.json',
    issues: ['missing package.json files allowlist'],
  },
]);

assert.equal(
  formatPublishAllowlistIssues(findPackagePublishAllowlistIssues(allowlistPolicyPackages)),
  [
    'Publishable workspace packages must keep package.json files allowlists explicit and test-free:',
    '- lib/tsx-source/package.json (@agent-harness/tsx-source)',
    '  - missing !src/**/*.test.tsx for recursive src tsx publish pattern',
    '- ext/provider/dist-package/package.json (@agent-harness/dist-package)',
    '  - missing !dist/**/*.map for recursive dist publish pattern',
    '- lib/missing-source-directory-denylist/package.json (@agent-harness/missing-source-directory-denylist)',
    '  - missing !src/__tests__/** for recursive src publish pattern',
    '- lib/no-files/package.json (@agent-harness/no-files)',
    '  - missing package.json files allowlist',
    '- lib/unnamed-no-files/package.json ((unnamed package))',
    '  - missing package.json files allowlist',
  ].join('\n'),
);

assert.equal(
  formatMissingAllowlists(findPublishablePackagesWithoutFiles(packages)),
  [
    'Publishable workspace packages must declare an explicit package.json files allowlist:',
    '- lib/missing-allowlist/package.json (@agent-harness/missing-allowlist)',
    '- lib/unnamed-missing-allowlist/package.json ((unnamed package))',
  ].join('\n'),
);

const workspaceFixture = await mkdtemp(path.join(tmpdir(), 'publish-allowlists-'));
await writeJson(path.join(workspaceFixture, 'package.json'), {
  private: true,
  workspaces: [
    'lib/*',
    'ext/*/*',
    'missing/*',
    'single-package',
  ],
});
await writeJson(path.join(workspaceFixture, 'lib', 'alpha', 'package.json'), {
  name: '@agent-harness/alpha',
  files: ['src/index.ts'],
});
await mkdir(path.join(workspaceFixture, 'lib', 'not-a-package'), { recursive: true });
await writeJson(path.join(workspaceFixture, 'lib', 'node_modules', 'generated', 'package.json'), {
  name: '@agent-harness/generated',
});
await writeJson(path.join(workspaceFixture, 'ext', 'ide', 'beta', 'package.json'), {
  name: '@agent-harness/beta',
  files: ['src/index.ts'],
});
await writeJson(path.join(workspaceFixture, 'single-package', 'package.json'), {
  name: '@agent-harness/single',
  files: ['src/index.ts'],
});

assert.deepEqual(readWorkspacePackages(workspaceFixture), [
  {
    path: 'ext/ide/beta/package.json',
    manifest: {
      name: '@agent-harness/beta',
      files: ['src/index.ts'],
    },
  },
  {
    path: 'lib/alpha/package.json',
    manifest: {
      name: '@agent-harness/alpha',
      files: ['src/index.ts'],
    },
  },
  {
    path: 'single-package/package.json',
    manifest: {
      name: '@agent-harness/single',
      files: ['src/index.ts'],
    },
  },
]);

const noWorkspacesFixture = await mkdtemp(path.join(tmpdir(), 'publish-allowlists-no-workspaces-'));
await writeJson(path.join(noWorkspacesFixture, 'package.json'), {
  private: true,
});
assert.deepEqual(readWorkspacePackages(noWorkspacesFixture), []);

const stdoutWrites = [];
const stderrWrites = [];
assert.equal(runPackagePublishAllowlistCli({
  packages: [
    {
      path: 'lib/hardened/package.json',
      manifest: {
        name: '@agent-harness/hardened',
        files: ['README.md', 'src/**/*.ts', '!src/**/*.test.ts', '!src/__tests__/**'],
      },
    },
  ],
  stdout: { write: (value) => stdoutWrites.push(value) },
  stderr: { write: (value) => stderrWrites.push(value) },
}), 0);
assert.deepEqual(stdoutWrites, ['All publishable workspace packages declare explicit, test-free files allowlists.\n']);
assert.deepEqual(stderrWrites, []);

assert.equal(runPackagePublishAllowlistCli({
  packages: [{
    path: 'lib/unsafe/package.json',
    manifest: {
      name: '@agent-harness/unsafe',
      files: ['dist/**'],
    },
  }],
  stdout: { write: (value) => stdoutWrites.push(value) },
  stderr: { write: (value) => stderrWrites.push(value) },
}), 1);
assert.equal(stdoutWrites.length, 1);
assert.deepEqual(stderrWrites, [
  [
    'Publishable workspace packages must keep package.json files allowlists explicit and test-free:',
    '- lib/unsafe/package.json (@agent-harness/unsafe)',
    '  - missing !dist/**/*.map for recursive dist publish pattern',
    '',
  ].join('\n'),
]);

const liveStdoutWrites = [];
assert.equal(runPackagePublishAllowlistCli({
  stdout: { write: (value) => liveStdoutWrites.push(value) },
  stderr: { write: (value) => stderrWrites.push(value) },
}), 0);
assert.deepEqual(liveStdoutWrites, ['All publishable workspace packages declare explicit, test-free files allowlists.\n']);

console.log('package publish allowlist checks passed');
