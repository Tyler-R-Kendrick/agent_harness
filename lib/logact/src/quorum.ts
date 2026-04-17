import { QuorumPolicy } from './types.js';
import type { VotePayload } from './types.js';

/**
 * Decides whether a set of votes constitutes a commit or abort under a
 * given {@link QuorumPolicy} (arXiv 2604.07988 §3).
 *
 * @param votes        Votes cast so far for a single intentId.
 * @param voterCount   Total number of registered voters (needed for AND/OR).
 * @param policy       Active quorum policy.
 * @returns `'commit'` | `'abort'` | `'pending'` (waiting for more votes).
 */
export function evaluateQuorum(
  votes: VotePayload[],
  voterCount: number,
  policy: QuorumPolicy,
): 'commit' | 'abort' | 'pending' {
  const approvals = votes.filter((v) => v.approve).length;
  const rejections = votes.filter((v) => !v.approve).length;

  switch (policy) {
    case QuorumPolicy.OnByDefault:
      // Commit immediately without any votes.
      return 'commit';

    case QuorumPolicy.FirstVoter:
      // Decide based on the first vote received.
      if (votes.length === 0) return 'pending';
      return votes[0].approve ? 'commit' : 'abort';

    case QuorumPolicy.BooleanAnd:
      // Any rejection → abort; all must approve.
      if (rejections > 0) return 'abort';
      if (approvals === voterCount && voterCount > 0) return 'commit';
      return 'pending';

    case QuorumPolicy.BooleanOr:
      // Any approval → commit; all must reject to abort.
      if (approvals > 0) return 'commit';
      if (rejections === voterCount && voterCount > 0) return 'abort';
      return 'pending';
  }
}
