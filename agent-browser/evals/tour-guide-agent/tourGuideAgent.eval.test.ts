import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import {
  buildTourGuideAgentPrompt,
  evaluateTourGuideAgentPolicy,
} from '../../src/chat-agents/TourGuide';
import {
  DEFAULT_TOUR_TARGETS,
  buildGuidedTourPlan,
} from '../../src/features/tours/driverTour';

interface TourGuideEvalCase {
  id: string;
  task: string;
  expectedTargetIds: string[];
  mustMention: string[];
  mustNotMention: string[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readCases(): TourGuideEvalCase[] {
  return readFileSync(path.join(__dirname, 'cases.jsonl'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TourGuideEvalCase);
}

describe('tour-guide-agent AgentEvals', () => {
  it('declares a real AgentV/AgentEvals CLI target and npm runner', async () => {
    const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const targetsYaml = readFileSync(path.resolve(__dirname, '../../../.agentv/targets.yaml'), 'utf8');
    const evalYaml = readFileSync(path.resolve(__dirname, 'EVAL.yaml'), 'utf8');
    const { buildAgentvTourGuideEvalCommand } = await import(
      pathToFileURL(path.resolve(__dirname, '../../scripts/run-agentv-tour-guide-eval.mjs')).href
    );
    const command = buildAgentvTourGuideEvalCommand();

    expect(packageJson.scripts['eval:tour-guide']).toBe('node scripts/run-agentv-tour-guide-eval.mjs');
    expect(targetsYaml).toContain('name: agent-browser-tour-guide-agent');
    expect(targetsYaml).toContain('tour-guide-eval-target-runtime.ts');
    expect(evalYaml).toContain('type: code-grader');
    expect(evalYaml).toContain('./graders/tour-guide-quality-gate.mjs');
    expect(command.packageName).toBe('agentv');
    expect(command.args).toEqual(expect.arrayContaining([
      'eval',
      'run',
      'agent-browser/evals/tour-guide-agent/EVAL.yaml',
      '--target',
      'agent-browser-tour-guide-agent',
      '--threshold',
      '0.85',
    ]));
  });

  for (const evalCase of readCases()) {
    it(`passes ${evalCase.id}`, () => {
      const prompt = buildTourGuideAgentPrompt({
        task: evalCase.task,
        targets: DEFAULT_TOUR_TARGETS,
        workspaceName: 'Eval',
      });
      const plan = buildGuidedTourPlan({
        request: evalCase.task,
        targets: DEFAULT_TOUR_TARGETS,
      });

      expect(plan.steps.map((step) => step.targetId)).toEqual(expect.arrayContaining(evalCase.expectedTargetIds));
      for (const expected of evalCase.mustMention) {
        expect(prompt).toContain(expected);
      }
      for (const forbidden of evalCase.mustNotMention) {
        expect(JSON.stringify(plan)).not.toContain(forbidden);
      }
      expect(evaluateTourGuideAgentPolicy({ prompt }).passed).toBe(true);
    });
  }
});
