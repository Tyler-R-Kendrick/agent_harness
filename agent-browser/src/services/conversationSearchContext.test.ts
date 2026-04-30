import { describe, expect, it } from 'vitest';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import {
  createSearchTurnContextSystemMessage,
  resolveConversationSearchContext,
} from './conversationSearchContext';
import type { SearchTurnContext } from '../types';

const priorBarsContext: SearchTurnContext = {
  taskText: 'closest bars near me',
  resolvedTaskText: 'closest bars near Arlington Heights IL',
  subject: 'bars',
  answerSubject: 'bars',
  rankingGoal: 'closest',
  location: 'Arlington Heights, IL',
  acceptedCandidates: [{
    name: 'Sports Page Bar & Grill Arlington Heights',
    url: 'https://www.sportspagebarandgrill.com/',
  }],
  rejectedLabels: ['Yelp: Best Bars in Arlington Heights, IL'],
  sourceQueries: ['closest bars Arlington Heights IL'],
  requestedCount: 1,
  timestamp: 1,
};

function withPriorContext(latest: string): ModelMessage[] {
  return [
    { role: 'user', content: 'what about closest bars?' },
    { role: 'assistant', content: 'Here are bars near Arlington Heights IL:\n\n1. [Sports Page Bar & Grill Arlington Heights](https://www.sportspagebarandgrill.com/) - Why: source backed.' },
    createSearchTurnContextSystemMessage(priorBarsContext),
    { role: 'user', content: latest },
  ];
}

describe('resolveConversationSearchContext', () => {
  it('resolves show-me-more follow-ups using prior search context and exclusions', () => {
    const resolved = resolveConversationSearchContext(withPriorContext('show me 3 more'));

    expect(resolved.needsClarification).toBe(false);
    expect(resolved.resolvedTaskText).toBe('closest bars near Arlington Heights IL');
    expect(resolved.requestedCount).toBe(3);
    expect(resolved.context?.acceptedCandidates.map((candidate) => candidate.name)).toEqual([
      'Sports Page Bar & Grill Arlington Heights',
    ]);
    expect(resolved.messages.at(-1)).toEqual({
      role: 'user',
      content: 'closest bars near Arlington Heights IL',
    });
  });

  it('asks for clarification instead of searching literal more text without prior context', () => {
    const resolved = resolveConversationSearchContext([{ role: 'user', content: 'show me more' }]);

    expect(resolved.needsClarification).toBe(true);
    expect(resolved.clarificationPrompt).toContain('What should I show more of?');
    expect(resolved.messages.at(-1)?.content).toBe('show me more');
  });

  it('inherits location but not subject when the follow-up names a new subject', () => {
    const resolved = resolveConversationSearchContext(withPriorContext('what about movie theaters?'));

    expect(resolved.needsClarification).toBe(false);
    expect(resolved.resolvedTaskText).toBe('movie theaters near Arlington Heights IL');
    expect(resolved.context?.answerSubject).toBe('bars');
    expect(resolved.messages.at(-1)?.content).toBe('movie theaters near Arlington Heights IL');
  });

  it('extracts the enriched user task from orchestrator prompts before resolving context', () => {
    const resolved = resolveConversationSearchContext(withPriorContext([
      'Orchestrator task 1 of 1 (single).',
      'Workspace: Research.',
      'Original request: what about closest bars?',
      'Enhanced task prompt: closest bars near Arlington Heights IL',
      'Verification criteria:',
      '- Final answer must contain actual named entities.',
    ].join('\n')));

    expect(resolved.needsClarification).toBe(false);
    expect(resolved.resolvedTaskText).toBe('closest bars near Arlington Heights IL');
    expect(resolved.resolvedTaskText).not.toContain('Orchestrator task');
    expect(resolved.resolvedSubject).toBe('bars');
  });

  it('preserves new modifiers on continuation follow-ups', () => {
    const resolved = resolveConversationSearchContext(withPriorContext('show me more open now'));

    expect(resolved.resolvedTaskText).toBe('open now bars near Arlington Heights IL');
    expect(resolved.requestedCount).toBe(3);
    expect(resolved.messages.at(-1)?.content).toBe('open now bars near Arlington Heights IL');
  });

  it('treats closer-ones as a modifier on the inherited subject', () => {
    const resolved = resolveConversationSearchContext(withPriorContext('closer ones'));

    expect(resolved.needsClarification).toBe(false);
    expect(resolved.resolvedSubject).toBe('bars');
    expect(resolved.resolvedTaskText).toBe('closest bars near Arlington Heights IL');
    expect(resolved.messages.at(-1)?.content).toBe('closest bars near Arlington Heights IL');
  });

  it('treats more-like-number follow-ups as references to the inherited subject', () => {
    const resolved = resolveConversationSearchContext(withPriorContext('more like #1'));

    expect(resolved.needsClarification).toBe(false);
    expect(resolved.resolvedSubject).toBe('bars');
    expect(resolved.resolvedTaskText).toBe('closest bars near Arlington Heights IL');
    expect(resolved.resolvedTaskText).not.toContain('like');
    expect(resolved.messages.at(-1)?.content).toBe('closest bars near Arlington Heights IL');
  });

  it('adds explicit negative constraints to inherited exclusions', () => {
    const resolved = resolveConversationSearchContext(withPriorContext('not Sports Page, show me more'));

    expect(resolved.excludedCandidateNames).toEqual([
      'Sports Page Bar & Grill Arlington Heights',
      'Sports Page',
    ]);
    expect(resolved.messages.at(-1)?.content).toBe('closest bars near Arlington Heights IL');
  });
});
