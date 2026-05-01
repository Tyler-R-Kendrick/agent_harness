import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import type { ToolDescriptor } from '../../src/tools';
import {
  buildWorkspaceSelfReflectionAnswer,
  evaluateSelfReflectionAnswer,
} from '../../src/services/selfReflection';

interface WorkspaceSelfReflectionEvalCase {
  id: string;
  task: string;
  availableToolIds: string[];
  emptyWorkspace?: boolean;
  mustMention: string[];
  mustNotMention: string[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SAMPLE_WORKSPACE_CONTEXT = [
  'Workspace capability files loaded from browser storage:',
  'Active AGENTS.md:',
  '- AGENTS.md',
  '# Workspace rules',
  'Use TDD and verify changes.',
  '',
  'Skills:',
  '- memory (.agents/skills/memory/SKILL.md): Recall and store durable workspace memory.',
  '- create-agent-eval (.agents/skills/create-agent-eval/SKILL.md): Create repeatable AgentEvals suites.',
  '',
  'Tools:',
  '- review-pr (.agents/tools/review-pr/tool.json)',
  '',
  'Plugins:',
  '- review-tools (.agents/plugins/review-tools/plugin.yaml)',
  '',
  'Hooks:',
  '- pre-task.sh (.agents/hooks/pre-task.sh)',
].join('\n');

function readCases(): WorkspaceSelfReflectionEvalCase[] {
  return readFileSync(path.join(__dirname, 'cases.jsonl'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as WorkspaceSelfReflectionEvalCase);
}

function descriptorFor(toolId: string): ToolDescriptor {
  switch (toolId) {
    case 'cli':
      return {
        id: toolId,
        label: 'CLI',
        description: 'Run shell commands in the active workspace terminal session.',
        group: 'built-in',
        groupLabel: 'Built-In',
      };
    case 'webmcp:local_web_research':
      return {
        id: toolId,
        label: 'Local web research',
        description: 'Search local SearXNG, extract pages, rank evidence, and return citations for current external facts.',
        group: 'web-search-mcp',
        groupLabel: 'Web Search',
      };
    case 'read_session_file':
      return {
        id: toolId,
        label: 'Read session file',
        description: 'Read a file from the active session filesystem.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'files-worktree-mcp',
        subGroupLabel: 'Files',
      };
    default:
      return {
        id: toolId,
        label: toolId,
        description: 'Registered runtime tool.',
        group: 'built-in',
        groupLabel: 'Built-In',
      };
  }
}

describe('workspace-self-reflection-agent AgentEvals', () => {
  it('declares a real AgentV target, code grader, and npm runner', async () => {
    const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const targetsYaml = readFileSync(path.resolve(__dirname, '../../../.agentv/targets.yaml'), 'utf8');
    const evalYaml = readFileSync(path.resolve(__dirname, 'EVAL.yaml'), 'utf8');
    const { buildAgentvSelfReflectionEvalCommand } = await import(
      pathToFileURL(path.resolve(__dirname, '../../scripts/run-agentv-self-reflection-eval.mjs')).href
    );
    const command = buildAgentvSelfReflectionEvalCommand();

    expect(packageJson.scripts['eval:self-reflection']).toBe('node scripts/run-agentv-self-reflection-eval.mjs');
    expect(targetsYaml).toContain('name: agent-browser-workspace-self-reflection-agent');
    expect(targetsYaml).toContain('self-reflection-eval-target-runtime.ts');
    expect(evalYaml).toContain('type: code-grader');
    expect(evalYaml).toContain('./graders/self-reflection-quality-gate.mjs');
    expect(command.packageName).toBe('agentv');
    expect(command.args).toEqual(expect.arrayContaining([
      'eval',
      'run',
      'agent-browser/evals/workspace-self-reflection-agent/EVAL.yaml',
      '--target',
      'agent-browser-workspace-self-reflection-agent',
      '--threshold',
      '0.9',
    ]));
  });

  for (const evalCase of readCases()) {
    it(`passes ${evalCase.id}`, () => {
      const toolDescriptors = evalCase.availableToolIds.map(descriptorFor);
      const workspacePromptContext = evalCase.emptyWorkspace
        ? 'No workspace capability files are currently stored.'
        : SAMPLE_WORKSPACE_CONTEXT;
      const answer = buildWorkspaceSelfReflectionAnswer({
        task: evalCase.task,
        workspaceName: 'Research',
        workspacePromptContext,
        toolDescriptors,
      });
      const evaluation = evaluateSelfReflectionAnswer({
        task: evalCase.task,
        answer,
        workspacePromptContext,
        toolDescriptors,
      });

      for (const expected of evalCase.mustMention) {
        expect(answer).toContain(expected);
      }
      for (const forbidden of evalCase.mustNotMention) {
        expect(answer.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
      expect(evaluation.passed).toBe(true);
    });
  }
});
