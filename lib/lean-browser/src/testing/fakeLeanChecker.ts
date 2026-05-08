import type { CheckerResult, CheckerStatus, FormalClaim } from '../schemas';

export type FakeLeanCheckerDecision =
  | CheckerStatus
  | ((input: { claim: FormalClaim; assumptions: string[] }) => CheckerStatus);

export class FakeLeanChecker {
  private readonly decision: FakeLeanCheckerDecision;

  constructor(decision: FakeLeanCheckerDecision = 'passed') {
    this.decision = decision;
  }

  async check(claim: FormalClaim, assumptions: string[] = []): Promise<CheckerResult> {
    const status = typeof this.decision === 'function' ? this.decision({ claim, assumptions }) : this.decision;
    return {
      checker_type: 'lean',
      status,
      message: `fake ${status}`,
      artifact_ref: JSON.stringify({ claim_id: claim.claim_id, status }),
    };
  }
}
