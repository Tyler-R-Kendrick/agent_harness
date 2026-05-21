import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

interface CodiGeneralChatEvalCase {
  id: string;
  scenarioCategory: string;
  task: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  scriptedAnswers: string[];
  registeredTools?: Array<{ id: string; output: string; failureOutput?: string }>;
  expected_output: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readCases(): CodiGeneralChatEvalCase[] {
  return readFileSync(path.join(__dirname, 'cases.jsonl'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CodiGeneralChatEvalCase);
}

describe('Codi general chat AgentV autoevals', () => {
  it('declares a real AgentV target, autoevals grader, npm runners, and verifier gate', async () => {
    const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const targetsYaml = readFileSync(path.resolve(__dirname, '../../../.agentv/targets.yaml'), 'utf8');
    const evalYaml = readFileSync(path.resolve(__dirname, 'EVAL.yaml'), 'utf8');
    const grader = readFileSync(path.resolve(__dirname, 'graders/codi-general-autoevals-gate.mjs'), 'utf8');
    const verifyScript = readFileSync(path.resolve(__dirname, '../../../scripts/verify-agent-browser.ps1'), 'utf8');
    const { buildAgentvCodiGeneralEvalCommand } = await import(
      pathToFileURL(path.resolve(__dirname, '../../scripts/run-agentv-codi-general-eval.mjs')).href
    );
    const command = buildAgentvCodiGeneralEvalCommand();

    expect(packageJson.devDependencies.autoevals).toBeDefined();
    expect(packageJson.scripts['eval:codi-general']).toBe('node scripts/run-agentv-codi-general-eval.mjs');
    expect(packageJson.scripts['eval:chat-loop']).toContain('eval:codi-general');
    expect(targetsYaml).toContain('name: agent-browser-codi-general-chat');
    expect(targetsYaml).toContain('codi-general-eval-target-runtime.ts');
    expect(evalYaml).toContain('type: code-grader');
    expect(evalYaml).toContain('./graders/codi-general-autoevals-gate.mjs');
    expect(grader).toContain('autoevals');
    expect(command.packageName).toBe('agentv');
    expect(command.args).toEqual(expect.arrayContaining([
      'eval',
      'run',
      'agent-browser/evals/codi-general-chat/EVAL.yaml',
      '--target',
      'agent-browser-codi-general-chat',
      '--threshold',
      '1',
    ]));
    expect(verifyScript).toContain("Label = 'chat-loop-evals'");
  });

  it('keeps general autoeval scenarios checked in with explicit expected outputs', () => {
    const cases = readCases();
    expect(cases.map((testCase) => testCase.id)).toEqual([
      'closed-qa-capital',
      'json-status-contract',
      'instruction-following-one-line',
      'execution-loop-completion',
      'agent-bus-voter-approval',
      'multi-turn-pronoun-reference',
      'multi-turn-format-switch',
      'registered-tool-file-read',
      'registered-tool-no-false-refusal',
      'registered-tool-failure-recovery',
    ]);
    expect(new Set(cases.map((testCase) => testCase.scenarioCategory)).size).toBe(cases.length);

    for (const testCase of cases) {
      expect(testCase.task.trim().length).toBeGreaterThan(0);
      expect(testCase.scriptedAnswers.length).toBeGreaterThan(0);
      const expected = JSON.parse(testCase.expected_output) as {
        autoevalScorer: string;
        expected: unknown;
        requiresAgentBus: boolean;
        requiredBusTypes?: string[];
      };
      expect(expected.autoevalScorer).toMatch(/^(ExactMatch|Levenshtein|JSONDiff)$/);
      expect(expected.expected).toBeDefined();
      expect(expected.requiresAgentBus).toBe(true);
      expect(expected.requiredBusTypes).toEqual(expect.arrayContaining(['Mail', 'InfIn', 'InfOut', 'Intent', 'Commit', 'Result']));
      if (testCase.registeredTools?.length) {
        expect(testCase.task).toMatch(/tool|registered/i);
        expect(expected.requiredBusTypes).toContain('Result');
      }
    }
  });
});
