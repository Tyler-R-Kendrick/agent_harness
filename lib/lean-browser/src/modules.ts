import {
  type CritiqueLabel,
  type FormalClaim,
  type ReasoningStep,
  type ReasoningTrace,
  type SummaryState,
  type TaskInput,
  type VerificationStatus,
  formalClaimSchema,
  reasoningTraceSchema,
} from './schemas';
import { parseModelJson, stringifyForPrompt } from './json';
import {
  aggregateAttemptsPrompt,
  critiqueStepPrompt,
  critiqueTracePrompt,
  formalizeClaimPrompt,
  gateAnswerPrompt,
  generateTracePrompt,
  repairRegionPrompt,
} from './prompts';

export interface RepairRegionInput {
  failed_steps: ReasoningStep[];
  accepted_steps: ReasoningStep[];
  assumptions: string[];
  checker_feedback: unknown[];
  summary_state: SummaryState;
  local_objective: string;
}

export interface RepairRegionResult {
  repaired_steps: ReasoningStep[];
  updated_formal_claims: FormalClaim[];
  local_justification: string;
}

export interface LocalValidationModel {
  generateTrace(task: TaskInput): Promise<ReasoningTrace>;
  critiqueStep(step: ReasoningStep, acceptedSteps: ReasoningStep[], assumptions: string[]): Promise<CritiqueLabel[]>;
  critiqueTrace(trace: ReasoningTrace): Promise<{ global_issues: CritiqueLabel[]; open_obligations: string[] }>;
  formalizeClaim(step: ReasoningStep, goal: string): Promise<FormalClaim>;
  repairRegion(input: RepairRegionInput): Promise<RepairRegionResult>;
  aggregateAttempts(partialTraces: ReasoningTrace[], summaryState: SummaryState): Promise<ReasoningTrace>;
  gateAnswer(
    trace: ReasoningTrace,
    summaryState: SummaryState,
  ): Promise<{ final_answer: string; verification_status: VerificationStatus; rationale: string }>;
}

export type TextGenerator = (prompt: string, options?: Record<string, unknown>) => Promise<string>;

async function generateJson<T>(
  generateText: TextGenerator,
  prompt: string,
  schema: { parse(value: unknown): T },
  fallback: T,
): Promise<T> {
  const first = await generateText(prompt, { temperature: 0 });
  const parsed = parseModelJson(first, schema);
  if (parsed) {
    return parsed;
  }
  const repair = await generateText(
    `Return one valid JSON object for this schema. Invalid output was:\n${first}\nPrompt:\n${prompt}`,
    { temperature: 0 },
  );
  return parseModelJson(repair, schema) ?? fallback;
}

export class JsonPromptValidationModel implements LocalValidationModel {
  private readonly generateText: TextGenerator;

  constructor(generateText: TextGenerator) {
    this.generateText = generateText;
  }

  async generateTrace(task: TaskInput): Promise<ReasoningTrace> {
    const fallback: ReasoningTrace = {
      task_id: task.task_id,
      goal: task.goal,
      assumptions: [],
      steps: [],
      formal_claims: [],
      summary_state: {
        accepted_facts: [],
        open_obligations: ['Model failed to produce a valid trace.'],
        failed_regions: [],
        best_partial_solutions: [],
        abandoned_paths: [],
      },
    };
    return generateJson(this.generateText, generateTracePrompt(task), reasoningTraceSchema, fallback);
  }

  async critiqueStep(
    step: ReasoningStep,
    acceptedSteps: ReasoningStep[],
    assumptions: string[],
  ): Promise<CritiqueLabel[]> {
    const text = await this.generateText(critiqueStepPrompt(step, acceptedSteps, assumptions), { temperature: 0 });
    const parsed = parseModelJson<{ critique_labels: CritiqueLabel[] }>(text, {
      parse(value: unknown) {
        const labels = (value as { critique_labels?: CritiqueLabel[] }).critique_labels;
        if (Array.isArray(labels)) {
          return { critique_labels: labels };
        }
        throw new Error('Invalid critique labels');
      },
    });
    return parsed?.critique_labels ?? [];
  }

  async critiqueTrace(trace: ReasoningTrace): Promise<{ global_issues: CritiqueLabel[]; open_obligations: string[] }> {
    const text = await this.generateText(critiqueTracePrompt(trace), { temperature: 0 });
    const parsed = parseModelJson<{ global_issues: CritiqueLabel[]; open_obligations: string[] }>(text, {
      parse(value: unknown) {
        const record = value as { global_issues?: CritiqueLabel[]; open_obligations?: string[] };
        return {
          global_issues: Array.isArray(record.global_issues) ? record.global_issues : [],
          open_obligations: Array.isArray(record.open_obligations) ? record.open_obligations : [],
        };
      },
    });
    return parsed ?? { global_issues: [], open_obligations: [] };
  }

  async formalizeClaim(step: ReasoningStep, goal: string): Promise<FormalClaim> {
    const fallback: FormalClaim = {
      claim_id: `claim-${step.step_id}`,
      source_step_id: step.step_id,
      claim_text: step.text,
      formalization_target: 'none',
    };
    return generateJson(this.generateText, formalizeClaimPrompt(step, goal), formalClaimSchema, fallback);
  }

  async repairRegion(input: RepairRegionInput): Promise<RepairRegionResult> {
    const text = await this.generateText(repairRegionPrompt(input), { temperature: 0 });
    const parsed = parseModelJson<RepairRegionResult>(text, {
      parse(value: unknown) {
        const record = value as Partial<RepairRegionResult>;
        if (Array.isArray(record.repaired_steps) && Array.isArray(record.updated_formal_claims)) {
          return {
            repaired_steps: record.repaired_steps,
            updated_formal_claims: record.updated_formal_claims,
            local_justification: record.local_justification ?? '',
          };
        }
        throw new Error('Invalid repair result');
      },
    });
    return parsed ?? { repaired_steps: [], updated_formal_claims: [], local_justification: 'Repair unavailable.' };
  }

  async aggregateAttempts(partialTraces: ReasoningTrace[], summaryState: SummaryState): Promise<ReasoningTrace> {
    const fallback = partialTraces[0] ?? {
      task_id: 'unknown',
      goal: 'unknown',
      assumptions: [],
      steps: [],
      formal_claims: [],
      summary_state: summaryState,
    };
    return generateJson(
      this.generateText,
      aggregateAttemptsPrompt(partialTraces, summaryState),
      reasoningTraceSchema,
      fallback,
    );
  }

  async gateAnswer(
    trace: ReasoningTrace,
    summaryState: SummaryState,
  ): Promise<{ final_answer: string; verification_status: VerificationStatus; rationale: string }> {
    const text = await this.generateText(gateAnswerPrompt(trace, summaryState), { temperature: 0 });
    const parsed = parseModelJson<{ final_answer: string; verification_status: VerificationStatus; rationale: string }>(
      text,
      {
        parse(value: unknown) {
          const record = value as { final_answer?: unknown; verification_status?: unknown; rationale?: unknown };
          if (typeof record.final_answer === 'string' && typeof record.verification_status === 'string') {
            return {
              final_answer: record.final_answer,
              verification_status: record.verification_status as VerificationStatus,
              rationale: typeof record.rationale === 'string' ? record.rationale : '',
            };
          }
          throw new Error('Invalid gate output');
        },
      },
    );
    return parsed ?? {
      final_answer: stringifyForPrompt(trace.steps.map((step) => step.text)),
      verification_status: 'unverified',
      rationale: 'Model gate returned invalid JSON.',
    };
  }
}
