import { PayloadType } from 'logact';
import type { CompletionPayload, ICompletionChecker } from 'logact';

const EXECUTION_TASK_WORDS = String.raw`fix|implement|add|update|build|create|run|execute|wire|refactor|complete|finish|start implementation|ship`;
const EXECUTION_TASK_PATTERN = new RegExp(String.raw`\b(?:${EXECUTION_TASK_WORDS})\b`, 'i');
const EXECUTION_AFTER_CONNECTOR_PATTERN = new RegExp(String.raw`\b(?:and|then|also)\s+(?:${EXECUTION_TASK_WORDS})\b`, 'i');
const PLANNING_TASK_PATTERN = /\b(?:plan|delegate|parallel(?:ize|ise)?|break down|decompose|summari[sz]e)\b/i;
const EXPLANATORY_TASK_PATTERN = /^\s*(?:please\s+)?(?:explain|review|analy[sz]e)\b/i;
export const PLAN_ONLY_PATTERN = /(?:^|\n)\s*(?:plan:|next steps?:|remaining steps?:)|\b(?:i will|i'll|we should|need to (?:do|finish|implement|run)|still need to|remaining work|follow-?up|let me know if|specific constraints or requirements)\b/i;
const EMPTY_OUTPUT_PATTERN = /^\s*$/;

export function isExecutionTask(task?: string): boolean {
  if (!task) return false;
  const normalizedTask = task.trim();
  if (!EXECUTION_TASK_PATTERN.test(normalizedTask)) return false;

  const includesExplicitFollowOnExecution = EXECUTION_AFTER_CONNECTOR_PATTERN.test(normalizedTask);
  const isPlanningOnly = (
    PLANNING_TASK_PATTERN.test(normalizedTask) || EXPLANATORY_TASK_PATTERN.test(normalizedTask)
  ) && !includesExplicitFollowOnExecution;

  return !isPlanningOnly;
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
