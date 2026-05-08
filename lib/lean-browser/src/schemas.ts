export type VerificationStatus =
  | 'hard_verified'
  | 'soft_verified'
  | 'corrected'
  | 'unverified'
  | 'rejected';

export type CheckerStatus = 'passed' | 'failed' | 'unknown';
export type StepStatus = 'pending' | 'accepted' | 'failed' | 'repaired' | 'discarded';
export type CritiqueSeverity = 'low' | 'medium' | 'high';

export type CritiqueKind =
  | 'unsupported_inference'
  | 'missing_premise'
  | 'contradiction'
  | 'invalid_calculation'
  | 'malformed_formalization'
  | 'incomplete_case_analysis'
  | 'policy_violation'
  | 'unverifiable_claim'
  | 'irrelevant_step';

export interface TaskInput {
  task_id: string;
  goal: string;
  context: Record<string, unknown>;
  constraints: string[];
  evidence: Record<string, unknown>[];
  require_formal_proof: boolean;
  require_symbolic_checking: boolean;
  max_iterations: number;
  max_branches: number;
}

export interface CritiqueLabel {
  label: CritiqueKind;
  severity: CritiqueSeverity;
  rationale: string;
}

export interface CheckerResult {
  checker_type: 'lean' | 'smt' | 'rubric' | 'test';
  status: CheckerStatus;
  message: string;
  artifact_ref?: string;
  counterexample?: Record<string, unknown>;
}

export interface ReasoningStep {
  step_id: string;
  text: string;
  depends_on: string[];
  evidence_refs: string[];
  formalizable: boolean;
  critique_labels: CritiqueLabel[];
  checker_results: CheckerResult[];
  status: StepStatus;
}

export interface FormalClaim {
  claim_id: string;
  source_step_id: string;
  claim_text: string;
  formalization_target: 'lean' | 'smt' | 'none';
  formal_expression?: string;
  proof?: string;
  status?: 'pending' | 'passed' | 'failed' | 'not_applicable';
  artifact_ref?: string;
}

export interface SummaryState {
  accepted_facts: string[];
  open_obligations: string[];
  failed_regions: string[];
  best_partial_solutions: string[];
  abandoned_paths: string[];
}

export interface ReasoningTrace {
  task_id: string;
  goal: string;
  assumptions: string[];
  steps: ReasoningStep[];
  formal_claims: FormalClaim[];
  summary_state: SummaryState;
}

export interface AgentResult {
  task_id: string;
  final_answer: string | null;
  verification_status: VerificationStatus;
  accepted_steps: ReasoningStep[];
  failed_steps: ReasoningStep[];
  checker_artifacts: Record<string, unknown>[];
  repair_history: Record<string, unknown>[];
  summary_state: SummaryState;
}

export interface SchemaLike<T> {
  parse(value: unknown): T;
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: Error };
}

function createSchema<T>(name: string, guard: (value: unknown) => value is T): SchemaLike<T> {
  return {
    parse(value: unknown): T {
      if (guard(value)) {
        return value;
      }
      throw new Error(`Invalid ${name}`);
    },
    safeParse(value: unknown) {
      try {
        return { success: true as const, data: this.parse(value) };
      } catch (error) {
        return { success: false as const, error: error as Error };
      }
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === 'string' && value[key].length > 0;
}

export function createEmptySummaryState(): SummaryState {
  return {
    accepted_facts: [],
    open_obligations: [],
    failed_regions: [],
    best_partial_solutions: [],
    abandoned_paths: [],
  };
}

export const taskInputSchema = createSchema<TaskInput>('TaskInput', (value): value is TaskInput =>
  isRecord(value) &&
  hasString(value, 'task_id') &&
  hasString(value, 'goal') &&
  isRecord(value.context) &&
  Array.isArray(value.constraints) &&
  Array.isArray(value.evidence) &&
  typeof value.require_formal_proof === 'boolean' &&
  typeof value.require_symbolic_checking === 'boolean' &&
  typeof value.max_iterations === 'number' &&
  typeof value.max_branches === 'number',
);

export const formalClaimSchema = createSchema<FormalClaim>('FormalClaim', (value): value is FormalClaim =>
  isRecord(value) &&
  hasString(value, 'claim_id') &&
  hasString(value, 'source_step_id') &&
  hasString(value, 'claim_text') &&
  ['lean', 'smt', 'none'].includes(String(value.formalization_target)),
);

export const reasoningTraceSchema = createSchema<ReasoningTrace>('ReasoningTrace', (value): value is ReasoningTrace =>
  isRecord(value) &&
  hasString(value, 'task_id') &&
  hasString(value, 'goal') &&
  Array.isArray(value.assumptions) &&
  Array.isArray(value.steps) &&
  Array.isArray(value.formal_claims) &&
  isRecord(value.summary_state),
);

export const agentResultSchema = createSchema<AgentResult>('AgentResult', (value): value is AgentResult =>
  isRecord(value) &&
  hasString(value, 'task_id') &&
  ['hard_verified', 'soft_verified', 'corrected', 'unverified', 'rejected'].includes(
    String(value.verification_status),
  ) &&
  Array.isArray(value.accepted_steps) &&
  Array.isArray(value.failed_steps) &&
  Array.isArray(value.checker_artifacts) &&
  Array.isArray(value.repair_history) &&
  isRecord(value.summary_state),
);
