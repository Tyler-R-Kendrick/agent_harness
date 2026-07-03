import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ToolSet } from 'ai';
import { createStaticToolPlan, type ToolAgentRuntime } from '../../src/tool-agents/tool-agent';
import type { ToolDescriptor } from '../../src/tools';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const artifactDescriptor: ToolDescriptor = {
  id: 'webmcp:create_artifact',
  label: 'Create artifact',
  description: 'Create a standalone artifact with one or more files mounted under //artifacts.',
  group: 'built-in',
  groupLabel: 'Built-In',
  subGroup: 'artifacts-mcp',
  subGroupLabel: 'Artifacts',
};

const searchDescriptor: ToolDescriptor = {
  id: 'webmcp:search_web',
  label: 'Search web',
  description: 'Search the web for current external facts and local recommendations.',
  group: 'built-in',
  groupLabel: 'Built-In',
  subGroup: 'web-search-mcp',
  subGroupLabel: 'Search',
};

const runtime: ToolAgentRuntime = {
  tools: {
    [artifactDescriptor.id]: { execute: async () => ({}) },
    [searchDescriptor.id]: { execute: async () => ({}) },
  } as unknown as ToolSet,
  descriptors: [artifactDescriptor, searchDescriptor],
};

const artifactCases = [
  ['create a PDF as an artifact about onboarding', 'pdf', ['document.pdf']],
  ['generate an image as an artifact for launch', 'image', ['image.svg']],
  ['build a canvas widget artifact for planning', 'canvas-widget', ['canvas-widget/widget.json', 'canvas-widget/index.html']],
  ['write DESIGN.md as an artifact', 'design-md', ['DESIGN.md']],
  ['write AGENTS.md as an artifact', 'agents-md', ['AGENTS.md']],
  ['create an agent-skill artifact with SKILL.md references scripts and evals', 'agent-skill', ['skills/generated-skill/SKILL.md', 'skills/generated-skill/references/README.md', 'skills/generated-skill/scripts/verify.ts', 'skills/generated-skill/evals/evals.json']],
  ['generate a DOCX artifact for onboarding', 'docx', ['document.docx']],
  ['generate a PPTX artifact for roadmap', 'pptx', ['deck.pptx']],
] as const;

function artifactRelevanceScore(prompt: string, kind: string, paths: readonly string[]): number {
  const plan = createStaticToolPlan(runtime, prompt);
  const step = plan.steps[0];
  const input = step?.kind === 'call-tool' ? step.inputTemplate as {
    kind?: string;
    files?: Array<{ path: string }>;
  } : {};
  let score = 0;
  if (plan.selectedToolIds.includes('webmcp:create_artifact')) score += 0.25;
  if (plan.steps.length === 1) score += 0.25;
  if (input.kind === kind) score += 0.25;
  if (paths.every((path) => input.files?.some((file) => file.path === path))) score += 0.25;
  return score;
}

describe('artifact-generation AgentEvals relevance checks', () => {
  it('declares a real AgentV target and npm runner for artifact-generation checks', async () => {
    const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const targetsYaml = readFileSync(path.resolve(__dirname, '../../../.agentv/targets.yaml'), 'utf8');
    const evalYaml = readFileSync(path.resolve(__dirname, 'EVAL.yaml'), 'utf8');
    const evalRunner = await import(
      pathToFileURL(path.resolve(__dirname, '../../scripts/run-agentv-artifact-generation-eval.mjs')).href
    ) as {
      buildAgentvArtifactGenerationEvalCommand: () => { args: string[] };
    };

    expect(packageJson.scripts['eval:artifact-generation']).toBe('node scripts/run-agentv-artifact-generation-eval.mjs');
    expect(targetsYaml).toContain('name: agent-browser-artifact-generation');
    expect(targetsYaml).toContain('artifact-generation-eval-target-runtime.ts');
    expect(evalYaml).toContain('target: agent-browser-artifact-generation');
    expect(evalYaml).toContain('type: execution-metrics');
    expect(evalYaml).toContain('type: code-grader');
    expect(evalRunner.buildAgentvArtifactGenerationEvalCommand().args).toEqual([
      'eval',
      'run',
      'agent-browser/evals/artifact-generation/EVAL.yaml',
      '--target',
      'agent-browser-artifact-generation',
      '--output',
      'output/evals/artifact-generation-agentv',
      '--threshold',
      '1',
      '--workers',
      process.env.AGENT_BROWSER_AGENTV_WORKERS ?? '1',
    ]);
  });

  it('keeps the checked-in AgentV cases aligned with the runtime output contract', async () => {
    const runtimeModule = await import(
      pathToFileURL(path.resolve(__dirname, '../../scripts/artifact-generation-eval-target-runtime.ts')).href
    ) as {
      loadArtifactGenerationCases: () => Promise<Array<{
        expectedKind?: string;
        expectedPaths?: string[];
        expectedSelectedToolIds: string[];
        expectedStepCount: number;
        forbiddenSelectedToolIds?: string[];
        prompt: string;
        id: string;
      }>>;
      runArtifactGenerationEvalCase: (testCase: {
        expectedKind?: string;
        expectedPaths?: string[];
        expectedSelectedToolIds: string[];
        expectedStepCount: number;
        forbiddenSelectedToolIds?: string[];
        prompt: string;
        id: string;
      }) => {
        selectedToolIds: string[];
        stepCount: number;
        kind: string | null;
        filePaths: string[];
      };
    };
    const cases = await runtimeModule.loadArtifactGenerationCases();

    expect(cases).toHaveLength(9);

    for (const evalCase of cases) {
      const result = runtimeModule.runArtifactGenerationEvalCase(evalCase);
      expect(result.selectedToolIds).toEqual(evalCase.expectedSelectedToolIds);
      expect(result.stepCount).toBe(evalCase.expectedStepCount);
      if (evalCase.expectedKind) {
        expect(result.kind).toBe(evalCase.expectedKind);
      }
      if (evalCase.expectedPaths) {
        expect(result.filePaths).toEqual(expect.arrayContaining(evalCase.expectedPaths));
      }
      for (const forbiddenToolId of evalCase.forbiddenSelectedToolIds ?? []) {
        expect(result.selectedToolIds).not.toContain(forbiddenToolId);
      }
    }
  });

  for (const [prompt, kind, paths] of artifactCases) {
    it(`keeps artifact orchestration relevant for ${kind}`, () => {
      expect(artifactRelevanceScore(prompt, kind, paths)).toBe(1);
    });
  }

  it('does not leak the prior movie-theater search optimization into artifact prompts', () => {
    for (const [prompt] of artifactCases) {
      const plan = createStaticToolPlan(runtime, prompt);
      expect(JSON.stringify(plan)).not.toMatch(/movie theaters|fandango|showtimes/i);
    }
  });

  it('does not route search prompts into artifact creation', () => {
    const plan = createStaticToolPlan(runtime, "what're the best movie theaters near me?");

    expect(plan.selectedToolIds).toContain('webmcp:search_web');
    expect(plan.selectedToolIds).not.toContain('webmcp:create_artifact');
    expect(plan.steps).toEqual([]);
  });
});
