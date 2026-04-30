import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildLocalWebResearchAgentPrompt,
  evaluateLocalWebResearchAgentPolicy,
  selectLocalWebResearchAgentTools,
} from '../../src/chat-agents/LocalWebResearch';
import type { ToolDescriptor } from '../../src/tools';

interface LocalWebResearchEvalCase {
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
    id: 'webmcp:local_web_research',
    label: 'Local web research',
    description: 'Search local SearXNG, extract pages, rank evidence, and return citations.',
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

function readCases(): LocalWebResearchEvalCase[] {
  return readFileSync(path.join(__dirname, 'cases.jsonl'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LocalWebResearchEvalCase);
}

describe('local-web-research-agent AgentEvals', () => {
  it('declares a real AgentV/AgentEvals CLI target and npm runner', async () => {
    const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const targetsYaml = readFileSync(path.resolve(__dirname, '../../../.agentv/targets.yaml'), 'utf8');
    const evalYaml = readFileSync(path.resolve(__dirname, 'EVAL.yaml'), 'utf8');
    const { buildAgentvLocalWebResearchEvalCommand } = await import(
      pathToFileURL(path.resolve(__dirname, '../../scripts/run-agentv-local-web-research-eval.mjs')).href
    );
    const command = buildAgentvLocalWebResearchEvalCommand();

    expect(packageJson.scripts['eval:local-web-research']).toBe('node scripts/run-agentv-local-web-research-eval.mjs');
    expect(targetsYaml).toContain('name: agent-browser-local-web-research-agent');
    expect(targetsYaml).toContain('local-web-research-eval-target-runtime.ts');
    expect(evalYaml).toContain('mode: in_order');
    expect(evalYaml).toContain('type: code-grader');
    expect(evalYaml).toContain('./graders/local-search-quality-gate.mjs');
    expect(command.packageName).toBe('agentv');
    expect(command.args).toEqual(expect.arrayContaining([
      'eval',
      'run',
      'agent-browser/evals/local-web-research-agent/EVAL.yaml',
      '--target',
      'agent-browser-local-web-research-agent',
      '--threshold',
      '0.85',
    ]));
  });

  it('declares at least 10 improvement cases in the AgentEvals fixture set', () => {
    const cases = readCases();
    expect(cases.length).toBeGreaterThanOrEqual(10);
    expect(new Set(cases.map((testCase) => testCase.id)).size).toBe(cases.length);
    expect(cases.map((testCase) => testCase.intent)).toEqual(expect.arrayContaining([
      'localResearch',
      'recoverableErrors',
      'optionalSynthesis',
      'fanIn',
      'safety',
      'ranking',
      'planning',
      'serviceFailure',
      'configuration',
      'citations',
    ]));
  });

  for (const evalCase of readCases()) {
    it(`passes ${evalCase.id}`, () => {
      const selectedToolIds = selectLocalWebResearchAgentTools(descriptors, evalCase.task);
      const prompt = buildLocalWebResearchAgentPrompt({ task: evalCase.task, descriptors });

      expect(selectedToolIds).toEqual(evalCase.expectedToolIds);
      for (const expected of evalCase.mustMention) {
        expect(prompt).toContain(expected);
      }
      for (const forbidden of evalCase.mustNotMention) {
        expect(prompt).not.toContain(forbidden);
      }
      expect(evaluateLocalWebResearchAgentPolicy({ prompt, selectedToolIds }).passed).toBe(true);
    });
  }
});
