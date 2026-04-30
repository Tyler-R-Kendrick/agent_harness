import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRdfWebSearchAgentPrompt,
  evaluateRdfWebSearchAgentPolicy,
  selectRdfWebSearchAgentTools,
} from '../../src/chat-agents/SemanticSearch';
import type { ToolDescriptor } from '../../src/tools';

interface RdfWebSearchEvalCase {
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
    id: 'webmcp:semantic_search',
    label: 'Semantic search',
    description: 'Search RDF and SPARQL endpoints through checked templates.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:search_web',
    label: 'Search web',
    description: 'Search the public web for fan-in evidence.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
];

function readCases(): RdfWebSearchEvalCase[] {
  return readFileSync(path.join(__dirname, 'cases.jsonl'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RdfWebSearchEvalCase);
}

describe('rdf-web-search-agent AgentEvals', () => {
  it('declares a real AgentV/AgentEvals CLI target and npm runner', async () => {
    const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const targetsYaml = readFileSync(path.resolve(__dirname, '../../../.agentv/targets.yaml'), 'utf8');
    const evalYaml = readFileSync(path.resolve(__dirname, 'EVAL.yaml'), 'utf8');
    const {
      buildAgentvRdfSearchEvalCommand,
      buildAgentvRdfSearchEvalEnvironment,
    } = await import(pathToFileURL(path.resolve(__dirname, '../../scripts/run-agentv-rdf-search-eval.mjs')).href);
    const command = buildAgentvRdfSearchEvalCommand();

    expect(packageJson.scripts['eval:rdf-search']).toBe('node scripts/run-agentv-rdf-search-eval.mjs');
    expect(targetsYaml).toContain('name: agent-browser-rdf-web-search-agent');
    expect(targetsYaml).toContain('rdf-search-eval-target-runtime.ts');
    expect(evalYaml).toContain('mode: in_order');
    expect(evalYaml).toContain('type: code-grader');
    expect(evalYaml).toContain('./graders/rdf-search-quality-gate.mjs');
    expect(command.packageName).toBe('agentv');
    expect(command.args).toEqual(expect.arrayContaining([
      'eval',
      'run',
      'agent-browser/evals/rdf-web-search-agent/EVAL.yaml',
      '--target',
      'agent-browser-rdf-web-search-agent',
      '--threshold',
      '0.85',
    ]));
    expect(buildAgentvRdfSearchEvalEnvironment({ NODE_OPTIONS: '' }).NODE_OPTIONS).toContain('agentv-listener-budget.mjs');
  });

  it('declares at least 10 improvement cases in the AgentEvals fixture set', () => {
    const cases = readCases();
    expect(cases.length).toBeGreaterThanOrEqual(10);
    expect(new Set(cases.map((testCase) => testCase.id)).size).toBe(cases.length);
    expect(cases.map((testCase) => testCase.intent)).toEqual(expect.arrayContaining([
      'entitySearch',
      'qidFacts',
      'classInstances',
      'endpointHealth',
      'templateSafety',
      'fanIn',
      'citations',
      'recoverableErrors',
      'openDataScope',
      'configuration',
    ]));
  });

  for (const evalCase of readCases()) {
    it(`passes ${evalCase.id}`, () => {
      const selectedToolIds = selectRdfWebSearchAgentTools(descriptors, evalCase.task);
      const prompt = buildRdfWebSearchAgentPrompt({ task: evalCase.task, descriptors });

      expect(selectedToolIds).toEqual(evalCase.expectedToolIds);
      for (const expected of evalCase.mustMention) {
        expect(prompt).toContain(expected);
      }
      for (const forbidden of evalCase.mustNotMention) {
        expect(prompt).not.toContain(forbidden);
      }
      expect(evaluateRdfWebSearchAgentPolicy({ prompt, selectedToolIds }).passed).toBe(true);
    });
  }
});
