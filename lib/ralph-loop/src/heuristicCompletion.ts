import { PayloadType } from 'logact';
import type { CompletionPayload, ICompletionChecker } from 'logact';

const EXECUTION_TASK_PATTERN = /\b(?:fix|implement|add|update|build|create|run|execute|wire|refactor|complete|finish|start implementation|ship)\b/i;
const PLANNING_TASK_PATTERN = /\b(?:plan|delegate|parallel(?:ize|ise)?|break down|decompose|summari[sz]e|explain|review|analy[sz]e)\b/i;
export const PLAN_ONLY_PATTERN = /(?:^|\n)\s*(?:plan:|next steps?:|remaining steps?:)|\b(?:i will|i'll|we should|need to (?:do|finish|implement|run)|still need to|remaining work|follow-?up|let me know if|specific constraints or requirements)\b/i;
const EMPTY_OUTPUT_PATTERN = /^\s*$/;

export function isExecutionTask(task?: string): boolean {
  if (!task) return false;
  return EXECUTION_TASK_PATTERN.test(task) && !PLANNING_TASK_PATTERN.test(task);
}

export function looksLikePlanOnly(output: string): boolean {
  if (EMPTY_OUTPUT_PATTERN.test(output)) {
    return true;
  }

  return PLAN_ONLY_PATTERN.test(output.trim());
}

export function createHeuristicCompletionChecker(task?: string): ICompletionChecker {
  return {
    async check({ lastResult }): Promise<CompletionPayload> {
      const output = lastResult.output.trim();
      const requiresExecution = isExecutionTask(task);
      const incomplete = EMPTY_OUTPUT_PATTERN.test(output)
        || (requiresExecution && looksLikePlanOnly(output));

      return {
        type: PayloadType.Completion,
        intentId: lastResult.intentId,
        done: !incomplete,
        score: incomplete ? 'med' : 'high',
        feedback: incomplete
          ? 'Do the work to completion. Do not return a plan, next steps, or future-tense intent. Continue until the task is finished and answer with the completed result.'
          : 'Task complete.',
      };
    },
  };
}