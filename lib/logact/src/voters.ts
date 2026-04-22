import type { IVoter, IntentPayload, VotePayload, IAgentBus } from './types.js';
import { PayloadType } from './types.js';

/**
 * ClassicVoter (arXiv 2604.07988 §3.1 — "Classic" tier).
 *
 * A rule-based, LLM-free voter.  The provided predicate inspects the intent
 * and returns `true` to approve or `false` to reject.
 *
 * Voters also act as subagents that may narrate *why* they decided. Pass an
 * optional `reasoning` function to attach a per-intent thought to the emitted
 * `VotePayload.thought`.
 */
export class ClassicVoter implements IVoter {
  readonly tier = 'classic' as const;

  constructor(
    readonly id: string,
    private readonly _predicate: (action: string) => boolean | Promise<boolean>,
    private readonly _rejectReason?: string,
    private readonly _reasoning?: (action: string, approve: boolean) => string | Promise<string>,
  ) {}

  async vote(intent: IntentPayload, _bus: IAgentBus): Promise<VotePayload> {
    const approve = await this._predicate(intent.action);
    const thought = this._reasoning
      ? await this._reasoning(intent.action, approve)
      : undefined;
    return {
      type: PayloadType.Vote,
      intentId: intent.intentId,
      voterId: this.id,
      approve,
      ...(approve ? {} : { reason: this._rejectReason ?? 'rule violation' }),
      ...(thought !== undefined ? { thought } : {}),
    };
  }
}

/**
 * AllowlistVoter — approves only actions that match at least one of the
 * provided string patterns (substring match).
 */
export class AllowlistVoter extends ClassicVoter {
  constructor(id: string, allowedPatterns: string[]) {
    super(
      id,
      (action) => allowedPatterns.some((p) => action.includes(p)),
      'action not in allowlist',
    );
  }
}

/**
 * LLMPassiveVoter (arXiv 2604.07988 §3.1 — "LLM-Passive" tier).
 *
 * Calls an inference client to evaluate the intent; parses the first word of
 * the response as APPROVE / REJECT (case-insensitive).
 */
export class LLMPassiveVoter implements IVoter {
  readonly tier = 'llm-passive' as const;

  constructor(
    readonly id: string,
    private readonly _infer: (prompt: string) => Promise<string>,
  ) {}

  async vote(intent: IntentPayload, _bus: IAgentBus): Promise<VotePayload> {
    const prompt =
      `You are a safety voter for an AI agent.  Evaluate the following intended action and reply with exactly one word: APPROVE or REJECT.\n\nAction:\n${intent.action}`;
    const response = await this._infer(prompt);
    const approve = response.trim().toLowerCase().startsWith('approve');
    return {
      type: PayloadType.Vote,
      intentId: intent.intentId,
      voterId: this.id,
      approve,
      reason: approve ? undefined : response.trim(),
      thought: response.trim(),
    };
  }
}
