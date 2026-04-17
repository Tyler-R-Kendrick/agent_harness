import type { IAgentBus } from './types.js';
import { PayloadType } from './types.js';

/**
 * Agentic introspection utilities (arXiv 2604.07988 §1, §3).
 *
 * These helpers let any component inspect the AgentBus log and derive
 * semantic information from it — enabling health checks, semantic recovery,
 * and optimization.
 */

// ----------------------------------------------------------------

/**
 * Return the full execution summary as a human-readable string suitable for
 * passing to an LLM for semantic analysis.  Includes all intentions,
 * decisions, and results.
 */
export async function buildExecutionSummary(bus: IAgentBus): Promise<string> {
  const entries = await bus.read(0, await bus.tail());
  const lines: string[] = [];

  for (const entry of entries) {
    const { payload } = entry;
    switch (payload.type) {
      case PayloadType.Intent:
        lines.push(`[${entry.position}] INTENT(${payload.intentId}): ${payload.action}`);
        break;
      case PayloadType.Vote:
        lines.push(
          `[${entry.position}] VOTE(${payload.intentId}) voter=${payload.voterId} ` +
            `approve=${payload.approve}${payload.reason ? ` reason="${payload.reason}"` : ''}`,
        );
        break;
      case PayloadType.Commit:
        lines.push(`[${entry.position}] COMMIT(${payload.intentId})`);
        break;
      case PayloadType.Abort:
        lines.push(
          `[${entry.position}] ABORT(${payload.intentId})` +
            (payload.reason ? ` reason="${payload.reason}"` : ''),
        );
        break;
      case PayloadType.Result:
        lines.push(
          `[${entry.position}] RESULT(${payload.intentId}): ` +
            (payload.error ? `ERROR ${payload.error}` : payload.output),
        );
        break;
      case PayloadType.Mail:
        lines.push(`[${entry.position}] MAIL from=${payload.from}: ${payload.content}`);
        break;
      default:
        // Skip InfIn / InfOut / Policy — too verbose for summaries.
        break;
    }
  }

  return lines.join('\n');
}

/**
 * Return all Result payloads from the log.
 * Useful for agents that need to introspect prior outcomes.
 */
export async function getResults(
  bus: IAgentBus,
): Promise<import('./types.js').ResultPayload[]> {
  const entries = await bus.read(0, await bus.tail());
  return entries
    .map((e) => e.payload)
    .filter(
      (p): p is import('./types.js').ResultPayload => p.type === PayloadType.Result,
    );
}

/**
 * Return all aborted intent payloads and their abort entries from the log.
 */
export async function getAbortedIntents(bus: IAgentBus): Promise<
  Array<{
    intent: import('./types.js').IntentPayload;
    abort: import('./types.js').AbortPayload;
  }>
> {
  const entries = await bus.read(0, await bus.tail());
  const intents = new Map<string, import('./types.js').IntentPayload>();
  const aborts = new Map<string, import('./types.js').AbortPayload>();

  for (const entry of entries) {
    const { payload } = entry;
    if (payload.type === PayloadType.Intent) {
      intents.set(payload.intentId, payload);
    } else if (payload.type === PayloadType.Abort) {
      aborts.set(payload.intentId, payload);
    }
  }

  const result: Array<{
    intent: import('./types.js').IntentPayload;
    abort: import('./types.js').AbortPayload;
  }> = [];
  for (const [id, abort] of aborts) {
    const intent = intents.get(id);
    if (intent) result.push({ intent, abort });
  }
  return result;
}
