const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getCodespacesUriScriptPath,
  inCodespaces,
  openInSimpleBrowser,
  resolveTargetUrl,
  waitForServer,
} = require('../logic');

test('getCodespacesUriScriptPath points at the bundled script', () => {
  assert.equal(
    getCodespacesUriScriptPath('/workspaces/agent_harness'),
    '/workspaces/agent_harness/skills/agent-harness-context/scripts/codespaces-uri.sh',
  );
});

test('inCodespaces returns true only when both environment variables are present', () => {
  assert.equal(inCodespaces({}), false);
  assert.equal(inCodespaces({ CODESPACE_NAME: 'space' }), false);
  assert.equal(inCodespaces({ GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'github.dev' }), false);
  assert.equal(
    inCodespaces({
      CODESPACE_NAME: 'space',
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'github.dev',
    }),
    true,
  );
});

test('resolveTargetUrl falls back to localhost outside Codespaces', async () => {
  const url = await resolveTargetUrl({
    workspaceRoot: '/workspaces/agent_harness',
    environment: {},
  });

  assert.equal(url, 'http://localhost:5174');
});

test('resolveTargetUrl shells out to the helper script inside Codespaces', async () => {
  const calls = [];

  const url = await resolveTargetUrl({
    workspaceRoot: '/workspaces/agent_harness',
    environment: {
      CODESPACE_NAME: 'example',
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev',
    },
    execFileImpl: async (filePath, args) => {
      calls.push({ filePath, args });
      return { stdout: 'https://example-5174.app.github.dev\n' };
    },
  });

  assert.deepEqual(calls, [{
    filePath: '/workspaces/agent_harness/skills/agent-harness-context/scripts/codespaces-uri.sh',
    args: ['--check', '5174'],
  }]);
  assert.equal(url, 'https://example-5174.app.github.dev');
});

test('resolveTargetUrl promotes the port when the checked URL is not yet browser-accessible', async () => {
  const calls = [];

  const url = await resolveTargetUrl({
    workspaceRoot: '/workspaces/agent_harness',
    environment: {
      CODESPACE_NAME: 'example',
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev',
    },
    execFileImpl: async (filePath, args) => {
      calls.push({ filePath, args });

      if (args[0] === '--check') {
        throw new Error('Forwarded URL check failed');
      }

      return { stdout: 'https://example-5174.app.github.dev\n' };
    },
  });

  assert.deepEqual(calls, [
    {
      filePath: '/workspaces/agent_harness/skills/agent-harness-context/scripts/codespaces-uri.sh',
      args: ['--check', '5174'],
    },
    {
      filePath: '/workspaces/agent_harness/skills/agent-harness-context/scripts/codespaces-uri.sh',
      args: ['--public', '--check', '5174'],
    },
  ]);
  assert.equal(url, 'https://example-5174.app.github.dev');
});

test('resolveTargetUrl requires a workspace root', async () => {
  await assert.rejects(() => resolveTargetUrl({ workspaceRoot: '' }), /workspace root/i);
});

test('waitForServer returns true when the probe eventually succeeds', async () => {
  let attempts = 0;

  const ready = await waitForServer({
    attempts: 3,
    intervalMs: 0,
    probe: async () => {
      attempts += 1;
      return attempts === 2;
    },
    delay: async () => {},
  });

  assert.equal(ready, true);
  assert.equal(attempts, 2);
});

test('waitForServer returns false when the probe never succeeds', async () => {
  let attempts = 0;

  const ready = await waitForServer({
    attempts: 3,
    intervalMs: 0,
    probe: async () => {
      attempts += 1;
      return false;
    },
    delay: async () => {},
  });

  assert.equal(ready, false);
  assert.equal(attempts, 3);
});

test('openInSimpleBrowser uses simpleBrowser.show when available', async () => {
  const calls = [];

  const command = await openInSimpleBrowser('https://example.com', async (id, url) => {
    calls.push({ id, url });
  });

  assert.equal(command, 'simpleBrowser.show');
  assert.deepEqual(calls, [{ id: 'simpleBrowser.show', url: 'https://example.com' }]);
});

test('openInSimpleBrowser falls back to simpleBrowser.api.open', async () => {
  const calls = [];

  const command = await openInSimpleBrowser('https://example.com', async (id, url) => {
    calls.push({ id, url });

    if (id === 'simpleBrowser.show') {
      throw new Error('primary command failed');
    }
  });

  assert.equal(command, 'simpleBrowser.api.open');
  assert.deepEqual(calls, [
    { id: 'simpleBrowser.show', url: 'https://example.com' },
    { id: 'simpleBrowser.api.open', url: 'https://example.com' },
  ]);
});
