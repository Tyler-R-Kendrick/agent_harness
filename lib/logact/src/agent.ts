import type {
  IAgentBus,
  IInferenceClient,
  IVoter,
  IExecutor,
  LogActAgentOptions,
  InfInPayload,
  IntentPayload,
  VotePayload,
  ResultPayload,
  MailPayload,
} from './types.js';
import { PayloadType, QuorumPolicy } from './types.js';
import { evaluateQuorum } from './quorum.js';

/**
 * Default IExecutor — a no-op that returns the raw action string.
 * Replace with a real executor that evals / dispatches tool calls.
 */
class NoopExecutor implements IExecutor {
  readonly tier = 'llm-active' as const;
  async execute(action: string): Promise<string> {
    return action;
  }
}

/**
 * LogActAgent — the full deconstructed state machine (arXiv 2604.07988 §3).
 *
 * Orchestrates Driver → Voter(s) → Decider → Executor in a loop, using the
 * AgentBus as the single source of truth.
 */
export class LogActAgent {
  private readonly _bus: IAgentBus;
  private readonly _inference: IInferenceClient;
  private readonly _voters: IVoter[];
  private readonly _executor: IExecutor;
  private readonly _quorumPolicy: QuorumPolicy;
  private readonly _maxTurns: number;
  private _turnCount = 0;
  private _stopped = false;

  constructor(opts: LogActAgentOptions) {
    this._bus = opts.bus;
    this._inference = opts.inferenceClient;
    this._voters = opts.voters ?? [];
    this._executor = opts.executor ?? new NoopExecutor();
    this._quorumPolicy = opts.quorumPolicy ?? QuorumPolicy.BooleanAnd;
    this._maxTurns = opts.maxTurns ?? Infinity;
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  /**
   * Send a mailbox message to the agent (initial user turn or mid-run input).
   * The message is appended to the AgentBus and will be picked up on the
   * next inference cycle.
   */
  async send(content: string, from = 'user'): Promise<void> {
    const mail: MailPayload = { type: PayloadType.Mail, from, content };
    await this._bus.append(mail);
  }

  /**
   * Run the agentic loop until `stop()` is called, `maxTurns` is reached,
   * or the model returns an empty / terminal response.
   *
   * @returns An array of all result payloads produced during the run.
   */
  async run(): Promise<ResultPayload[]> {
    const results: ResultPayload[] = [];
    let cursor = 0;

    while (!this._stopped && this._turnCount < this._maxTurns) {
      // --- Stage 0: Inferring ---
      // Wait for mail or result entries (triggers next inference).
      const triggerEntries = await this._bus.poll(cursor, [
        PayloadType.Mail,
        PayloadType.Result,
        PayloadType.Abort,
      ]);
      cursor = Math.max(...triggerEntries.map((e) => e.position)) + 1;

      if (this._stopped) break;

      // Build message history for the inference call.
      const allEntries = await this._bus.read(0, await this._bus.tail());
      const messages = buildMessages(allEntries);

      const infIn: InfInPayload = { type: PayloadType.InfIn, messages };
      await this._bus.append(infIn);

      const rawText = await this._inference.infer(messages);
      if (!rawText || rawText.trim() === '') break; // terminal signal

      await this._bus.append({ type: PayloadType.InfOut, text: rawText });

      const intentId = `intent-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const intent: IntentPayload = {
        type: PayloadType.Intent,
        intentId,
        action: rawText.trim(),
      };
      await this._bus.append(intent);

      // --- Stage 1: Voting ---
      const votePayloads = await this._runVoters(intent);

      // --- Stage 2: Deciding ---
      const decision = evaluateQuorum(
        votePayloads,
        this._voters.length,
        this._quorumPolicy,
      );

      if (decision === 'abort') {
        await this._bus.append({
          type: PayloadType.Abort,
          intentId,
          reason: votePayloads.find((v) => !v.approve)?.reason,
        });
        this._turnCount++;
        continue;
      }

      // OnByDefault or quorum satisfied → commit.
      await this._bus.append({ type: PayloadType.Commit, intentId });

      // --- Stage 3: Executing ---
      let output: string;
      let error: string | undefined;
      try {
        output = await this._executor.execute(intent.action);
      } catch (err) {
        output = '';
        error = err instanceof Error ? err.message : String(err);
      }

      const result: ResultPayload = {
        type: PayloadType.Result,
        intentId,
        output,
        ...(error !== undefined ? { error } : {}),
      };
      await this._bus.append(result);
      results.push(result);
      this._turnCount++;

      // If there's an execution error we continue so the model can recover.
    }

    return results;
  }

  /** Gracefully stop the agentic loop after the current turn completes. */
  stop(): void {
    this._stopped = true;
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  private async _runVoters(intent: IntentPayload): Promise<VotePayload[]> {
    if (this._voters.length === 0) return [];
    const votes = await Promise.all(
      this._voters.map((voter) => voter.vote(intent, this._bus)),
    );
    for (const vote of votes) {
      await this._bus.append(vote);
    }
    return votes;
  }
}

// ----------------------------------------------------------------

/**
 * Build an inference-ready message array from the AgentBus log.
 * Mail entries become user messages; InfOut entries become assistant messages.
 */
function buildMessages(
  entries: import('./types.js').Entry[],
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

  for (const entry of entries) {
    const { payload } = entry;
    if (payload.type === PayloadType.Mail) {
      messages.push({ role: 'user', content: payload.content });
    } else if (payload.type === PayloadType.InfOut) {
      messages.push({ role: 'assistant', content: payload.text });
    } else if (payload.type === PayloadType.Result) {
      messages.push({
        role: 'user',
        content: payload.error
          ? `Error: ${payload.error}`
          : `Result: ${payload.output}`,
      });
    } else if (payload.type === PayloadType.Abort) {
      messages.push({
        role: 'user',
        content: `Action was aborted: ${payload.reason ?? 'no reason given'}`,
      });
    }
  }
  return messages;
}
