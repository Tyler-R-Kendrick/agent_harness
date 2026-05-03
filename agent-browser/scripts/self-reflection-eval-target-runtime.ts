import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolDescriptor } from '../src/tools';
import {
  buildWorkspaceSelfReflectionAnswer,
  evaluateSelfReflectionAnswer,
} from '../src/services/selfReflection';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const casesPath = path.join(appRoot, 'evals/workspace-self-reflection-agent/cases.jsonl');

type EvalCase = {
  id: string;
  task: string;
  availableToolIds: string[];
  emptyWorkspace?: boolean;
};

type EvalToolCall = {
  id: string;
  tool: string;
  input: unknown;
  output: unknown;
  timestamp: string;
  duration_ms: number;
};

const SAMPLE_WORKSPACE_CONTEXT = [
  'Workspace capability files loaded from browser storage:',
  'Workspace memory files loaded from .memory/:',
  '- [project] Use TDD and verify changes. (.memory/project.memory.md:3)',
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

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadCases(): Promise<EvalCase[]> {
  const content = await readFile(casesPath, 'utf8');
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as EvalCase);
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
        description: 'Search local SearXNG, extract pages, rank evidence, return citations, and handle current external facts.',
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

function runCase(testCase: EvalCase): { content: string; toolCalls: EvalToolCall[] } {
  const workspacePromptContext = testCase.emptyWorkspace
    ? 'No workspace capability files are currently stored.'
    : SAMPLE_WORKSPACE_CONTEXT;
  const toolDescriptors = testCase.availableToolIds.map(descriptorFor);
  const answer = buildWorkspaceSelfReflectionAnswer({
    task: testCase.task,
    workspaceName: 'Research',
    workspacePromptContext,
    toolDescriptors,
  });
  const evaluation = evaluateSelfReflectionAnswer({
    task: testCase.task,
    answer,
    workspacePromptContext,
    toolDescriptors,
  });
  const timestamp = new Date(0).toISOString();
  const toolCalls: EvalToolCall[] = [
    {
      id: 'call-1',
      tool: 'workspace-self-inventory',
      input: { task: testCase.task },
      output: {
        workspacePromptContext,
        toolDescriptors,
        evaluation,
      },
      timestamp,
      duration_ms: 1,
    },
  ];
  return { content: answer, toolCalls };
}

const evalId = argValue('--eval-id');
const outputFile = argValue('--out') ?? argValue('--output');

if (!evalId || !outputFile) {
  throw new Error('self-reflection-eval-target requires --eval-id and --out.');
}

const cases = await loadCases();
const testCase = cases.find((candidate) => candidate.id === evalId);
if (!testCase) {
  throw new Error(`No self-reflection eval case found for ${evalId}.`);
}

const result = runCase(testCase);
await writeFile(outputFile, JSON.stringify({
  output: [{
    role: 'assistant',
    content: result.content,
    tool_calls: result.toolCalls,
  }],
  duration_ms: result.toolCalls.length,
  token_usage: { input: 50, output: Math.max(1, result.content.length), cached: 0 },
}, null, 2));
