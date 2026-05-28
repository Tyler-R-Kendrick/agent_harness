import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(appRoot, '..');
const requireFromApp = createRequire(path.join(appRoot, 'package.json'));
const AGENTV_CODI_STAGED_TIMEOUT_MS = 600_000;

function readText(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

function readJsonl<T>(relativePath: string): T[] {
  return readText(relativePath)
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function resolvePackageBin(packageName: string): string {
  const packageJsonPath = requireFromApp.resolve(`${packageName}/package.json`);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    bin?: string | Record<string, string>;
  };
  const defaultBinName = packageName.split('/').pop();
  const binRelativePath = typeof packageJson.bin === 'string'
    ? packageJson.bin
    : packageJson.bin?.[packageName] ?? packageJson.bin?.[defaultBinName ?? ''] ?? Object.values(packageJson.bin ?? {})[0];
  if (!binRelativePath) {
    throw new Error(`${packageName} does not declare a runnable bin entry.`);
  }
  return path.resolve(path.dirname(packageJsonPath), binRelativePath);
}

function subprocessEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.NODE_V8_COVERAGE;
  return env;
}

function runNode(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env: subprocessEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`node exited by signal ${signal}.\n${stdout}\n${stderr}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`node exited with code ${code ?? 'unknown'}.\n${stdout}\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

describe('Codi staged search AgentV SDK eval', () => {
  it('declares an AgentV SDK eval lane for Codi versus GHCP search chat', async () => {
    const packageJson = readJson<{
      scripts: Record<string, string>;
      devDependencies?: Record<string, string>;
    }>('agent-browser/package.json');
    const evalYaml = readText('agent-browser/evals/codi-staged-search-chat/EVAL.yaml');
    const targetsYaml = readText('.agentv/targets.yaml');
    const graderSource = readText('agent-browser/evals/codi-staged-search-chat/graders/codi-staged-search-quality.mjs');

    expect(packageJson.devDependencies).toHaveProperty('@agentv/eval');
    expect(packageJson.scripts['eval:codi-staged-search']).toBe('node scripts/run-agentv-codi-staged-search-eval.mjs');
    expect(evalYaml).toContain('agent-browser-codi-staged-search-chat');
    expect(evalYaml).toContain('type: code-grader');
    expect(evalYaml).toContain('type: tool-trajectory');
    expect(evalYaml).toContain('./graders/codi-staged-search-quality.mjs');
    expect(targetsYaml).toContain('name: agent-browser-codi-staged-search-chat');
    expect(targetsYaml).toContain('codi-staged-search-eval-target-runtime.ts');
    expect(graderSource).toContain("from '@agentv/eval'");
    expect(graderSource).toContain('defineCodeGrader');

    const { buildAgentvCodiStagedSearchEvalCommand } = await import(
      pathToFileURL(path.join(appRoot, 'scripts/run-agentv-codi-staged-search-eval.mjs')).href
    );
    const command = buildAgentvCodiStagedSearchEvalCommand();
    expect(command.packageName).toBe('agentv');
    expect(command.args).toEqual(expect.arrayContaining([
      'eval',
      'run',
      'agent-browser/evals/codi-staged-search-chat/EVAL.yaml',
      '--target',
      'agent-browser-codi-staged-search-chat',
      '--threshold',
      '1',
    ]));
  });

  it('models the exact movie-theater failure and comparable follow-up fixtures', () => {
    const cases = readJsonl<{
      id: string;
      input: string;
      expected_output: string;
    }>('agent-browser/evals/codi-staged-search-chat/cases.jsonl');

    expect(cases.map((testCase) => testCase.input)).toEqual(expect.arrayContaining([
      'show me movie theaters near me',
      'show me theaters near me',
      'what are the best movie theaters near me',
      'what about bars?',
    ]));

    const exact = cases.find((testCase) => testCase.id === 'show-me-movie-theaters-near-me');
    expect(exact).toBeDefined();
    const exactContract = JSON.parse(exact?.expected_output ?? '{}');
    expect(exactContract.fixtureId).toBe('negative-theaters-browser-coordinate-directory-labels');
    expect(exactContract.expectedEntities).toEqual(expect.arrayContaining([
      'AMC Randhurst 12',
      'CMX Arlington Heights',
      'Classic Cinemas Elk Grove Theatre',
    ]));
    expect(exactContract.requiredTools).toEqual(expect.arrayContaining([
      'webmcp:recall_user_context',
      'webmcp:read_browser_location',
      'webmcp:search_web',
      'webmcp:read_web_page',
    ]));

    const followUp = cases.find((testCase) => testCase.id === 'follow-up-bars-after-movie-theaters');
    expect(followUp).toBeDefined();
    const followUpContract = JSON.parse(followUp?.expected_output ?? '{}');
    expect(followUpContract.fixtureId).toBe('negative-follow-up-bars-article-page-chrome');
    expect(followUpContract.badLabels).toEqual(expect.arrayContaining([
      'Support Enable',
      'Join Now Enable',
      'Chicago Bound',
    ]));
  });

  it('scores a passing Codi-vs-GHCP payload through the AgentV TypeScript SDK grader', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/codi-staged-search-chat/graders/codi-staged-search-quality.mjs');
    const expected = {
      expectedEntities: ['AMC Randhurst 12', 'CMX Arlington Heights', 'Classic Cinemas Elk Grove Theatre'],
      expectedLocations: ['Arlington Heights, IL'],
      badLabels: ['Moviefone TV'],
      forbiddenLabels: ['Cities Movie Times'],
      requiredTools: ['webmcp:recall_user_context', 'webmcp:read_browser_location', 'webmcp:search_web', 'webmcp:read_web_page'],
    };
    const answer = [
      'Here are movie theaters near Arlington Heights, IL:',
      '',
      '1. [AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12) - Why: Source-backed theater near Arlington Heights, IL.',
      '2. [CMX Arlington Heights](https://www.cmxcinemas.com/location/cmx-arlington-heights) - Why: Source-backed theater in Arlington Heights, IL.',
      '3. [Classic Cinemas Elk Grove Theatre](https://www.classiccinemas.com/elk-grove) - Why: Source-backed theater near Arlington Heights, IL.',
    ].join('\n');
    const metadata = {
      codi: {
        text: answer,
        toolNames: expected.requiredTools,
        toolCallCount: 4,
        searchQueries: ['nearby theaters Arlington Heights IL'],
        reviewDecisions: [{ decision: 'allow', severity: 'low', rules: '(none)' }],
        maxAttemptFailure: false,
      },
      ghcp: {
        text: answer,
        toolNames: expected.requiredTools,
        toolCallCount: 5,
        searchQueries: ['nearby theaters Arlington Heights IL'],
        reviewDecisions: [{ decision: 'allow', severity: 'low', rules: '(none)' }],
        maxAttemptFailure: false,
      },
    };
    const payload = {
      criteria: 'Codi passes the staged search quality gate.',
      input: [{ role: 'user', content: 'show me movie theaters near me' }],
      expected_output: [{ role: 'assistant', content: JSON.stringify(expected) }],
      input_files: [],
      output: [{
        role: 'assistant',
        content: `${answer}\n\n<!-- codi-staged-search:${Buffer.from(JSON.stringify(metadata), 'utf8').toString('base64')} -->`,
        tool_calls: [
          ...expected.requiredTools.map((tool) => ({ tool, input: {} })),
          { tool: 'codi-staged-search', input: {}, output: metadata.codi },
          { tool: 'ghcp-tool-calling-baseline', input: {}, output: metadata.ghcp },
        ],
      }],
    };

    const result = spawnSync(process.execPath, [grader], {
      cwd: path.join(repoRoot, 'agent-browser/evals/codi-staged-search-chat'),
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: subprocessEnv(),
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as { score: number };
    expect(parsed.score).toBe(1);
  });

  it('executes real AgentV scoring for the exact movie-theater Codi staged flow', async () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), 'agentv-codi-staged-search-'));
    try {
      const agentvBin = resolvePackageBin('agentv');
      const { stdout } = await runNode([
        agentvBin,
        'eval',
        'run',
        'agent-browser/evals/codi-staged-search-chat/EVAL.yaml',
        '--target',
        'agent-browser-codi-staged-search-chat',
        '--test-id',
        'show-me-movie-theaters-near-me',
        '--output',
        outputDir,
        '--workers',
        '1',
        '--threshold',
        '1',
      ], repoRoot);

      expect(stdout).toContain('show-me-movie-theaters-near-me');
      expect(stdout).toContain('RESULT: PASS');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  }, AGENTV_CODI_STAGED_TIMEOUT_MS);
});
