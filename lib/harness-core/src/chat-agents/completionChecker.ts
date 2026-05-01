import type { ICompletionChecker } from 'logact';
import type { CoreAgentLoopCallbacks, CoreIterationStep } from '../logactLoopTypes.js';

export function wrapCompletionCheckerWithCallbacks(
  checker: ICompletionChecker,
  callbacks: Pick<CoreAgentLoopCallbacks, 'onIterationStep' | 'onIterationStepUpdate' | 'onIterationStepEnd'>,
): ICompletionChecker {
  let iterationIndex = 0;

  return {
    async check(context) {
      iterationIndex += 1;
      const stepId = `iteration-${iterationIndex}`;
      const step: CoreIterationStep = {
        id: stepId,
        kind: 'iteration',
        title: `Iteration ${iterationIndex}`,
        startedAt: Date.now(),
        status: 'active',
      };
      callbacks.onIterationStep?.(step);

      try {
        const result = await checker.check(context);
        callbacks.onIterationStepUpdate?.(stepId, {
          status: 'done',
          body: result.feedback,
          score: result.score,
          done: result.done,
          endedAt: Date.now(),
        });
        callbacks.onIterationStepEnd?.(stepId);
        return result;
      } catch (error) {
        callbacks.onIterationStepUpdate?.(stepId, {
          status: 'done',
          body: `Error: ${error instanceof Error ? error.message : String(error)}`,
          done: false,
          endedAt: Date.now(),
        });
        callbacks.onIterationStepEnd?.(stepId);
        throw error;
      }
    },
  };
}
