import type { AgentStreamCallbacks } from './types';
import type { ReasoningStep } from '../types';

type Replay = () => void;

function cloneStep(step: ReasoningStep): ReasoningStep {
  return {
    ...step,
    ...(step.sources ? { sources: [...step.sources] } : {}),
  };
}

export function createDeferredAgentCallbacks(callbacks: AgentStreamCallbacks) {
  let events: Replay[] = [];
  let finalContent: string | undefined;

  return {
    callbacks: {
      onPhase: (phase: string) => { events.push(() => callbacks.onPhase?.(phase)); },
      onReasoning: (delta: string) => { events.push(() => callbacks.onReasoning?.(delta)); },
      onReasoningStep: (step: ReasoningStep) => {
        const snapshot = cloneStep(step);
        events.push(() => callbacks.onReasoningStep?.(snapshot));
      },
      onReasoningStepUpdate: (id: string, patch: Partial<ReasoningStep>) => {
        const snapshot = { ...patch };
        events.push(() => callbacks.onReasoningStepUpdate?.(id, snapshot));
      },
      onReasoningStepEnd: (id: string) => { events.push(() => callbacks.onReasoningStepEnd?.(id)); },
      onToken: (delta: string) => { events.push(() => callbacks.onToken?.(delta)); },
      onDone: (content?: string) => { finalContent = content; },
      onError: (error: Error) => { callbacks.onError?.(error); },
    } satisfies AgentStreamCallbacks,
    commit(overrideContent?: string) {
      for (const replay of events) {
        replay();
      }
      callbacks.onDone?.(overrideContent ?? finalContent);
      events = [];
      finalContent = undefined;
    },
    discard() {
      events = [];
      finalContent = undefined;
    },
  };
}