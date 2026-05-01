import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCompositeSearchAgentPrompt,
  evaluateCompositeSearchAgentPolicy,
  selectCompositeSearchAgentTools,
} from '../../src/chat-agents/Search';
import type { ToolDescriptor } from '../../src/tools';

interface CompositeSearchEvalCase {
  id: string;
  task: string;
  intent: string;
  expectedToolIds: string[];
  mustMention: string[];
  mustNotMention: string[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const descriptors: ToolDescriptor[] = [
  {
    id: 'webmcp:search_web',
    label: 'Search web',
    description: 'Search the public web for current, external, and local facts.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:local_web_research',
    label: 'Local web research',
    description: 'Search local SearXNG, crawl result pages, rank evidence, and return citations.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:read_web_page',
    label: 'Read web page',
    description: 'Read and extract source pages for entity evidence.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'cli',
    label: 'CLI',
    description: 'Run shell commands.',
    group: 'built-in',
    groupLabel: 'Built-In',
  },
];

function readCases(): CompositeSearchEvalCase[] {
  return readFileSync(path.join(__dirname, 'cases.jsonl'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CompositeSearchEvalCase);
}

describe('composite-search-agent AgentEvals', () => {
  it('declares a real AgentV/AgentEvals CLI target and npm runner', async () => {
    const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const targetsYaml = readFileSync(path.resolve(__dirname, '../../../.agentv/targets.yaml'), 'utf8');
    const evalYaml = readFileSync(path.resolve(__dirname, 'EVAL.yaml'), 'utf8');
    const { buildAgentvCompositeSearchEvalCommand } = await import(
      pathToFileURL(path.resolve(__dirname, '../../scripts/run-agentv-composite-search-eval.mjs')).href
    );
    const command = buildAgentvCompositeSearchEvalCommand();

    expect(packageJson.scripts['eval:composite-search']).toBe('node scripts/run-agentv-composite-search-eval.mjs');
    expect(targetsYaml).toContain('name: agent-browser-composite-search-agent');
    expect(targetsYaml).toContain('composite-search-eval-target-runtime.ts');
    expect(evalYaml).toContain('mode: in_order');
    expect(evalYaml).toContain('type: code-grader');
    expect(evalYaml).toContain('./graders/composite-search-quality-gate.mjs');
    expect(command.packageName).toBe('agentv');
    expect(command.args).toEqual(expect.arrayContaining([
      'eval',
      'run',
      'agent-browser/evals/composite-search-agent/EVAL.yaml',
      '--target',
      'agent-browser-composite-search-agent',
      '--threshold',
      '0.85',
    ]));
  });

  it('declares provider-composition improvement cases in the AgentEvals fixture set', () => {
    const cases = readCases();
    expect(cases.length).toBeGreaterThanOrEqual(10);
    expect(new Set(cases.map((testCase) => testCase.id)).size).toBe(cases.length);
    expect(cases.map((testCase) => testCase.intent)).toEqual(expect.arrayContaining([
      'providerRegistry',
      'dynamicReranking',
      'crawlerDepth',
      'webSearchFailure',
      'providerFanIn',
      'localResearchFanIn',
      'noCliRegexFallback',
      'sourceValidation',
      'configuration',
      'recoverableErrors',
    ]));
  });

  for (const evalCase of readCases()) {
    it(`passes ${evalCase.id}`, () => {
      const selectedToolIds = selectCompositeSearchAgentTools(descriptors, evalCase.task);
      const prompt = buildCompositeSearchAgentPrompt({ task: evalCase.task, descriptors });

      expect(selectedToolIds).toEqual(evalCase.expectedToolIds);
      for (const expected of evalCase.mustMention) {
        expect(prompt).toContain(expected);
      }
      for (const forbidden of evalCase.mustNotMention) {
        expect(prompt).not.toContain(forbidden);
      }
      expect(evaluateCompositeSearchAgentPolicy({ prompt, selectedToolIds }).passed).toBe(true);
    });
  }
});
