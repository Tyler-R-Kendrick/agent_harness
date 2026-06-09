import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fixtures from './fixtures.json';

type CostRoutingEvalCase = {
  id: string;
  input: string;
  criteria: string;
  expected_output: string;
  prompt: string;
  expectedModelClass: 'cheap' | 'premium';
  requiredReason?: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readCases(): CostRoutingEvalCase[] {
  return readFileSync(path.join(__dirname, 'cases.jsonl'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CostRoutingEvalCase);
}

describe('cost routing contract evals', () => {
  it('includes required quality-gate scenarios', () => {
    const ids = new Set(fixtures.cases.map((c) => c.id));
    expect(ids).toEqual(new Set([
      'simple-stays-cheap',
      'complex-upgrades',
      'security-escalates',
      'misroute-regression-guard',
    ]));
  });

  it('declares a real AgentV target and npm runner for the cost-routing suite', async () => {
    const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const targetsYaml = readFileSync(path.resolve(__dirname, '../../../.agentv/targets.yaml'), 'utf8');
    const evalYaml = readFileSync(path.resolve(__dirname, 'EVAL.yaml'), 'utf8');
    const { buildAgentvCostRoutingEvalCommand } = await import(
      pathToFileURL(path.resolve(__dirname, '../../scripts/run-agentv-cost-routing-eval.mjs')).href
    );
    const command = buildAgentvCostRoutingEvalCommand();

    expect(packageJson.scripts['eval:cost-routing']).toBe('node scripts/run-agentv-cost-routing-eval.mjs');
    expect(targetsYaml).toContain('name: agent-browser-cost-routing-contract');
    expect(targetsYaml).toContain('cost-routing-contract-eval-target-runtime.ts');
    expect(evalYaml).toContain('target: agent-browser-cost-routing-contract');
    expect(evalYaml).toContain('type: code-grader');
    expect(evalYaml).toContain('type: execution-metrics');
    expect(command.packageName).toBe('agentv');
    expect(command.args).toEqual(expect.arrayContaining([
      'eval',
      'run',
      'agent-browser/evals/cost-routing-contract/EVAL.yaml',
      '--target',
      'agent-browser-cost-routing-contract',
      '--threshold',
      '1',
    ]));
  });

  it('keeps checked-in cases aligned with the deterministic route contract', async () => {
    const { runCostRoutingEvalCase } = await import(
      pathToFileURL(path.resolve(__dirname, '../../scripts/cost-routing-contract-eval-target-runtime.ts')).href
    );
    const fixtureIds = fixtures.cases.map((entry) => entry.id);
    const evalCases = readCases();

    expect(evalCases.map((entry) => entry.id)).toEqual(fixtureIds);

    for (const evalCase of evalCases) {
      const result = runCostRoutingEvalCase(evalCase);
      expect(result.selectedModelClass).toBe(evalCase.expectedModelClass);
      if (evalCase.requiredReason) {
        expect(result.reasonSummary.toLowerCase()).toContain(evalCase.requiredReason.toLowerCase());
      }
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toBeLessThanOrEqual(250);
    }
  });
});
