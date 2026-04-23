/**
 * services/toolUseVoters.ts
 *
 * LogAct voters + completion checker that force a local model run to
 * actually exercise tools instead of returning a naive "I will…" / plan-only
 * response. These are wired into the staged tool pipeline whenever the
 * provider is local AND the catalog is non-empty.
 *
 * - `createMustUseToolVoter` — pre-execution voter: rejects an Intent whose
 *   action text contains no `<tool_call>` block when tools are available.
 * - `createNoPlanOnlyVoter` — pre-execution voter: rejects an Intent whose
 *   text is plan-only ("I'll…", "next steps:", etc.) per ralph-loop's
 *   `PLAN_ONLY_PATTERN`.
 * - `createMustExecuteCompletionChecker` — post-execution checker: requires
 *   at least one non-empty `Result` payload before marking `done: true`.
 */

import { ClassicVoter, PayloadType } from 'logact';
import type {
  CompletionPayload,
  Entry,
  ICompletionChecker,
  IVoter,
  ResultPayload,
} from 'logact';
import { PLAN_ONLY_PATTERN, looksLikePlanOnly } from 'ralph-loop';

const TOOL_CALL_RE = /<tool_call>[\s\S]*?<\/tool_call>/i;
const FENCED_JSON_RE = /```(?:json)?\s*\{[\s\S]*?"tool"\s*:[\s\S]*?\}\s*```/i;
const BARE_TOOL_JSON_RE = /\{[\s\S]*?"tool"\s*:\s*"[^"]+"[\s\S]*?\}/i;

/** Returns true when `text` contains a parsable tool-call payload. */
export function containsToolCall(text: string): boolean {
  return TOOL_CALL_RE.test(text)
    || FENCED_JSON_RE.test(text)
    || BARE_TOOL_JSON_RE.test(text);
}

/**
 * Pre-execution voter: requires the model's intent to include a tool-call
 * block. Approves intents that already contain a tool result (executor's
 * follow-up turn) so the loop can produce a final answer after at least one
 * tool round.
 */
export function createMustUseToolVoter(): IVoter {
  return new ClassicVoter(
    'must-use-tool',
    (action) => containsToolCall(action) || /<tool_result\b/i.test(action),
    'No tool was called. Call at least one tool from the catalog before answering.',
    (_action, approve) => approve
      ? 'A tool call (or follow-up to a tool result) is present.'
      : 'The model produced a final answer without calling any tool.',
  );
}

/**
 * Pre-execution voter: rejects plan-only / future-tense intents. Approves
 * any intent that includes a tool call (the executor will run the tool;
 * planning text alongside a tool call is fine).
 */
export function createNoPlanOnlyVoter(): IVoter {
  return new ClassicVoter(
    'no-plan-only',
    (action) => containsToolCall(action) || !PLAN_ONLY_PATTERN.test(action),
    'The response only describes a plan. Do the work with tools and answer with the completed result.',
    (_action, approve) => approve
      ? 'Action is grounded in a tool call or a completed answer.'
      : 'Action is plan-only / future-tense — caller will retry.',
  );
}

/**
 * Post-execution completion checker: requires at least one `Result` payload
 * with non-empty `output` AND a non-plan-only `lastResult.output` before
 * marking `done: true`. Used regardless of whether the user prompt looks
 * "execution-y" so local runs always finish with measurable tool evidence.
 */
export function createMustExecuteCompletionChecker(): ICompletionChecker {
  return {
    async check({ lastResult, history }): Promise<CompletionPayload> {
      const output = lastResult.output.trim();
      const planOnly = looksLikePlanOnly(output);
      const toolEvidence = history.some((entry: Entry) => {
        const payload = entry.payload as { type?: string; output?: string; error?: string };
        if (payload?.type !== PayloadType.Result) return false;
        const result = payload as unknown as ResultPayload;
        return !result.error && typeof result.output === 'string' && result.output.trim().length > 0;
      });

      const incomplete = output.length === 0 || planOnly || !toolEvidence;
      return {
        type: PayloadType.Completion,
        intentId: lastResult.intentId,
        done: !incomplete,
        score: incomplete ? 'med' : 'high',
        feedback: incomplete
          ? 'You have not done the work yet. Call a tool from the available catalog to make real progress, then answer with the completed result. Do not return plans, intent, or "I will…" statements.'
          : 'Task complete with tool evidence.',
      };
    },
  };
}
