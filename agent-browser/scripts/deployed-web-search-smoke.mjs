import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const DEFAULT_BASE_URL = 'https://agent-harness-eight.vercel.app';
const DEFAULT_QUERY = 'nearby movie theaters google.com';
const DEFAULT_PAGE_URL = 'https://example.com/';
const VERCEL_CURL_LABEL = 'vercel curl';

const baseUrl = normalizeBaseUrl(process.env.AGENT_BROWSER_BASE_URL || DEFAULT_BASE_URL);
const query = process.argv.slice(2).join(' ').trim() || DEFAULT_QUERY;
const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

function normalizeBaseUrl(value) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('AGENT_BROWSER_BASE_URL is empty.');
  }
  return new URL(trimmed);
}

function summarizePayload(payload) {
  return JSON.stringify(payload).slice(0, 500);
}

function buildDeploymentUrl(path) {
  return new URL(path, baseUrl.origin).toString();
}

async function readVercelShareCookie() {
  if (!baseUrl.searchParams.has('_vercel_share')) return '';
  const response = await fetch(baseUrl.toString(), { redirect: 'manual' });
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return cookies
    .map((cookie) => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

const vercelShareCookie = await readVercelShareCookie();

async function postJson(path, body) {
  const url = buildDeploymentUrl(path);
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    ...(vercelShareCookie ? { cookie: vercelShareCookie } : {}),
  };
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';

  if (response.status === 404 || response.status >= 500) {
    throw new Error(`${path} returned ${response.status}: ${text.slice(0, 500)}`);
  }
  if (!contentType.toLowerCase().includes('application/json')) {
    if (isVercelAuthenticationPage(contentType, text)) {
      return postJsonWithVercelCurl(path, body);
    }
    throw new Error(`${path} returned non-JSON content-type "${contentType}": ${text.slice(0, 200)}`);
  }

  const payload = parseJsonPayload(path, text);

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${summarizePayload(payload)}`);
  }
  assertNoApiError(path, payload);
  return payload;
}

function isVercelAuthenticationPage(contentType, text) {
  return baseUrl.hostname.endsWith('.vercel.app')
    && contentType.toLowerCase().includes('text/html')
    && /Authentication Required/i.test(text);
}

async function postJsonWithVercelCurl(path, body) {
  const bodyPath = `.vercel-curl-body-${process.pid}-${randomUUID()}.json`;
  const bodyUrl = new URL(`../../${bodyPath}`, import.meta.url);
  await writeFile(bodyUrl, JSON.stringify(body), 'utf8');
  try {
    const deployment = process.env.AGENT_BROWSER_VERCEL_DEPLOYMENT || baseUrl.origin;
    const args = [
      'vercel',
      'curl',
      path,
      '--deployment',
      deployment,
      ...readVercelScopeArgs(),
      '--',
      '--request',
      'POST',
      '--header',
      'content-type:application/json',
      '--header',
      'accept:application/json',
      '--data-binary',
      `@${bodyPath}`,
    ];
    const { stdout } = process.platform === 'win32'
      ? await execFileAsync('cmd.exe', ['/d', '/c', ['npx.cmd', ...args].join(' ')], {
        cwd: repoRoot,
        maxBuffer: 1024 * 1024,
      })
      : await execFileAsync('npx', args, {
        cwd: repoRoot,
        maxBuffer: 1024 * 1024,
      });
    const payload = parseJsonPayload(path, stdout);
    assertNoApiError(path, payload);
    return payload;
  } catch (error) {
    throw new Error(`${path} ${VERCEL_CURL_LABEL} failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await rm(bodyUrl, { force: true });
  }
}

function readVercelScopeArgs() {
  return process.env.AGENT_BROWSER_VERCEL_SCOPE
    ? ['--scope', process.env.AGENT_BROWSER_VERCEL_SCOPE]
    : [];
}

function parseJsonPayload(path, text) {
  try {
    return JSON.parse(text.trim());
  } catch (error) {
    throw new Error(`${path} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertNoApiError(path, payload) {
  const code = typeof payload?.error?.code === 'string' ? payload.error.code : undefined;
  if (code === '404' || code === '500') {
    throw new Error(`${path} returned ${code}: ${summarizePayload(payload)}`);
  }
}

function assertSearchPayload(payload) {
  if (payload.status !== 'found') {
    throw new Error(`/api/web-search did not find results: ${summarizePayload(payload)}`);
  }
  if (!Array.isArray(payload.results) || payload.results.length === 0) {
    throw new Error(`/api/web-search returned no results: ${summarizePayload(payload)}`);
  }
  const [top] = payload.results;
  if (!top || typeof top.title !== 'string' || typeof top.url !== 'string') {
    throw new Error(`/api/web-search returned malformed results: ${summarizePayload(payload)}`);
  }
  return top;
}

function assertPagePayload(payload) {
  if (payload.status !== 'read') {
    throw new Error(`/api/web-page did not read the page: ${summarizePayload(payload)}`);
  }
  if (typeof payload.url !== 'string' || !payload.url.startsWith('https://example.com')) {
    throw new Error(`/api/web-page returned an unexpected URL: ${summarizePayload(payload)}`);
  }
  if (typeof payload.text !== 'string' || !payload.text.includes('Example Domain')) {
    throw new Error(`/api/web-page returned unexpected page text: ${summarizePayload(payload)}`);
  }
}

const searchPayload = await postJson('/api/web-search', { query, limit: 3 });
const topResult = assertSearchPayload(searchPayload);
const pagePayload = await postJson('/api/web-page', { url: DEFAULT_PAGE_URL });
assertPagePayload(pagePayload);

console.log(`web-search ok: ${topResult.title} <${topResult.url}>`);
console.log(`web-page ok: ${pagePayload.title ?? pagePayload.url}`);
