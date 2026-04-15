const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const http = require('node:http');
const path = require('node:path');

const execFileAsync = promisify(execFile);
const DEFAULT_PORT = 5173;
const DEFAULT_LOCALHOST_URL = `http://localhost:${DEFAULT_PORT}`;

function getCodespacesUriScriptPath(workspaceRoot) {
  return path.join(workspaceRoot, 'skills', 'agent-harness-context', 'scripts', 'codespaces-uri.sh');
}

function inCodespaces(environment = process.env) {
  return Boolean(environment.CODESPACE_NAME && environment.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN);
}

async function resolveTargetUrl({
  workspaceRoot,
  environment = process.env,
  execFileImpl = execFileAsync,
  port = DEFAULT_PORT,
} = {}) {
  if (!workspaceRoot) {
    throw new Error('A workspace root is required to resolve the agent-browser preview URL.');
  }

  if (!inCodespaces(environment)) {
    return `http://localhost:${port}`;
  }

  const scriptPath = getCodespacesUriScriptPath(workspaceRoot);

  try {
    const { stdout } = await execFileImpl(scriptPath, ['--check', String(port)], {
      env: environment,
    });

    return stdout.trim();
  } catch (_error) {
    const { stdout } = await execFileImpl(scriptPath, ['--public', '--check', String(port)], {
      env: environment,
    });

    return stdout.trim();
  }
}

function probeHttp(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForServer({
  url = DEFAULT_LOCALHOST_URL,
  attempts = 90,
  intervalMs = 1000,
  probe = probeHttp,
  delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await probe(url)) {
      return true;
    }

    if (attempt < attempts - 1) {
      await delay(intervalMs);
    }
  }

  return false;
}

async function openInSimpleBrowser(url, executeCommand) {
  try {
    await executeCommand('simpleBrowser.show', url);
    return 'simpleBrowser.show';
  } catch (_error) {
    await executeCommand('simpleBrowser.api.open', url);
    return 'simpleBrowser.api.open';
  }
}

module.exports = {
  DEFAULT_LOCALHOST_URL,
  DEFAULT_PORT,
  getCodespacesUriScriptPath,
  inCodespaces,
  openInSimpleBrowser,
  resolveTargetUrl,
  waitForServer,
};