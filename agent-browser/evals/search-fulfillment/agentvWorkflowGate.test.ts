import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(appRoot, '..');

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

function runNode(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
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

describe('real AgentEvals workflow gate', () => {
  it('uses the real agentv package and invokes agentv eval for search fulfillment', async () => {
    const packageJson = readJson<{
      scripts: Record<string, string>;
      devDependencies?: Record<string, string>;
    }>('agent-browser/package.json');

    expect(packageJson.devDependencies).toHaveProperty('agentv');
    expect(packageJson.scripts['eval:search']).toContain('run-agentv-search-eval.mjs');

    const { buildAgentvSearchEvalCommand } = await import(
      pathToFileURL(path.join(appRoot, 'scripts/run-agentv-search-eval.mjs')).href
    );
    const command = buildAgentvSearchEvalCommand({ live: false });
    const liveCommand = buildAgentvSearchEvalCommand({ live: true });
    const runnerSource = readText('agent-browser/scripts/run-agentv-search-eval.mjs');

    expect(command.packageName).toBe('agentv');
    expect(command.args).toEqual(expect.arrayContaining([
      'eval',
      'run',
      'agent-browser/evals/search-fulfillment/EVAL.yaml',
      '--target',
      'agent-browser-search-fulfillment',
      '--threshold',
      '0.8',
      '--workers',
      '1',
    ]));
    expect(liveCommand.args).toEqual(expect.arrayContaining([
      'eval',
      'run',
      'agent-browser/evals/search-fulfillment/EVAL.live.yaml',
      '--target',
      'agent-browser-search-fulfillment-live',
      '--workers',
      '1',
    ]));
    expect(runnerSource).toContain('agentv-listener-budget.mjs');
    expect(runnerSource).toContain('await rm(outputDir, { recursive: true, force: true })');
    expect(readText('agent-browser/scripts/agentv-listener-budget.mjs')).toContain('AGENTV_STDIO_LISTENER_BUDGET = 256');
  });

  it('declares a real app runtime proof for the port 5174 browser replay', () => {
    const packageJson = readJson<{
      scripts: Record<string, string>;
    }>('agent-browser/package.json');
    const proofSource = readText('agent-browser/scripts/runtime-search-proof.mjs');

    expect(packageJson.scripts['proof:runtime-search']).toBe('node scripts/runtime-search-proof.mjs');
    expect(proofSource).toContain('const port = Number(process.env.AGENT_BROWSER_RUNTIME_PROOF_PORT) || 5174');
    expect(proofSource).toContain("page.getByLabel('Chat input').fill(\"what're the best movie theaters near me?\")");
    expect(proofSource).toContain('AMC Randhurst 12');
    expect(proofSource).toContain('Moviefone TV');
    expect(proofSource).toContain('.stream-cursor');
  });

  it('declares executable AgentV assertions for trajectory, rubric, llm judge, composite, and metrics gates', () => {
    const evalYaml = readText('agent-browser/evals/search-fulfillment/EVAL.yaml');

    expect(evalYaml).toContain('assertions:');
    expect(evalYaml).toContain('type: tool-trajectory');
    expect(evalYaml).toContain('type: rubric');
    expect(evalYaml).toContain('type: llm-grader');
    expect(evalYaml).toContain('type: composite');
    expect(evalYaml).toContain('type: execution-metrics');
    expect(evalYaml).toContain('tests: ./cases.jsonl');
    expect(readText('agent-browser/evals/search-fulfillment/EVAL.live.yaml')).toContain('tests: ./cases.live.jsonl');
    expect(evalYaml).not.toContain('type: llm_as_judge');
    expect(evalYaml).not.toContain('type: llm_judge');
    expect(evalYaml).not.toContain('type: execution_metrics');
  });

  it('defines AgentV cli targets for the workflow and internal LLM judge', () => {
    const targetsYaml = readText('.agentv/targets.yaml');

    expect(targetsYaml).toContain('name: agent-browser-search-fulfillment');
    expect(targetsYaml).toContain('provider: cli');
    expect(targetsYaml).toContain('search-eval-target.mjs');
    expect(targetsYaml).toContain('search-eval-target-runtime.ts');
    expect(targetsYaml).toContain('name: agent-browser-llm-judge');
    expect(targetsYaml).toContain('search-eval-llm-judge.mjs');
    expect(targetsYaml).toContain('judge_target: agent-browser-llm-judge');
  });

  it('routes AgentV target execution through the production search runtime instead of expected fixture answers', () => {
    const wrapperSource = readText('agent-browser/scripts/search-eval-target.mjs');
    const runtimeSource = readText('agent-browser/scripts/search-eval-target-runtime.ts');

    expect(wrapperSource).toContain('search-eval-target-runtime.ts');
    expect(runtimeSource).toContain('runLogActActorWorkflow');
    expect(runtimeSource).toContain('runConfiguredExecutorAgent');
    expect(runtimeSource).not.toContain('expected.expectedEntities');
    expect(runtimeSource).not.toContain('positiveAnswer');
    expect(runtimeSource).not.toContain('acceptedCandidates = negative');
  });

  it('contains at least 120 deterministic workflow cases with the latest bad runtime response as a negative case', () => {
    const cases = readJsonl<{
      id: string;
      input: string;
      metadata?: {
        domain?: string;
        rankingGoal?: string;
        negative?: boolean;
        badLabels?: string[];
        expectedEntities?: string[];
      };
    }>('agent-browser/evals/search-fulfillment/cases.jsonl');

    expect(cases).toHaveLength(120);
    expect(new Set(cases.map((testCase) => testCase.metadata?.domain)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(cases.map((testCase) => testCase.metadata?.rankingGoal)).size).toBeGreaterThanOrEqual(8);

    const badOnlyNegative = cases.find((testCase) => testCase.id === 'negative-movie-theaters-page-chrome-only');
    expect(badOnlyNegative).toBeDefined();
    expect(badOnlyNegative?.input).toContain("what're the best movie theaters near me?");
    expect(badOnlyNegative?.metadata?.negative).toBe(true);
    expect(badOnlyNegative?.metadata?.badLabels).toEqual(expect.arrayContaining([
      'Moviefone TV',
      'Sign In/Join',
      'FanClub',
      'Fandango Ticketing Theaters My',
      'Featured Movie Animal Farm',
      'Movie Showimes',
      'IL 60004 Update Zipcode Monday',
    ]));

    const recoveryNegative = cases.find((testCase) => testCase.id === 'negative-movie-theaters-moviefone-page-chrome');
    expect(recoveryNegative).toBeDefined();
    expect(recoveryNegative?.metadata?.expectedEntities).toEqual(expect.arrayContaining([
      'AMC Randhurst 12',
      'CMX Arlington Heights',
      'Classic Cinemas Elk Grove Theatre',
    ]));
  });

  it('contains at least 120 live semantic workflow cases without exact fixture entity requirements', () => {
    const cases = readJsonl<{
      id: string;
      expected_output?: string;
      metadata?: {
        live?: boolean;
        semanticOnly?: boolean;
        expectedEntities?: string[];
      };
    }>('agent-browser/evals/search-fulfillment/cases.live.jsonl');

    expect(cases).toHaveLength(120);
    expect(cases.every((testCase) => testCase.metadata?.live)).toBe(true);
    expect(cases.every((testCase) => testCase.metadata?.semanticOnly)).toBe(true);
    expect(cases.some((testCase) => testCase.id === 'movie-theaters-arlington-heights')).toBe(true);
    const contracts = cases.map((testCase) => JSON.parse(testCase.expected_output ?? '{}'));
    expect(contracts.every((contract) => contract.semanticOnly === true)).toBe(true);
    expect(contracts.every((contract) => !('expectedEntities' in contract))).toBe(true);
  });

  it('executes real AgentV scoring for the latest bad-only runtime response', async () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), 'agentv-search-regression-'));
    try {
      const agentvBin = path.join(repoRoot, 'node_modules/agentv/dist/cli.js');
      const { stdout } = await runNode([
        agentvBin,
        'eval',
        'run',
        'agent-browser/evals/search-fulfillment/EVAL.yaml',
        '--target',
        'agent-browser-search-fulfillment',
        '--test-id',
        'negative-movie-theaters-page-chrome-only',
        '--output',
        outputDir,
        '--workers',
        '1',
        '--threshold',
        '0.8',
      ], repoRoot);

      expect(stdout).toContain('negative-movie-theaters-page-chrome-only');
      expect(stdout).toContain('RESULT: PASS');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  }, 60000);

  it('lets the real AgentV tool-trajectory evaluator own trajectory scoring when code-grader input omits tool calls', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/search-fulfillment/graders/search-quality-gate.mjs');
    const input = {
      expected_output: JSON.stringify({
        expectedEntities: ['AMC Randhurst 12'],
        expectedLocations: ['Arlington Heights, IL'],
        forbiddenLabels: ['Moviefone TV', 'Sign In/Join', 'FanClub'],
      }),
      output: [{
        role: 'assistant',
        content: 'Here are movie theaters near Arlington Heights, IL:\n\n1. [AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12) - Why: Source-backed theater near Arlington Heights, IL.',
      }],
    };

    const result = spawnSync(process.execPath, [grader], {
      cwd: path.join(repoRoot, 'agent-browser/evals/search-fulfillment'),
      input: JSON.stringify(input),
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      assertions: Array<{ text: string; passed: boolean }>;
    };
    expect(parsed.assertions.some((assertion) => assertion.text === 'tool trajectory is scored by the AgentV tool-trajectory evaluator')).toBe(true);
    expect(parsed.assertions.some((assertion) => assertion.text.startsWith('tool trajectory includes') && !assertion.passed)).toBe(false);
  });

  it('scores AgentV file-backed output payloads for large tool trajectories', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/search-fulfillment/graders/search-quality-gate.mjs');
    const outputDir = mkdtempSync(path.join(tmpdir(), 'agentv-file-backed-output-'));
    try {
      const outputPath = path.join(outputDir, 'output.json');
      writeFileSync(outputPath, JSON.stringify([{
        role: 'assistant',
        content: [
          'Here are movie theaters near Arlington Heights, IL:',
          '',
          '1. [AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12) - Why: AMC Randhurst 12 is a movie theater with location evidence in Mount Prospect near Arlington Heights.',
        ].join('\n'),
        tool_calls: [
          'webmcp:recall_user_context',
          'webmcp:search_web',
          'search-analyzer',
          'webmcp:read_web_page',
          'validation-agent',
          'post-processor',
          'verification-agent',
          ...new Array(43).fill('validation-agent'),
        ].map((tool, index) => ({
          id: `call-${index}`,
          tool,
          input: {},
        })),
      }]));
      const input = {
        expected_output: JSON.stringify({
          expectedEntities: ['AMC Randhurst 12'],
          expectedLocations: ['Mount Prospect near Arlington Heights'],
          forbiddenLabels: ['Moviefone TV', 'Sign In/Join', 'FanClub'],
        }),
        output: null,
        output_path: outputPath,
      };

      const result = spawnSync(process.execPath, [grader], {
        cwd: path.join(repoRoot, 'agent-browser/evals/search-fulfillment'),
        input: JSON.stringify(input),
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout) as {
        score: number;
        assertions: Array<{ text: string; passed: boolean }>;
      };
      expect(parsed.score).toBe(1);
      expect(parsed.assertions).toEqual(expect.arrayContaining([
        expect.objectContaining({ text: 'answer contains expected entity AMC Randhurst 12', passed: true }),
        expect.objectContaining({ text: 'forbidden page chrome Moviefone TV is not rendered as an entity', passed: true }),
      ]));
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
