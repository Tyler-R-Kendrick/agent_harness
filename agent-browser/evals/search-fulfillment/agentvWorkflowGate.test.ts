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
      '4',
    ]));
    expect(liveCommand.args).toEqual(expect.arrayContaining([
      'eval',
      'run',
      'agent-browser/evals/search-fulfillment/EVAL.live.yaml',
      '--target',
      'agent-browser-search-fulfillment-live',
      '--workers',
      '4',
    ]));
    expect(runnerSource).toContain('agentv-listener-budget.mjs');
    expect(runnerSource).toContain("AGENT_BROWSER_LIVE_FETCH_TIMEOUT_MS: process.env.AGENT_BROWSER_LIVE_FETCH_TIMEOUT_MS ?? '750'");
    expect(runnerSource).toContain('await rm(outputDir, { recursive: true, force: true })');
    expect(readText('agent-browser/scripts/agentv-listener-budget.mjs')).toContain('AGENTV_STDIO_LISTENER_BUDGET = 256');
  });

  it('declares a real app runtime proof for the canonical port 5174 browser replay', () => {
    const packageJson = readJson<{
      scripts: Record<string, string>;
    }>('agent-browser/package.json');
    const proofSource = readText('agent-browser/scripts/runtime-search-proof.mjs');

    expect(packageJson.scripts['proof:runtime-search']).toBe('node scripts/runtime-search-proof.mjs');
    expect(proofSource).toContain('const port = Number(process.env.AGENT_BROWSER_RUNTIME_PROOF_PORT) || 5174');
    const stalePortFallback = ['|| 51', '73'].join('');
    expect(proofSource).not.toContain(stalePortFallback);
    expect(proofSource).toContain("page.getByLabel('Chat input').fill(\"what're the best movie theaters near me?\")");
    expect(proofSource).toContain("page.getByLabel('Chat input').fill('what about bars?')");
    expect(proofSource).toContain("page.getByLabel('Chat input').fill('what about closest bars?')");
    expect(proofSource).toContain('AMC Randhurst 12');
    expect(proofSource).toContain("Peggy Kinnane's Irish Restaurant & Pub");
    expect(proofSource).toContain('Moviefone TV');
    expect(proofSource).toContain('Support Enable');
    expect(proofSource).toContain('Yelp: Best Bars in Arlington Heights, IL');
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
    expect(runtimeSource).toContain('validationContract: contract.validationContract');
    expect(runtimeSource).not.toContain('expected.expectedEntities');
    expect(runtimeSource).not.toContain('positiveAnswer');
    expect(runtimeSource).not.toContain('acceptedCandidates = negative');
  });

  it('contains at least 120 deterministic workflow cases with the latest bad runtime response as a negative case', () => {
    const cases = readJsonl<{
      id: string;
      input: string;
      expected_output?: string;
      metadata?: {
        domain?: string;
        rankingGoal?: string;
        negative?: boolean;
        arbitraryConstraints?: boolean;
        badLabels?: string[];
        expectedEntities?: string[];
        expectedQuery?: string;
        subjectSwitch?: boolean;
      };
    }>('agent-browser/evals/search-fulfillment/cases.jsonl');

    expect(cases.length).toBeGreaterThanOrEqual(240);
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

    const barsNegative = cases.find((testCase) => testCase.id === 'negative-bars-aggregate-source-pages');
    expect(barsNegative).toBeDefined();
    expect(barsNegative?.input).toBe('what about closest bars?');
    expect(barsNegative?.metadata?.negative).toBe(true);
    expect(barsNegative?.metadata?.badLabels).toEqual(expect.arrayContaining([
      'Yelp: Best Bars in Arlington Heights, IL',
      "Chicago Bound: Arlington Heights' Best Bars",
      'Yellow Pages: Bars in Arlington Heights',
      'Restaurantji: Best Bars near Arlington Heights',
      'Restaurant Guru: Top 7 pubs & bars',
    ]));
    expect(barsNegative?.metadata?.expectedEntities).toEqual(expect.arrayContaining([
      "Peggy Kinnane's Irish Restaurant & Pub",
      'Hey Nonny',
      "Cortland's Garage",
    ]));

    const barsArticleNegative = cases.find((testCase) => testCase.id === 'negative-follow-up-bars-article-page-chrome');
    expect(barsArticleNegative).toBeDefined();
    expect(barsArticleNegative?.input).toBe('what about bars?');
    expect(barsArticleNegative?.metadata?.negative).toBe(true);
    expect(barsArticleNegative?.metadata?.subjectSwitch).toBe(true);
    expect(barsArticleNegative?.metadata?.expectedQuery).toBe('bars Arlington Heights IL');
    expect(barsArticleNegative?.metadata?.badLabels).toEqual(expect.arrayContaining([
      'Support Enable',
      'Join Now Enable',
      'Chicago Bound',
      "Arlington Heights' Best Bars Spots [2026 Guide]",
      'Shop Categories',
      'About Us',
      'Enable dark mode',
      'Yelp: Best Bars in Arlington Heights, IL',
    ]));
    expect(barsArticleNegative?.metadata?.expectedEntities).toEqual(expect.arrayContaining([
      "Peggy Kinnane's Irish Restaurant & Pub",
      'Hey Nonny',
      "Cortland's Garage",
    ]));
    const barsArticleContract = JSON.parse(barsArticleNegative?.expected_output ?? '{}');
    expect(barsArticleContract.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: 'what are the best movie theaters near me?' }),
      expect.objectContaining({ role: 'user', content: 'what about bars?' }),
    ]));
    expect(Object.keys(barsArticleContract.fixtures.searchResults).join('\n')).not.toContain('movie theaters');
    expect(barsArticleContract.expectedQuery).toBe('bars Arlington Heights IL');

    const arbitraryPrefix = cases.find((testCase) => testCase.id === 'arbitrary-vatican-shops-prefix-a');
    expect(arbitraryPrefix).toBeDefined();
    expect(arbitraryPrefix?.metadata?.arbitraryConstraints).toBe(true);
    const arbitraryPrefixContract = JSON.parse(arbitraryPrefix?.expected_output ?? '{}');
    expect(arbitraryPrefixContract.validationContract.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'name:prefix', type: 'name_prefix', value: 'A' }),
      expect.objectContaining({ type: 'location', value: 'Vatican' }),
    ]));

    const arbitraryImpossible = cases.find((testCase) => testCase.id === 'arbitrary-websites-middle-earth-rhyme-cat-insufficient');
    expect(arbitraryImpossible).toBeDefined();
    const arbitraryImpossibleContract = JSON.parse(arbitraryImpossible?.expected_output ?? '{}');
    expect(arbitraryImpossibleContract.validationContract.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'count:min-results', type: 'count', value: 10 }),
      expect.objectContaining({ id: 'name:rhyme', type: 'rhyme', value: 'cat' }),
    ]));
    expect(arbitraryImpossibleContract.validationContract.impossibilityPolicy.kind).toBe('likely-impossible');
  });

  it('contains a deterministic multi-turn follow-up suite that inherits search context', () => {
    const cases = readJsonl<{
      id: string;
      input: string;
      expected_output?: string;
      metadata?: {
        followUp?: boolean;
        minimumAcceptedEntities?: number;
        priorEntity?: string;
        requestedCount?: number;
        expectedQuery?: string;
        excludedCandidates?: string[];
      };
    }>('agent-browser/evals/search-fulfillment/cases.jsonl');

    const followUps = cases.filter((testCase) => testCase.metadata?.followUp);
    expect(followUps.length).toBeGreaterThanOrEqual(120);
    const exactRegression = followUps.find((testCase) => testCase.id === 'follow-up-bars-show-me-3-more');
    expect(exactRegression).toBeDefined();
    expect(exactRegression?.input).toBe('show me 3 more');
    expect(exactRegression?.metadata?.expectedQuery).toBe('closest bars Arlington Heights IL');
    expect(exactRegression?.metadata?.excludedCandidates).toEqual(expect.arrayContaining([
      'Sports Page Bar & Grill Arlington Heights',
    ]));

    const contract = JSON.parse(exactRegression?.expected_output ?? '{}');
    expect(contract.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: 'what are the closest bars near me?' }),
      expect.objectContaining({ role: 'user', content: 'show me 3 more' }),
    ]));
    expect(contract.requestedCount).toBe(3);
    expect(contract.minimumAcceptedEntities).toBe(3);
    expect(JSON.stringify(contract)).not.toContain('"query":"show me 3 more"');

    const shortfallRegression = followUps.find((testCase) => testCase.id === 'negative-follow-up-bars-show-me-3-more-only-one-result');
    expect(shortfallRegression).toBeDefined();
    expect(shortfallRegression?.metadata?.minimumAcceptedEntities).toBe(3);
    const shortfallContract = JSON.parse(shortfallRegression?.expected_output ?? '{}');
    expect(shortfallContract.expectedResult).toBe('insufficient-follow-up-count');
    expect(shortfallContract.requestedCount).toBe(3);
    expect(shortfallContract.minimumAcceptedEntities).toBe(3);
    expect(shortfallContract.excludedCandidates).toEqual(expect.arrayContaining([
      'Sports Page Bar & Grill Arlington Heights',
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
    expect(contracts.every((contract) => contract.validationContract?.type === 'validation-contract')).toBe(true);
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
  }, 120_000);

  it('executes real AgentV scoring for the latest bars subject-switch regression', async () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), 'agentv-bars-subject-switch-'));
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
        'negative-follow-up-bars-article-page-chrome',
        '--output',
        outputDir,
        '--workers',
        '1',
        '--threshold',
        '0.8',
      ], repoRoot);

      expect(stdout).toContain('negative-follow-up-bars-article-page-chrome');
      expect(stdout).toContain('RESULT: PASS');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  }, 120_000);

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

  it('accepts live semantic insufficient-evidence outputs without requiring an impossible page read', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/search-fulfillment/graders/search-quality-gate.mjs');
    const input = {
      expected_output: JSON.stringify({
        semanticOnly: true,
        expectedResult: 'semantic-entities-or-insufficient-evidence',
        subject: 'gyms',
        location: 'Arlington Heights, IL',
        minEntities: 1,
        forbiddenLabels: ['At Home', 'Movie Charts', 'Sign In/Join'],
      }),
      output: [{
        role: 'assistant',
        content: [
          'I found your location, but web search is unavailable. Please provide a search source or candidate results for open now gyms.',
          'Search issue: No search results found.',
        ].join('\n'),
        tool_calls: [
          { id: 'call-1', tool: 'validation-agent', input: {} },
          { id: 'call-2', tool: 'webmcp:recall_user_context', input: {} },
          { id: 'call-3', tool: 'validation-agent', input: {} },
          { id: 'call-4', tool: 'webmcp:search_web', input: { query: 'open now gyms Arlington Heights IL' } },
          { id: 'call-5', tool: 'validation-agent', input: {} },
        ],
      }],
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
    expect(parsed.assertions.some((assertion) => assertion.text.includes('webmcp:read_web_page') && !assertion.passed)).toBe(false);
  });

  it('scores live semantic unavailable answers as valid insufficient evidence in the AgentV LLM judge', () => {
    const judge = path.join(repoRoot, 'agent-browser/scripts/search-eval-llm-judge.mjs');
    const outputDir = mkdtempSync(path.join(tmpdir(), 'agentv-live-insufficient-judge-'));
    try {
      const promptPath = path.join(outputDir, 'prompt.md');
      const judgeOutputPath = path.join(outputDir, 'judge-output.json');
      writeFileSync(promptPath, [
        '[[ ## expected_output ## ]]',
        JSON.stringify({
          semanticOnly: true,
          expectedResult: 'semantic-entities-or-insufficient-evidence',
          subject: 'gyms',
          location: 'Arlington Heights, IL',
        }),
        '',
        '[[ ## answer ## ]]',
        'I found your location, but web search is unavailable. Please provide a search source or candidate results for open now gyms.',
        'Search issue: No search results found.',
      ].join('\n'));

      const result = spawnSync(process.execPath, [
        judge,
        '--prompt-file',
        promptPath,
        '--out',
        judgeOutputPath,
      ], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const judgePayload = JSON.parse(readFileSync(judgeOutputPath, 'utf8')) as { text: string };
      expect(JSON.parse(judgePayload.text)).toMatchObject({ score: 1 });
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
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

  it('fails AgentV search quality when a follow-up asks for three more but one entity is rendered as complete success', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/search-fulfillment/graders/search-quality-gate.mjs');
    const input = {
      expected_output: JSON.stringify({
        expectedEntities: [
          "Peggy Kinnane's Irish Restaurant & Pub",
          'Hey Nonny',
          "Cortland's Garage",
        ],
        expectedLocations: ['Arlington Heights, IL'],
        forbiddenLabels: ['Yelp: Best Bars in Arlington Heights, IL'],
        requestedCount: 3,
        minimumAcceptedEntities: 3,
        excludedCandidates: ['Sports Page Bar & Grill Arlington Heights'],
      }),
      output: [{
        role: 'assistant',
        content: [
          'Here are bars near Arlington Heights, IL:',
          '',
          "1. [Peggy Kinnane's Irish Restaurant & Pub](https://www.peggykinnanes.com/) - Why: Peggy Kinnane's is a bar in Arlington Heights, IL.",
        ].join('\n'),
      }],
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
    expect(parsed.score).toBeLessThan(1);
    expect(parsed.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: 'answer renders at least 3 requested entities',
        passed: false,
      }),
    ]));
  });

  it('accepts a verified partial follow-up answer only when it acknowledges the requested-count shortfall', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/search-fulfillment/graders/search-quality-gate.mjs');
    const input = {
      expected_output: JSON.stringify({
        expectedResult: 'insufficient-follow-up-count',
        expectedLocations: ['Arlington Heights, IL'],
        forbiddenLabels: ['Yelp: Best Bars in Arlington Heights, IL'],
        requestedCount: 3,
        minimumAcceptedEntities: 3,
        excludedCandidates: ['Sports Page Bar & Grill Arlington Heights'],
      }),
      output: [{
        role: 'assistant',
        content: [
          'I could only verify 1 additional result for bars near Arlington Heights, IL, but you asked for 3.',
          'The available search evidence did not contain enough additional source-backed entity names with the required subject and location signals.',
          '',
          "1. [Peggy Kinnane's Irish Restaurant & Pub](https://www.peggykinnanes.com/) - Why: Peggy Kinnane's is a bar in Arlington Heights, IL.",
        ].join('\n'),
      }],
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
      expect.objectContaining({
        text: 'insufficient-evidence cases must not publish a fabricated entity list',
        passed: true,
      }),
    ]));
  });

  it('fails AgentV search quality when an arbitrary prefix contract is violated', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/search-fulfillment/graders/search-quality-gate.mjs');
    const input = {
      expected_output: JSON.stringify({
        expectedEntities: ['Alpha Gifts'],
        expectedLocations: ['Vatican'],
        forbiddenLabels: [],
        validationContract: {
          type: 'validation-contract',
          version: 1,
          taskGoal: 'provide shops in the Vatican that start with the letter A',
          constraints: [
            {
              id: 'name:prefix',
              sourceText: 'provide shops in the Vatican that start with the letter A',
              type: 'name_prefix',
              operator: 'starts_with',
              target: 'acceptedCandidates.name',
              value: 'A',
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Result names must start with A.',
            },
          ],
          evidenceRequirements: [],
          impossibilityPolicy: { kind: 'none', askUserForHelp: false },
          clarificationTriggers: [],
          successSemantics: 'all-required',
          legacyCriteria: [],
        },
      }),
      output: [{
        role: 'assistant',
        content: [
          'Here are shops in Vatican:',
          '',
          '1. [Basilica Books](https://fixtures.agent-browser.test/basilica-books) - Why: Basilica Books is a shop in Vatican.',
        ].join('\n'),
      }],
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
    expect(parsed.score).toBeLessThan(1);
    expect(parsed.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: 'validation contract name:prefix',
        passed: false,
      }),
    ]));
  });

  it('scores arbitrary impossible constraint acknowledgements in the AgentV LLM judge', () => {
    const judge = path.join(repoRoot, 'agent-browser/scripts/search-eval-llm-judge.mjs');
    const outputDir = mkdtempSync(path.join(tmpdir(), 'agentv-arbitrary-impossible-judge-'));
    try {
      const promptPath = path.join(outputDir, 'prompt.md');
      const judgeOutputPath = path.join(outputDir, 'judge-output.json');
      writeFileSync(promptPath, [
        '[[ ## expected_output ## ]]',
        JSON.stringify({
          expectedResult: 'insufficient-evidence-no-publish',
          validationContract: {
            type: 'validation-contract',
            version: 1,
            taskGoal: 'show 10 websites that rhyme with cat located in middle earth',
            constraints: [
              {
                id: 'count:min-results',
                type: 'count',
                value: 10,
                required: true,
                failureMessage: 'Expected at least 10 accepted result(s).',
              },
              {
                id: 'name:rhyme',
                type: 'rhyme',
                value: 'cat',
                required: true,
                failureMessage: 'Result names must rhyme with cat.',
              },
            ],
            successSemantics: 'allow-partial-with-acknowledgement',
          },
        }),
        '',
        '[[ ## answer ## ]]',
        'I could not verify 10 websites located in middle earth that rhyme with cat. The requested rhyme and location constraints appear under-evidenced.',
      ].join('\n'));

      const result = spawnSync(process.execPath, [
        judge,
        '--prompt-file',
        promptPath,
        '--out',
        judgeOutputPath,
      ], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const judgePayload = JSON.parse(readFileSync(judgeOutputPath, 'utf8')) as { text: string };
      expect(JSON.parse(judgePayload.text)).toMatchObject({ score: 1 });
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
