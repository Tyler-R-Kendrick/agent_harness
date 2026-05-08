import type {
  CritiqueLabel,
  FormalClaim,
  ReasoningStep,
  ReasoningTrace,
  SummaryState,
  TaskInput,
  VerificationStatus,
} from '../schemas';
import { createEmptySummaryState } from '../schemas';
import type { LocalValidationModel, RepairRegionInput, RepairRegionResult } from '../modules';

export class StubValidationModel implements LocalValidationModel {
  makeTrace(task: TaskInput): ReasoningTrace {
    return {
      task_id: task.task_id,
      goal: task.goal,
      assumptions: [],
      steps: [
        {
          step_id: 'step-1',
          text: task.goal,
          depends_on: [],
          evidence_refs: [],
          formalizable: true,
          critique_labels: [],
          checker_results: [],
          status: 'pending',
        },
      ],
      formal_claims: [],
      summary_state: createEmptySummaryState(),
    };
  }

  async generateTrace(task: TaskInput): Promise<ReasoningTrace> {
    return this.makeTrace(task);
  }

  async critiqueStep(): Promise<CritiqueLabel[]> {
    return [];
  }

  async critiqueTrace(): Promise<{ global_issues: CritiqueLabel[]; open_obligations: string[] }> {
    return { global_issues: [], open_obligations: [] };
  }

  async formalizeClaim(step: ReasoningStep): Promise<FormalClaim> {
    const text = step.text.toLowerCase();
    if (text.includes('n + 0 = n')) {
      return {
        claim_id: `claim-${step.step_id}`,
        source_step_id: step.step_id,
        claim_text: step.text,
        formalization_target: 'lean',
        formal_expression: 'forall n : Nat, n + 0 = n',
        proof: 'by\n  intro n\n  simp',
      };
    }
    if (text.includes('n + 1 = n')) {
      return {
        claim_id: `claim-${step.step_id}`,
        source_step_id: step.step_id,
        claim_text: step.text,
        formalization_target: 'lean',
        formal_expression: 'forall n : Nat, n + 1 = n',
        proof: 'by\n  intro n\n  simp',
      };
    }
    return {
      claim_id: `claim-${step.step_id}`,
      source_step_id: step.step_id,
      claim_text: step.text,
      formalization_target: 'none',
    };
  }

  async repairRegion(input: RepairRegionInput): Promise<RepairRegionResult> {
    return {
      repaired_steps: input.failed_steps.map((step) => ({
        ...step,
        text: step.text.replace('n + 1 = n', 'n + 0 = n'),
        status: 'repaired',
        critique_labels: [],
        checker_results: [],
      })),
      updated_formal_claims: [],
      local_justification: 'Repaired invalid arithmetic identity.',
    };
  }

  async aggregateAttempts(partialTraces: ReasoningTrace[]): Promise<ReasoningTrace> {
    return partialTraces[0];
  }

  async gateAnswer(
    trace: ReasoningTrace,
    summaryState: SummaryState,
  ): Promise<{ final_answer: string; verification_status: VerificationStatus; rationale: string }> {
    return {
      final_answer: trace.steps
        .filter((step) => step.status === 'accepted' || step.status === 'repaired')
        .map((step) => step.text)
        .join('\n'),
      verification_status: summaryState.open_obligations.length > 0 ? 'unverified' : 'soft_verified',
      rationale: 'Stub gate result.',
    };
  }
}
