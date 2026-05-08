import { describe, expect, it, vi } from 'vitest';
import { BrowserLeanChecker } from '../checkers/leanChecker';
import {
  agentResultSchema,
  createEmptySummaryState,
  formalClaimSchema,
  reasoningTraceSchema,
  taskInputSchema,
  type ReasoningTrace,
  type TaskInput,
} from '../schemas';
import {
  JsonPromptValidationModel,
  type LocalValidationModel,
  type RepairRegionInput,
} from '../modules';
import {
  aggregateAttemptsPrompt,
  critiqueStepPrompt,
  critiqueTracePrompt,
  formalizeClaimPrompt,
  gateAnswerPrompt,
  generateTracePrompt,
  repairRegionPrompt,
} from '../prompts';
import { extractFirstJsonObject, parseModelJson, stringifyForPrompt } from '../json';
import {
  applyUpdatedClaims,
  regionImproved,
  spliceRepairedSteps,
} from '../repair';
import {
  formatLeanDiagnostics,
  hasLeanErrors,
  normalizeLeanDiagnostic,
} from '../lean/diagnostics';
import { createLeanServer, type BrowserLeanServer } from '../lean/createLeanServer';
import { createArtifactStore } from '../storage/artifactStore';
import { runAgentBrowser } from '../agent';
import {
  collectCheckerFeedback,
  findFailingRegions,
  hasUnresolvedCriticalFailures,
  updateSummaryState,
} from '../summary';
import { FakeLeanChecker } from '../testing/fakeLeanChecker';
import { StubValidationModel } from '../testing/stubValidationModel';

const task: TaskInput = {
  task_id: 'task-1',
  goal: 'Validate that forall n : Nat, n + 0 = n.',
  context: { source: 'unit' },
  constraints: ['local only'],
  evidence: [{ id: 'e1' }],
  require_formal_proof: true,
  require_symbolic_checking: false,
  max_iterations: 1,
  max_branches: 1,
};

function makeTrace(): ReasoningTrace {
  return new StubValidationModel().makeTrace(task);
}

describe('schema validators', () => {
  it('parses valid values and reports invalid values through safeParse', () => {
    const trace = makeTrace();
    const result = {
      task_id: task.task_id,
      final_answer: 'ok',
      verification_status: 'soft_verified' as const,
      accepted_steps: [],
      failed_steps: [],
      checker_artifacts: [],
      repair_history: [],
      summary_state: createEmptySummaryState(),
    };

    expect(taskInputSchema.parse(task)).toBe(task);
    expect(reasoningTraceSchema.parse(trace)).toBe(trace);
    expect(formalClaimSchema.parse({
      claim_id: 'c',
      source_step_id: 's',
      claim_text: 'x',
      formalization_target: 'none',
    })).toMatchObject({ claim_id: 'c' });
    expect(agentResultSchema.parse(result)).toBe(result);
    expect(taskInputSchema.safeParse({})).toMatchObject({ success: false });
    expect(createEmptySummaryState()).toEqual({
      accepted_facts: [],
      open_obligations: [],
      failed_regions: [],
      best_partial_solutions: [],
      abandoned_paths: [],
    });
  });
});

describe('JSON and prompt helpers', () => {
  it('extracts nested JSON objects and rejects malformed text safely', () => {
    expect(extractFirstJsonObject('prefix {"a":{"b":"} ok"}} suffix')).toEqual({ a: { b: '} ok' } });
    expect(extractFirstJsonObject('prefix {"quote":"\\"","slash":"\\\\"} suffix')).toEqual({ quote: '"', slash: '\\' });
    expect(extractFirstJsonObject('no json')).toBeNull();
    expect(extractFirstJsonObject('{"unterminated": true')).toBeNull();
    expect(parseModelJson('noise {"ok":true}', { parse: (value) => value as { ok: boolean } })).toEqual({ ok: true });
    expect(parseModelJson('{"ok":false}', { parse: () => { throw new Error('invalid'); } })).toBeNull();
    expect(parseModelJson('bad', { parse: () => ({ ok: true }) })).toBeNull();
    expect(stringifyForPrompt({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it('builds strict prompts for every model operation', () => {
    const trace = makeTrace();
    const step = trace.steps[0];
    const repairInput: RepairRegionInput = {
      failed_steps: [step],
      accepted_steps: [],
      assumptions: [],
      checker_feedback: [],
      summary_state: trace.summary_state,
      local_objective: 'fix step',
    };

    for (const prompt of [
      generateTracePrompt(task),
      critiqueStepPrompt(step, [], []),
      critiqueTracePrompt(trace),
      formalizeClaimPrompt(step, task.goal),
      repairRegionPrompt(repairInput),
      aggregateAttemptsPrompt([trace], trace.summary_state),
      gateAnswerPrompt(trace, trace.summary_state),
    ]) {
      expect(prompt).toContain('Return one JSON object only.');
      expect(prompt).not.toContain('```');
    }
  });
});

describe('JsonPromptValidationModel', () => {
  it('parses valid model JSON and retries invalid trace output once', async () => {
    const trace = makeTrace();
    const generateText = vi
      .fn()
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce(JSON.stringify(trace));
    const model = new JsonPromptValidationModel(generateText);

    await expect(model.generateTrace(task)).resolves.toMatchObject({ task_id: task.task_id });
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it('returns valid trace JSON without repair when the first response parses', async () => {
    const trace = makeTrace();
    const generateText = vi.fn(async () => JSON.stringify(trace));
    const model = new JsonPromptValidationModel(generateText);

    await expect(model.generateTrace(task)).resolves.toMatchObject({ task_id: task.task_id });
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('returns conservative fallbacks for malformed model operations', async () => {
    const model = new JsonPromptValidationModel(async () => 'not json');
    const trace = makeTrace();
    const step = trace.steps[0];

    await expect(model.generateTrace(task)).resolves.toMatchObject({
      summary_state: { open_obligations: ['Model failed to produce a valid trace.'] },
    });
    await expect(model.critiqueStep(step, [], [])).resolves.toEqual([]);
    await expect(model.critiqueTrace(trace)).resolves.toEqual({ global_issues: [], open_obligations: [] });
    await expect(model.formalizeClaim(step, task.goal)).resolves.toMatchObject({ formalization_target: 'none' });
    await expect(model.repairRegion({
      failed_steps: [step],
      accepted_steps: [],
      assumptions: [],
      checker_feedback: [],
      summary_state: trace.summary_state,
      local_objective: 'repair',
    })).resolves.toMatchObject({ local_justification: 'Repair unavailable.' });
    await expect(model.aggregateAttempts([], trace.summary_state)).resolves.toMatchObject({ task_id: 'unknown' });
    await expect(model.gateAnswer(trace, trace.summary_state)).resolves.toMatchObject({
      verification_status: 'unverified',
    });
  });

  it('handles structurally invalid JSON objects for operation-specific parsers', async () => {
    const trace = makeTrace();
    const step = trace.steps[0];
    const model = new JsonPromptValidationModel(async () => '{"unexpected":true}');

    await expect(model.critiqueStep(step, [], [])).resolves.toEqual([]);
    await expect(model.repairRegion({
      failed_steps: [step],
      accepted_steps: [],
      assumptions: [],
      checker_feedback: [],
      summary_state: trace.summary_state,
      local_objective: 'repair',
    })).resolves.toMatchObject({ local_justification: 'Repair unavailable.' });
    await expect(model.gateAnswer(trace, trace.summary_state)).resolves.toMatchObject({
      rationale: 'Model gate returned invalid JSON.',
    });
  });

  it('parses critique, repair, aggregate, and gate responses', async () => {
    const trace = makeTrace();
    const step = trace.steps[0];
    const responses = [
      JSON.stringify({ critique_labels: [{ label: 'missing_premise', severity: 'low', rationale: 'needs source' }] }),
      JSON.stringify({ global_issues: [], open_obligations: ['prove claim'] }),
      JSON.stringify({
        claim_id: 'claim-step-1',
        source_step_id: 'step-1',
        claim_text: step.text,
        formalization_target: 'lean',
      }),
      JSON.stringify({ repaired_steps: [step], updated_formal_claims: [], local_justification: 'ok' }),
      JSON.stringify(trace),
      JSON.stringify({ final_answer: 'done', verification_status: 'soft_verified' }),
    ];
    const model = new JsonPromptValidationModel(async () => responses.shift() ?? '{}');

    await expect(model.critiqueStep(step, [], [])).resolves.toHaveLength(1);
    await expect(model.critiqueTrace(trace)).resolves.toMatchObject({ open_obligations: ['prove claim'] });
    await expect(model.formalizeClaim(step, task.goal)).resolves.toMatchObject({ formalization_target: 'lean' });
    await expect(model.repairRegion({
      failed_steps: [step],
      accepted_steps: [],
      assumptions: [],
      checker_feedback: [],
      summary_state: trace.summary_state,
      local_objective: 'repair',
    })).resolves.toMatchObject({ local_justification: 'ok' });
    await expect(model.aggregateAttempts([trace], trace.summary_state)).resolves.toMatchObject({ task_id: trace.task_id });
    await expect(model.gateAnswer(trace, trace.summary_state)).resolves.toMatchObject({ final_answer: 'done' });
  });

  it('normalizes optional arrays and rationale values in model responses', async () => {
    const trace = makeTrace();
    const step = trace.steps[0];
    const responses = [
      JSON.stringify({ global_issues: 'bad', open_obligations: 'bad' }),
      JSON.stringify({ repaired_steps: [step], updated_formal_claims: [] }),
      JSON.stringify({ final_answer: 'done', verification_status: 'soft_verified', rationale: 'ok' }),
      JSON.stringify({ final_answer: 'done', verification_status: 'soft_verified', rationale: 42 }),
    ];
    const model = new JsonPromptValidationModel(async () => responses.shift() ?? '{}');

    await expect(model.critiqueTrace(trace)).resolves.toEqual({ global_issues: [], open_obligations: [] });
    await expect(model.repairRegion({
      failed_steps: [step],
      accepted_steps: [],
      assumptions: [],
      checker_feedback: [],
      summary_state: trace.summary_state,
      local_objective: 'repair',
    })).resolves.toMatchObject({ local_justification: '' });
    await expect(model.gateAnswer(trace, trace.summary_state)).resolves.toMatchObject({ rationale: 'ok' });
    await expect(model.gateAnswer(trace, trace.summary_state)).resolves.toMatchObject({ rationale: '' });
  });

  it('falls back to the first partial trace when aggregate JSON is invalid', async () => {
    const trace = makeTrace();
    const model = new JsonPromptValidationModel(async () => '{"unexpected":true}');

    await expect(model.aggregateAttempts([trace], trace.summary_state)).resolves.toBe(trace);
  });
});

describe('Lean diagnostics, server, and checker', () => {
  it('normalizes diagnostics and formats errors', () => {
    const error = normalizeLeanDiagnostic({ severity: 'error', message: 'bad', fileName: 'x.lean', startLine: 1 });
    const warning = normalizeLeanDiagnostic({ type: 'warning', text: 'careful' });
    const positioned = normalizeLeanDiagnostic({
      severity: 'information',
      message: 'note',
      startColumn: 2,
      endLine: 3,
      endColumn: 4,
    });
    const info = normalizeLeanDiagnostic({});

    expect(normalizeLeanDiagnostic('panic')).toMatchObject({ severity: 'error', message: 'panic' });
    expect(normalizeLeanDiagnostic(null)).toMatchObject({ severity: 'information' });
    expect(info).toMatchObject({ severity: 'information', message: 'Lean diagnostic' });
    expect(error).toMatchObject({ severity: 'error', fileName: 'x.lean', startLine: 1 });
    expect(positioned).toMatchObject({ startColumn: 2, endLine: 3, endColumn: 4 });
    expect(warning).toMatchObject({ severity: 'warning', message: 'careful' });
    expect(hasLeanErrors([warning])).toBe(false);
    expect(hasLeanErrors([warning, error])).toBe(true);
    expect(formatLeanDiagnostics([])).toBe('No Lean diagnostics.');
    expect(formatLeanDiagnostics([error])).toBe('error: bad');
  });

  it('creates an explicit server and reports missing worker support at connect time', async () => {
    const originalWorker = globalThis.Worker;
    vi.stubGlobal('Worker', undefined);
    const missingWorkerServer = await createLeanServer({ baseUrl: '/lean-test' });

    await expect(missingWorkerServer.connect()).rejects.toThrow('Lean browser worker unavailable for /lean-test.');

    vi.stubGlobal('Worker', class Worker {});
    const server = await createLeanServer();
    await expect(server.connect()).resolves.toBeUndefined();
    await expect(server.getDiagnostics('missing.lean')).resolves.toMatchObject([{ severity: 'error' }]);
    await server.sync('ok.lean', 'theorem x : True := by trivial');
    await expect(server.getDiagnostics('ok.lean')).resolves.toEqual([]);
    await server.dispose();
    vi.stubGlobal('Worker', originalWorker);
  });

  it('checks Lean claims and safely maps failures to unknown', async () => {
    const claim = {
      claim_id: 'claim-1',
      source_step_id: 'step-1',
      claim_text: 'x',
      formalization_target: 'lean' as const,
      formal_expression: 'True',
      proof: 'by trivial',
    };
    const passingServer: BrowserLeanServer = {
      async connect() {},
      async sync() {},
      async getDiagnostics() { return []; },
      async dispose() {},
    };
    const failingServer: BrowserLeanServer = {
      async connect() {},
      async sync() {},
      async getDiagnostics() { return [{ severity: 'error', message: 'bad' }]; },
      async dispose() {},
    };
    const throwingServer: BrowserLeanServer = {
      async connect() {},
      async sync() { throw new Error('assets missing'); },
      async getDiagnostics() { return []; },
      async dispose() {},
    };
    const stringThrowingServer: BrowserLeanServer = {
      async connect() {},
      async sync() { throw 'worker panic'; },
      async getDiagnostics() { return []; },
      async dispose() {},
    };

    await expect(new BrowserLeanChecker(passingServer).check(claim)).resolves.toMatchObject({ status: 'passed' });
    await expect(new BrowserLeanChecker(failingServer).check(claim)).resolves.toMatchObject({ status: 'failed' });
    await expect(new BrowserLeanChecker(throwingServer).check(claim)).resolves.toMatchObject({ status: 'unknown' });
    await expect(new BrowserLeanChecker(stringThrowingServer).check(claim)).resolves.toMatchObject({
      status: 'unknown',
      message: 'worker panic',
    });
    await expect(new BrowserLeanChecker(passingServer).check({ ...claim, formalization_target: 'none' })).resolves.toMatchObject({ status: 'unknown' });
    await expect(new BrowserLeanChecker(passingServer).check({ ...claim, formal_expression: undefined })).resolves.toMatchObject({ status: 'unknown' });
  });
});

describe('repair helpers and storage', () => {
  it('splices repaired steps, updates claims, and detects improvement', () => {
    const trace = makeTrace();
    const failed = { ...trace.steps[0], status: 'failed' as const };
    const kept = { ...trace.steps[0], step_id: 'step-2', text: 'kept' };
    const repaired = { ...failed, text: 'fixed', status: 'repaired' as const };
    const spliced = spliceRepairedSteps({ ...trace, steps: [failed, kept] }, [failed], [repaired]);

    expect(spliced.steps).toEqual([repaired, kept]);
    expect(applyUpdatedClaims(trace, [])).toBe(trace);
    expect(applyUpdatedClaims({ ...trace, formal_claims: [{ claim_id: 'old', source_step_id: 'step-1', claim_text: 'old', formalization_target: 'none' }] }, [
      { claim_id: 'old', source_step_id: 'step-1', claim_text: 'new', formalization_target: 'none' },
      { claim_id: 'new', source_step_id: 'step-1', claim_text: 'new', formalization_target: 'none' },
    ]).formal_claims.map((claim) => claim.claim_text)).toEqual(['new', 'new']);
    expect(applyUpdatedClaims({ ...trace, formal_claims: [{ claim_id: 'old', source_step_id: 'step-1', claim_text: 'old', formalization_target: 'none' }] }, [
      { claim_id: 'new', source_step_id: 'step-1', claim_text: 'new', formalization_target: 'none' },
    ]).formal_claims.map((claim) => claim.claim_text)).toEqual(['old', 'new']);
    expect(regionImproved({ ...trace, steps: [failed] }, { ...trace, steps: [repaired] }, failed)).toBe(true);
    expect(regionImproved({ ...trace, steps: [failed] }, { ...trace, steps: [failed] }, failed)).toBe(false);
    expect(regionImproved({ ...trace, steps: [] }, { ...trace, steps: [repaired] }, failed)).toBe(false);
    expect(regionImproved({ ...trace, steps: [failed] }, { ...trace, steps: [] }, failed)).toBe(false);
  });

  it('stores artifacts only after explicit creation', async () => {
    const store = await createArtifactStore();
    const trace = makeTrace();
    const result = {
      task_id: task.task_id,
      final_answer: 'ok',
      verification_status: 'soft_verified' as const,
      accepted_steps: [],
      failed_steps: [],
      checker_artifacts: [],
      repair_history: [],
      summary_state: trace.summary_state,
    };

    await store.saveTask(task);
    await store.saveTrace(trace);
    await store.saveCheckerArtifact(task.task_id, { status: 'passed' });
    await store.saveResult(result);
    await expect(store.loadResult(task.task_id)).resolves.toEqual(result);
    await expect(store.loadResult('missing')).resolves.toBeNull();
  });
});

describe('agent edge paths', () => {
  it('summarizes critical failures, unknown checks, discarded paths, and checker feedback', () => {
    const trace = makeTrace();
    const failed = {
      ...trace.steps[0],
      status: 'discarded' as const,
      critique_labels: [{ label: 'contradiction', severity: 'high', rationale: 'bad' }] as const,
      checker_results: [
        { checker_type: 'lean', status: 'unknown', message: 'asset missing' },
        { checker_type: 'lean', status: 'passed', message: 'ok' },
      ] as const,
    };
    const nextTrace = {
      ...trace,
      steps: [failed],
      formal_claims: [
        { claim_id: 'manual', source_step_id: failed.step_id, claim_text: failed.text, formalization_target: 'none' as const },
      ],
    };

    expect(findFailingRegions(nextTrace)).toEqual([failed]);
    expect(hasUnresolvedCriticalFailures(nextTrace)).toBe(true);
    expect(collectCheckerFeedback(failed)).toHaveLength(1);
    expect(updateSummaryState(nextTrace)).toMatchObject({
      open_obligations: [
        'Lean check unknown for step-1: asset missing',
        `Unformalized claim manual: ${failed.text}`,
      ],
      abandoned_paths: [failed.text],
    });
    expect(hasUnresolvedCriticalFailures({ ...nextTrace, steps: [{ ...failed, status: 'accepted', critique_labels: [], checker_results: [] }] })).toBe(false);
  });

  it('uses non-formal fallbacks for plain-text stub claims', async () => {
    const step = { ...makeTrace().steps[0], text: 'This is an empirical observation.' };

    await expect(new StubValidationModel().formalizeClaim(step)).resolves.toMatchObject({
      formalization_target: 'none',
    });
  });

  it('accepts non-formalizable low-risk steps without calling formalization', async () => {
    class NonFormalizableModel extends StubValidationModel {
      async generateTrace(input: TaskInput) {
        const trace = this.makeTrace(input);
        return { ...trace, steps: [{ ...trace.steps[0], formalizable: false }] };
      }
      async formalizeClaim() {
        throw new Error('formalizeClaim should not be called');
      }
    }

    const result = await runAgentBrowser(task, {
      llm: new NonFormalizableModel(),
      leanChecker: new FakeLeanChecker('passed') as unknown as BrowserLeanChecker,
    });

    expect(result.verification_status).toBe('soft_verified');
    expect(result.accepted_steps).toHaveLength(1);
    expect(result.checker_artifacts).toEqual([]);
  });

  it('fails non-formalizable high-risk steps without a formal claim', async () => {
    class HighRiskNoClaimModel extends StubValidationModel {
      async generateTrace(input: TaskInput) {
        const trace = this.makeTrace(input);
        return { ...trace, steps: [{ ...trace.steps[0], formalizable: false }] };
      }
      async critiqueStep() {
        return [{ label: 'contradiction', severity: 'high', rationale: 'bad' }] as const;
      }
    }

    const result = await runAgentBrowser(task, {
      llm: new HighRiskNoClaimModel(),
      leanChecker: new FakeLeanChecker('passed') as unknown as BrowserLeanChecker,
      maxRepairAttemptsPerRegion: 0,
    });

    expect(result.verification_status).toBe('rejected');
    expect(result.failed_steps).toHaveLength(1);
  });

  it('fails Lean-checked steps when critique severity is high', async () => {
    class HighRiskLeanModel extends StubValidationModel {
      async critiqueStep() {
        return [{ label: 'contradiction', severity: 'high', rationale: 'bad' }] as const;
      }
    }

    const result = await runAgentBrowser(task, {
      llm: new HighRiskLeanModel(),
      leanChecker: new FakeLeanChecker('passed') as unknown as BrowserLeanChecker,
      maxRepairAttemptsPerRegion: 0,
    });

    expect(result.verification_status).toBe('rejected');
    expect(result.checker_artifacts).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'passed' })]));
  });

  it('aggregates when repair cannot improve a failed region', async () => {
    class NoImproveModel extends StubValidationModel {
      async repairRegion(input: RepairRegionInput) {
        return {
          repaired_steps: input.failed_steps,
          updated_formal_claims: [],
          local_justification: 'no change',
        };
      }
    }

    const result = await runAgentBrowser(
      { ...task, goal: 'Validate that forall n : Nat, n + 1 = n.' },
      {
        llm: new NoImproveModel(),
        leanChecker: new FakeLeanChecker('failed') as unknown as BrowserLeanChecker,
        maxRepairAttemptsPerRegion: 1,
      },
    );

    expect(result.verification_status).toBe('rejected');
    expect(result.failed_steps).toHaveLength(1);
  });

  it('skips repair attempts once the configured attempt limit is reached', async () => {
    const result = await runAgentBrowser(
      { ...task, goal: 'Validate that forall n : Nat, n + 1 = n.' },
      {
        llm: new StubValidationModel(),
        leanChecker: new FakeLeanChecker('failed') as unknown as BrowserLeanChecker,
        maxRepairAttemptsPerRegion: 0,
      },
    );

    expect(result.repair_history).toEqual([]);
    expect(result.verification_status).toBe('rejected');
  });

  it('handles non-Lean claims and high critiques from injected models', async () => {
    class NonLeanHighCritiqueModel implements LocalValidationModel {
      async generateTrace() {
        return makeTrace();
      }
      async critiqueStep() {
        return [{ label: 'contradiction', severity: 'high', rationale: 'bad' }] as const;
      }
      async critiqueTrace() {
        return { global_issues: [], open_obligations: [] };
      }
      async formalizeClaim() {
        return { claim_id: 'c', source_step_id: 'step-1', claim_text: 'x', formalization_target: 'none' as const };
      }
      async repairRegion(input: RepairRegionInput) {
        return { repaired_steps: input.failed_steps, updated_formal_claims: [], local_justification: 'none' };
      }
      async aggregateAttempts(partialTraces: ReasoningTrace[]) {
        return partialTraces[0];
      }
      async gateAnswer() {
        return { final_answer: '', verification_status: 'hard_verified' as const, rationale: 'bad gate' };
      }
    }

    const result = await runAgentBrowser(task, {
      llm: new NonLeanHighCritiqueModel(),
      leanChecker: new FakeLeanChecker('passed') as unknown as BrowserLeanChecker,
    });

    expect(result.verification_status).toBe('rejected');
  });
});
