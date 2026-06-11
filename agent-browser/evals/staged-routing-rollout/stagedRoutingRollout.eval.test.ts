import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

interface StagedRoutingRolloutEvalCase {
  id: string;
  prompt: string;
  provider: string;
  toolsEnabled: boolean;
  objective: string;
  expectedTaskClass: string;
  expectedBenchmarkRef: string;
  expectedRouteRef: string;
  expectedModelClass: 'cheap' | 'premium';
  expectedOverrideApplied: boolean;
  expectedReasonIncludes: string[];
  requiresPolicyInvariants?: boolean;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readCases(): StagedRoutingRolloutEvalCase[] {
  return readFileSync(path.join(__dirname, 'cases.jsonl'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as StagedRoutingRolloutEvalCase);
}

describe('staged routing rollout fixtures', () => {
  it('declares a real AgentV target and npm runner for staged routing rollout checks', async () => {
    const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const targetsYaml = readFileSync(path.resolve(__dirname, '../../../.agentv/targets.yaml'), 'utf8');
    const evalYaml = readFileSync(path.resolve(__dirname, 'EVAL.yaml'), 'utf8');
    const { buildAgentvStagedRoutingRolloutEvalCommand } = await import(
      pathToFileURL(path.resolve(__dirname, '../../scripts/run-agentv-staged-routing-rollout-eval.mjs')).href
    );
    const command = buildAgentvStagedRoutingRolloutEvalCommand();

    expect(packageJson.scripts['eval:staged-routing-rollout']).toBe('node scripts/run-agentv-staged-routing-rollout-eval.mjs');
    expect(targetsYaml).toContain('name: agent-browser-staged-routing-rollout');
    expect(targetsYaml).toContain('staged-routing-rollout-eval-target-runtime.ts');
    expect(evalYaml).toContain('target: agent-browser-staged-routing-rollout');
    expect(evalYaml).toContain('type: tool-trajectory');
    expect(evalYaml).toContain('type: code-grader');
    expect(command.packageName).toBe('agentv');
    expect(command.args).toEqual(expect.arrayContaining([
      'eval',
      'run',
      'agent-browser/evals/staged-routing-rollout/EVAL.yaml',
      '--target',
      'agent-browser-staged-routing-rollout',
      '--threshold',
      '1',
    ]));
  });

  it('covers misroute prevention, cost win, and policy invariants', () => {
    const ids = new Set(readCases().map((entry) => entry.id));
    expect(ids).toEqual(new Set([
      'misroute-prevention-complex',
      'misroute-prevention-escalation',
      'cost-win-simple',
      'policy-invariants',
    ]));
  });

  for (const evalCase of readCases()) {
    it(`passes ${evalCase.id}`, async () => {
      const { runStagedRoutingRolloutEvalCase } = await import(
        pathToFileURL(path.resolve(__dirname, '../../scripts/staged-routing-rollout-eval-target-runtime.ts')).href
      );
      const result = runStagedRoutingRolloutEvalCase(evalCase);
      const toolNames = result.toolCalls.map((call: { tool: string }) => call.tool);
      const answer = result.content;

      expect(toolNames).toEqual([
        'request-complexity-router',
        'benchmark-objective-router',
        'routing-policy-guard',
        'final-route-decision',
      ]);
      expect(answer).toContain(`Task class: ${evalCase.expectedTaskClass}`);
      expect(answer).toContain(`Benchmark route: ${evalCase.expectedBenchmarkRef}`);
      expect(answer).toContain(`Final route: ${evalCase.expectedRouteRef}`);
      expect(answer).toContain(`Final model class: ${evalCase.expectedModelClass}`);
      for (const phrase of evalCase.expectedReasonIncludes) {
        expect(answer).toContain(phrase);
      }
      if (evalCase.requiresPolicyInvariants) {
        expect(answer).toContain('Objective-weighted routes stay active when no premium-safe override triggers.');
        expect(answer).toContain('Security, critical, or low-confidence prompts escalate to a premium-safe candidate set.');
        expect(answer).toContain('Enforce mode only activates after staged rollout eval coverage passes.');
      }
    });
  }
});
