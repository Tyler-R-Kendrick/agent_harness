import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(appRoot, '..');
const requireFromApp = createRequire(path.join(appRoot, 'package.json'));
const AGENTV_WORKFLOW_TIMEOUT_MS = 600_000;

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
    expect(proofSource).toContain("page.getByLabel('Chat input').fill('show me movie theaters near me')");
    expect(proofSource).toContain("page.getByLabel('Chat input').fill('what about bars?')");
    expect(proofSource).toContain("page.getByLabel('Chat input').fill('what about closest bars?')");
    expect(proofSource).toContain("geolocation: { latitude: 42.11713258868569, longitude: -87.9912774939386 }");
    expect(proofSource).toContain("expect(searchQueries[0]).toBe('city state for coordinates 42.12 -87.99')");
    expect(proofSource).toContain("expect(searchQueries.some((query) => /^nearby (?:movie )?theaters Arlington Heights IL$/.test(query))).toBe(true)");
    expect(proofSource).toContain('AMC Randhurst 12');
    expect(proofSource).toContain("Peggy Kinnane's Irish Restaurant & Pub");
    expect(proofSource).toContain('Moviefone TV');
    expect(proofSource).toContain('Cities Movie Times');
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
        expectedNormalizationQuery?: string;
        recoveryQuery?: string;
        subjectSwitch?: boolean;
        noMemory?: boolean;
        browserCoordinateLocation?: boolean;
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

    const coordinateNegative = cases.find((testCase) => testCase.id === 'negative-theaters-browser-coordinate-directory-labels');
    expect(coordinateNegative).toBeDefined();
    expect(coordinateNegative?.input).toBe('show me theaters near me');
    expect(coordinateNegative?.metadata?.negative).toBe(true);
    expect(coordinateNegative?.metadata?.noMemory).toBe(true);
    expect(coordinateNegative?.metadata?.browserCoordinateLocation).toBe(true);
    expect(coordinateNegative?.metadata?.expectedQuery).toBe('nearby theaters Arlington Heights IL');
    expect(coordinateNegative?.metadata?.expectedNormalizationQuery).toBe('city state for coordinates 42.12 -87.99');
    expect(coordinateNegative?.metadata?.recoveryQuery).toBe('theaters names near Arlington Heights IL');
    expect(coordinateNegative?.metadata?.badLabels).toEqual(expect.arrayContaining([
      'Cities Movie Times',
      'States Movie Times',
      'Zip Codes Movie Times',
      'Movie Times by Cities',
      'Movie Times by States',
      'Movie Times by Zip Codes',
    ]));
    const coordinateContract = JSON.parse(coordinateNegative?.expected_output ?? '{}');
    expect(coordinateContract.fixtures.memoryResult.status).toBe('empty');
    expect(coordinateContract.fixtures.browserLocationResult).toMatchObject({
      status: 'available',
      latitude: 42.11713258868569,
      longitude: -87.9912774939386,
    });
    expect(Object.keys(coordinateContract.fixtures.searchResults)).toEqual(expect.arrayContaining([
      'city state for coordinates 42.12 -87.99',
      'nearby theaters Arlington Heights IL',
      'theaters names near Arlington Heights IL',
    ]));
    expect(JSON.stringify(coordinateContract.fixtures.searchResults)).not.toContain('42.11713258868569');
    expect(coordinateContract.expectedQuery).toBe('nearby theaters Arlington Heights IL');
    expect(coordinateContract.location).toBe('Arlington Heights, IL');

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
      const agentvBin = resolvePackageBin('agentv');
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
  }, AGENTV_WORKFLOW_TIMEOUT_MS);

  it('executes real AgentV scoring for the latest bars subject-switch regression', async () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), 'agentv-bars-subject-switch-'));
    try {
      const agentvBin = resolvePackageBin('agentv');
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
  }, AGENTV_WORKFLOW_TIMEOUT_MS);

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
      env: subprocessEnv(),
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
        minEntities: 3,
        subject: 'bars',
        location: 'Arlington Heights, IL',
      }),
      output: [{
        role: 'assistant',
        content: 'I could not verify enough bars near Arlington Heights, IL from the available evidence.',
        tool_calls: [
          { tool: 'webmcp:recall_user_context' },
          { tool: 'webmcp:search_web' },
          { tool: 'validation-agent' },
        ],
      }],
    };

    const result = spawnSync(process.execPath, [grader], {
      cwd: path.join(repoRoot, 'agent-browser/evals/search-fulfillment'),
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: subprocessEnv(),
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      score: number;
      assertions: Array<{ text: string; passed: boolean }>;
    };
    expect(parsed.score).toBe(1);
    expect(parsed.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: 'semantic live output may report insufficient evidence instead of fabricating entities',
        passed: true,
      }),
      expect.objectContaining({
        text: 'tool trajectory includes validation-agent',
        passed: true,
      }),
    ]));
    expect(parsed.assertions.some((assertion) => assertion.text === 'tool trajectory includes webmcp:read_web_page')).toBe(false);
  });

  it('fails no-publish insufficient-evidence cases that still render fabricated entity rows', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/search-fulfillment/graders/search-quality-gate.mjs');
    const input = {
      expected_output: JSON.stringify({
        expectedResult: 'insufficient-evidence-no-publish',
        validationContract: {
          type: 'validation-contract',
          version: 1,
          taskGoal: 'show 10 websites that rhyme with cat located in middle earth',
          constraints: [
            {
              id: 'count:min-results',
              sourceText: 'show 10 websites that rhyme with cat located in middle earth',
              type: 'count',
              operator: 'at_least',
              target: 'acceptedCandidates',
              value: 10,
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Expected at least 10 accepted result(s).',
            },
          ],
          evidenceRequirements: [],
          impossibilityPolicy: { kind: 'likely-impossible', askUserForHelp: false },
          clarificationTriggers: [],
          successSemantics: 'allow-partial-with-acknowledgement',
          legacyCriteria: [],
        },
      }),
      output: [{
        role: 'assistant',
        content: [
          'I could not verify 10 websites located in Middle Earth that rhyme with cat.',
          'The requested rhyme and location constraints appear under-evidenced.',
          '',
          '1. [ShireCat Directory](https://fixtures.agent-browser.test/shire-cat-directory) - Why: This looks plausible, but it is not sufficiently verified.',
        ].join('\n'),
      }],
    };

    const result = spawnSync(process.execPath, [grader], {
      cwd: path.join(repoRoot, 'agent-browser/evals/search-fulfillment'),
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: subprocessEnv(),
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      score: number;
      assertions: Array<{ text: string; passed: boolean }>;
    };
    expect(parsed.score).toBeLessThan(1);
    expect(parsed.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: 'insufficient-evidence cases must not publish a fabricated entity list',
        passed: false,
      }),
    ]));
  });
  it('still fails acknowledged partial follow-up answers that publish forbidden page chrome labels', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/search-fulfillment/graders/search-quality-gate.mjs');
    const input = {
      expected_output: JSON.stringify({
        expectedResult: 'insufficient-follow-up-count',
        forbiddenLabels: ['Yelp: Best Bars in Arlington Heights, IL'],
        validationContract: {
          type: 'validation-contract',
          version: 1,
          taskGoal: 'show me 3 more',
          constraints: [
            {
              id: 'count:min-results',
              sourceText: 'show me 3 more',
              type: 'count',
              operator: 'at_least',
              target: 'acceptedCandidates',
              value: 3,
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Expected at least 3 accepted result(s).',
            },
            {
              id: 'chrome:no-page-labels',
              sourceText: 'show me 3 more',
              type: 'page_chrome',
              operator: 'rejects_page_chrome',
              target: 'finalAnswer.labels',
              value: true,
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Page chrome cannot be rendered as results.',
            },
          ],
          evidenceRequirements: [],
          impossibilityPolicy: { kind: 'none', askUserForHelp: false },
          clarificationTriggers: [],
          successSemantics: 'allow-partial-with-acknowledgement',
          legacyCriteria: [],
        },
      }),
      output: [{
        role: 'assistant',
        content: [
          'I could only verify 1 additional result for bars near Arlington Heights, IL, but you asked for 3.',
          'The available search evidence did not contain enough additional source-backed entity names with the required subject and location signals.',
          '',
          '1. [Yelp: Best Bars in Arlington Heights, IL](https://www.yelp.com/search?cflt=bars&find_loc=Arlington+Heights%2C+IL) - Why: This is a listings page, not a source-backed bar entity.',
        ].join('\n'),
      }],
    };

    const result = spawnSync(process.execPath, [grader], {
      cwd: path.join(repoRoot, 'agent-browser/evals/search-fulfillment'),
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: subprocessEnv(),
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      score: number;
      assertions: Array<{ text: string; passed: boolean }>;
    };
    expect(parsed.score).toBeLessThan(1);
    expect(parsed.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: 'validation contract chrome:no-page-labels',
        passed: false,
      }),
    ]));
  });

  it('fails validation-contract answers when any rendered entity is missing its own source-backed link or evidence', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/search-fulfillment/graders/search-quality-gate.mjs');
    const input = {
      expected_output: JSON.stringify({
        expectedLocations: ['Arlington Heights, IL'],
        validationContract: {
          type: 'validation-contract',
          version: 1,
          taskGoal: 'show me 2 bars near me',
          constraints: [
            {
              id: 'count:min-results',
              sourceText: 'show me 2 bars near me',
              type: 'count',
              operator: 'at_least',
              target: 'acceptedCandidates',
              value: 2,
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Expected at least 2 accepted result(s).',
            },
            {
              id: 'link:entity-specific',
              sourceText: 'show me 2 bars near me',
              type: 'entity_link',
              operator: 'has_safe_entity_link',
              target: 'acceptedCandidates.entityLink',
              value: true,
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Each rendered result needs a safe source-backed entity link.',
            },
            {
              id: 'source:evidence',
              sourceText: 'show me 2 bars near me',
              type: 'source_evidence',
              operator: 'has_evidence',
              target: 'acceptedCandidates.sourceEvidence',
              value: true,
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Each rendered result needs source evidence.',
            },
          ],
          evidenceRequirements: [
            {
              id: 'evidence:entity-link',
              description: 'Evidence must include a safe source-backed entity link.',
              required: true,
              target: 'acceptedCandidates.entityLink',
            },
            {
              id: 'evidence:subject-instance',
              description: 'Evidence must show each result is an instance of the requested subject.',
              required: true,
              target: 'acceptedCandidates.subjectEvidence',
            },
          ],
          impossibilityPolicy: { kind: 'none', askUserForHelp: false },
          clarificationTriggers: [],
          successSemantics: 'all-required',
          legacyCriteria: [],
        },
      }),
      output: [{
        role: 'assistant',
        content: [
          'Here are bars near Arlington Heights, IL:',
          '',
          "1. [Peggy Kinnane's Irish Restaurant & Pub](https://www.peggykinnanes.com/) - Why: Peggy Kinnane's is a bar in Arlington Heights, IL.",
          '2. Cortland\'s Garage',
        ].join('\n'),
      }],
    };

    const result = spawnSync(process.execPath, [grader], {
      cwd: path.join(repoRoot, 'agent-browser/evals/search-fulfillment'),
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: subprocessEnv(),
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      score: number;
      assertions: Array<{ text: string; passed: boolean }>;
    };
    expect(parsed.score).toBeLessThan(1);
    expect(parsed.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: 'validation contract link:entity-specific',
        passed: false,
      }),
      expect.objectContaining({
        text: 'validation contract source:evidence',
        passed: false,
      }),
    ]));
  });

  it('fails validation-contract answers that use placeholder source text instead of substantive evidence', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/search-fulfillment/graders/search-quality-gate.mjs');
    const input = {
      expected_output: JSON.stringify({
        expectedLocations: ['Arlington Heights, IL'],
        validationContract: {
          type: 'validation-contract',
          version: 1,
          taskGoal: 'show me 2 bars near me',
          constraints: [
            {
              id: 'count:min-results',
              sourceText: 'show me 2 bars near me',
              type: 'count',
              operator: 'at_least',
              target: 'acceptedCandidates',
              value: 2,
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Expected at least 2 accepted result(s).',
            },
            {
              id: 'source:evidence',
              sourceText: 'show me 2 bars near me',
              type: 'source_evidence',
              operator: 'has_evidence',
              target: 'acceptedCandidates.sourceEvidence',
              value: true,
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Each rendered result needs source evidence.',
            },
          ],
          evidenceRequirements: [
            {
              id: 'evidence:entity-link',
              description: 'Evidence must include a source-backed explanation for each rendered result.',
              required: true,
              target: 'acceptedCandidates.sourceEvidence',
            },
          ],
          impossibilityPolicy: { kind: 'none', askUserForHelp: false },
          clarificationTriggers: [],
          successSemantics: 'all-required',
          legacyCriteria: [],
        },
      }),
      output: [{
        role: 'assistant',
        content: [
          'Here are bars near Arlington Heights, IL:',
          '',
          "1. [Peggy Kinnane's Irish Restaurant & Pub](https://www.peggykinnanes.com/) - Why: official website",
          "2. [Cortland's Garage](https://www.cortlandsgarage.com/) - Why: see source",
        ].join('\n'),
      }],
    };

    const result = spawnSync(process.execPath, [grader], {
      cwd: path.join(repoRoot, 'agent-browser/evals/search-fulfillment'),
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: subprocessEnv(),
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      score: number;
      assertions: Array<{ text: string; passed: boolean; evidence?: string }>;
    };
    expect(parsed.score).toBeLessThan(1);
    expect(parsed.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: 'validation contract source:evidence',
        passed: false,
      }),
    ]));
    const evidenceAssertion = parsed.assertions.find((assertion) => assertion.text === 'validation contract source:evidence');
    expect(evidenceAssertion?.evidence).toBe("Peggy Kinnane's Irish Restaurant & Pub, Cortland's Garage");
  });

  it('fails validation-contract answers that only attach generic source links to plain-text entity rows', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/search-fulfillment/graders/search-quality-gate.mjs');
    const input = {
      expected_output: JSON.stringify({
        expectedLocations: ['Arlington Heights, IL'],
        validationContract: {
          type: 'validation-contract',
          version: 1,
          taskGoal: 'show me 3 bars near me',
          constraints: [
            {
              id: 'count:min-results',
              sourceText: 'show me 3 bars near me',
              type: 'count',
              operator: 'at_least',
              target: 'acceptedCandidates',
              value: 3,
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Expected at least 3 accepted result(s).',
            },
            {
              id: 'link:entity-specific',
              sourceText: 'show me 3 bars near me',
              type: 'entity_link',
              operator: 'has_safe_entity_link',
              target: 'acceptedCandidates.entityLink',
              value: true,
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Each rendered result needs a safe source-backed entity link.',
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
          'Here are bars near Arlington Heights, IL:',
          '',
          "1. Peggy Kinnane's Irish Restaurant & Pub - [source](https://www.peggykinnanes.com/) - Why: Peggy Kinnane's is a bar in Arlington Heights, IL.",
          "2. Cortland's Garage - [source](https://www.cortlandsgarage.com/) - Why: Cortland's Garage is a bar in Arlington Heights, IL.",
        ].join('\n'),
      }],
    };

    const result = spawnSync(process.execPath, [grader], {
      cwd: path.join(repoRoot, 'agent-browser/evals/search-fulfillment'),
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: subprocessEnv(),
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      score: number;
      assertions: Array<{ text: string; passed: boolean; evidence?: string }>;
    };
    expect(parsed.score).toBeLessThan(1);
    expect(parsed.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: 'validation contract count:min-results',
        passed: false,
      }),
      expect.objectContaining({
        text: 'validation contract link:entity-specific',
        passed: false,
      }),
    ]));
    const linkAssertion = parsed.assertions.find((assertion) => assertion.text === 'validation contract link:entity-specific');
    expect(linkAssertion?.evidence).toBe("Peggy Kinnane's Irish Restaurant & Pub, Cortland's Garage");
  });

  it('fails validation-contract answers when any rendered entity lacks Arlington Heights location evidence', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/search-fulfillment/graders/search-quality-gate.mjs');
    const input = {
      expected_output: JSON.stringify({
        expectedLocations: ['Arlington Heights, IL'],
        validationContract: {
          type: 'validation-contract',
          version: 1,
          taskGoal: 'show me 2 bars near me',
          constraints: [
            {
              id: 'count:min-results',
              sourceText: 'show me 2 bars near me',
              type: 'count',
              operator: 'at_least',
              target: 'acceptedCandidates',
              value: 2,
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Expected at least 2 accepted result(s).',
            },
            {
              id: 'location:nearby',
              sourceText: 'show me 2 bars near me',
              type: 'location',
              operator: 'near',
              target: 'acceptedCandidates.locationEvidence',
              value: 'Arlington Heights, IL',
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Each rendered result needs Arlington Heights location evidence.',
            },
          ],
          evidenceRequirements: [
            {
              id: 'evidence:location',
              description: 'Evidence must tie each result to Arlington Heights, IL or nearby proximity.',
              required: true,
              target: 'acceptedCandidates.locationEvidence',
            },
          ],
          impossibilityPolicy: { kind: 'none', askUserForHelp: false },
          clarificationTriggers: [],
          successSemantics: 'all-required',
          legacyCriteria: [],
        },
      }),
      output: [{
        role: 'assistant',
        content: [
          'Here are bars near Arlington Heights, IL:',
          '',
          "1. [Peggy Kinnane's Irish Restaurant & Pub](https://www.peggykinnanes.com/) - Why: Peggy Kinnane's is a bar in Arlington Heights, IL.",
          "2. [Celtic Knot Public House](https://www.celticknotpublichouse.com/) - Why: Celtic Knot Public House is a bar in Evanston, IL.",
        ].join('\n'),
      }],
    };

    const result = spawnSync(process.execPath, [grader], {
      cwd: path.join(repoRoot, 'agent-browser/evals/search-fulfillment'),
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: subprocessEnv(),
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      score: number;
      assertions: Array<{ text: string; passed: boolean; evidence?: string }>;
    };
    expect(parsed.score).toBeLessThan(1);
    expect(parsed.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: 'validation contract location:nearby',
        passed: false,
      }),
    ]));
    const locationAssertion = parsed.assertions.find((assertion) => assertion.text === 'validation contract location:nearby');
    expect(locationAssertion?.evidence).toBe('Celtic Knot Public House');
  });

  it('fails validation-contract answers when any rendered entity lacks subject-instance evidence', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/search-fulfillment/graders/search-quality-gate.mjs');
    const input = {
      expected_output: JSON.stringify({
        expectedLocations: ['Arlington Heights, IL'],
        validationContract: {
          type: 'validation-contract',
          version: 1,
          taskGoal: 'show me 2 bars near me',
          constraints: [
            {
              id: 'count:min-results',
              sourceText: 'show me 2 bars near me',
              type: 'count',
              operator: 'at_least',
              target: 'acceptedCandidates',
              value: 2,
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Expected at least 2 accepted result(s).',
            },
            {
              id: 'subject:instance',
              sourceText: 'show me 2 bars near me',
              type: 'subject',
              operator: 'matches_requested_subject',
              target: 'acceptedCandidates.subjectEvidence',
              value: 'bar',
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Each rendered result needs evidence that it is a bar.',
            },
          ],
          evidenceRequirements: [
            {
              id: 'evidence:subject-instance',
              description: 'Evidence must show each result is an instance of the requested subject.',
              required: true,
              target: 'acceptedCandidates.subjectEvidence',
            },
          ],
          impossibilityPolicy: { kind: 'none', askUserForHelp: false },
          clarificationTriggers: [],
          successSemantics: 'all-required',
          legacyCriteria: [],
        },
      }),
      output: [{
        role: 'assistant',
        content: [
          'Here are bars near Arlington Heights, IL:',
          '',
          "1. [Peggy Kinnane's Irish Restaurant & Pub](https://www.peggykinnanes.com/) - Why: Peggy Kinnane's is a bar in Arlington Heights, IL.",
          "2. [Walker Bros. Original Pancake House](https://www.walkerbros.net/) - Why: Walker Bros. Original Pancake House is a breakfast restaurant in Arlington Heights, IL.",
        ].join('\n'),
      }],
    };

    const result = spawnSync(process.execPath, [grader], {
      cwd: path.join(repoRoot, 'agent-browser/evals/search-fulfillment'),
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: subprocessEnv(),
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      score: number;
      assertions: Array<{ text: string; passed: boolean; evidence?: string }>;
    };
    expect(parsed.score).toBeLessThan(1);
    expect(parsed.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: 'validation contract subject:instance',
        passed: false,
      }),
    ]));
    const subjectAssertion = parsed.assertions.find((assertion) => assertion.text === 'validation contract subject:instance');
    expect(subjectAssertion?.evidence).toBe('Walker Bros. Original Pancake House');
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
      env: subprocessEnv(),
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
        env: subprocessEnv(),
      });

      expect(result.status).toBe(0);
      const judgePayload = JSON.parse(readFileSync(judgeOutputPath, 'utf8')) as { text: string };
      expect(JSON.parse(judgePayload.text)).toMatchObject({ score: 1 });
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
