import type { PromptFeatures } from './types.js';

const REASONING_CUES = ['analyze', 'design', 'architecture', 'debug', 'tradeoff', 'optimize'];
const TOOL_CUES = ['tool', 'api', 'endpoint', 'playwright', 'pipeline', 'refactor'];

function matchCues(normalizedPrompt: string, cues: string[]): string[] {
  return cues.filter((cue) => normalizedPrompt.includes(cue));
}

export function extractPromptFeatures(prompt: string, escalationKeywords: string[]): PromptFeatures {
  const normalizedPrompt = prompt.toLowerCase();
  const estimatedLengthScore = Math.min(normalizedPrompt.length / 600, 0.35);

  const matchedReasoningCues = matchCues(normalizedPrompt, REASONING_CUES);
  const matchedToolCues = matchCues(normalizedPrompt, TOOL_CUES);
  const matchedEscalationCues = matchCues(
    normalizedPrompt,
    escalationKeywords.map((keyword) => keyword.toLowerCase()),
  );

  return {
    normalizedPrompt,
    estimatedLengthScore,
    hasReasoningCue: matchedReasoningCues.length > 0,
    hasToolCue: matchedToolCues.length > 0,
    hasEscalationCue: matchedEscalationCues.length > 0,
    matchedReasoningCues,
    matchedToolCues,
    matchedEscalationCues,
  };
}
