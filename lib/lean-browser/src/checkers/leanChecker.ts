import type { CheckerResult, FormalClaim } from '../schemas';
import { formatLeanDiagnostics, hasLeanErrors } from '../lean/diagnostics';
import type { BrowserLeanServer } from '../lean/createLeanServer';
import { buildLeanTheoremFile, sanitizeLeanIdentifier } from '../lean/theoremBuilder';

export class BrowserLeanChecker {
  private readonly server: BrowserLeanServer;

  constructor(server: BrowserLeanServer) {
    this.server = server;
  }

  async check(claim: FormalClaim, assumptions: string[] = []): Promise<CheckerResult> {
    if (claim.formalization_target !== 'lean') {
      return { checker_type: 'lean', status: 'unknown', message: 'Claim is not targeted at Lean.' };
    }
    if (!claim.formal_expression) {
      return { checker_type: 'lean', status: 'unknown', message: 'No Lean formal expression provided.' };
    }

    let theorem = '';
    const filename = `${sanitizeLeanIdentifier(claim.claim_id)}.lean`;
    try {
      theorem = buildLeanTheoremFile(claim, { assumptions });
      await this.server.sync(filename, theorem);
      const diagnostics = await this.server.getDiagnostics(filename);
      const artifact_ref = JSON.stringify({ filename, theorem, diagnostics });
      if (hasLeanErrors(diagnostics)) {
        return {
          checker_type: 'lean',
          status: 'failed',
          message: `Lean reported errors: ${formatLeanDiagnostics(diagnostics)}`,
          artifact_ref,
        };
      }
      return { checker_type: 'lean', status: 'passed', message: 'Lean accepted the theorem.', artifact_ref };
    } catch (error) {
      return {
        checker_type: 'lean',
        status: 'unknown',
        message: error instanceof Error ? error.message : String(error),
        artifact_ref: JSON.stringify({ filename, theorem, error: String(error) }),
      };
    }
  }
}
