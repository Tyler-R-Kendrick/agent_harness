import { describe, expect, it } from 'vitest';
import {
  canAnswerFromSourceResults,
  composeSourceResultAnswer,
  formatUnavailableSearchMessage,
  isDirectSourceSearchIntent,
} from '../sourceResults';
import type { DirectSourceSearchIntent, SourceSearchResult } from '../types';

function intent(overrides: Partial<DirectSourceSearchIntent> = {}): DirectSourceSearchIntent {
  return {
    currentTaskText: 'latest OpenAI Responses API tool calling docs',
    subject: 'openai responses api tool calling docs',
    externalSearchRequired: true,
    locationRequired: false,
    validationConstraints: [],
    ...overrides,
  };
}

function foundSearchResult(overrides: Partial<SourceSearchResult> = {}): SourceSearchResult {
  return {
    status: 'found',
    query: 'OpenAI Responses API tool calling docs',
    results: [{
      title: 'OpenAI Responses API tool calling guide',
      url: 'https://platform.openai.com/docs/guides/tools',
      snippet: 'The OpenAI Responses API guide documents tool calling.',
    }],
    ...overrides,
  };
}

describe('isDirectSourceSearchIntent', () => {
  it('accepts current documentation and update lookups that do not need entity-list validation', () => {
    expect(isDirectSourceSearchIntent(intent())).toBe(true);
    expect(isDirectSourceSearchIntent(intent({
      currentTaskText: 'current NASA Mars Sample Return mission update',
      rankingGoal: 'current',
    }))).toBe(true);
    expect(isDirectSourceSearchIntent(intent({
      currentTaskText: 'official NASA mission reference',
      rankingGoal: 'recommended',
      validationConstraints: [{ type: 'source_evidence' }],
    }))).toBe(true);
    expect(isDirectSourceSearchIntent(intent({
      currentTaskText: 'what is the official OpenAI API status page',
      validationConstraints: undefined,
    }))).toBe(true);
  });

  it('rejects prompts that need entity-list validation or are not external source lookups', () => {
    const rejections: Partial<DirectSourceSearchIntent>[] = [
      { externalSearchRequired: false },
      { locationRequired: true },
      { requestedCount: 3 },
      { rankingGoal: 'best' },
      { validationConstraints: [{ type: 'count' }] },
      { currentTaskText: 'summarize the existing workspace notes' },
    ];

    for (const rejected of rejections) {
      expect(isDirectSourceSearchIntent(intent(rejected))).toBe(false);
    }
  });
});

describe('canAnswerFromSourceResults', () => {
  it('requires a direct source intent with at least one found result', () => {
    expect(canAnswerFromSourceResults({
      intent: intent(),
      searchResult: foundSearchResult(),
    })).toBe(true);
    expect(canAnswerFromSourceResults({
      intent: intent({ requestedCount: 2 }),
      searchResult: foundSearchResult(),
    })).toBe(false);
    expect(canAnswerFromSourceResults({
      intent: intent(),
      searchResult: foundSearchResult({ status: 'empty', results: [] }),
    })).toBe(false);
    expect(canAnswerFromSourceResults({
      intent: intent(),
      searchResult: foundSearchResult({ results: [] }),
    })).toBe(false);
  });
});

describe('composeSourceResultAnswer', () => {
  it('renders top source results with snippets and safe truncation', () => {
    const answer = composeSourceResultAnswer({
      subject: 'OpenAI Responses API tool calling docs',
      results: [
        foundSearchResult().results[0],
        {
          title: 'OpenAI function calling guide',
          url: 'https://platform.openai.com/docs/guides/function-calling',
          snippet: 'Function calling docs.',
        },
        {
          title: 'OpenAI built-in tools',
          url: 'https://platform.openai.com/docs/guides/tools',
          snippet: 'Built-in tools docs.',
        },
        {
          title: 'OpenAI archived tools',
          url: 'https://platform.openai.com/docs/archived',
          snippet: 'This fourth result is intentionally hidden.',
        },
      ],
      limit: 3,
      maxSnippetLength: 48,
    });

    expect(answer).toContain('Here are web results for OpenAI Responses API tool calling docs:');
    expect(answer).toContain('1. [OpenAI Responses API tool calling guide](https://platform.openai.com/docs/guides/tools)');
    expect(answer).toContain('3. [OpenAI built-in tools](https://platform.openai.com/docs/guides/tools) - Built-in tools docs.');
    expect(answer).not.toContain('OpenAI archived tools');
  });

  it('omits empty snippets and handles empty result sets explicitly', () => {
    expect(composeSourceResultAnswer({
      subject: 'NASA updates',
      results: [{ title: 'NASA', url: 'https://www.nasa.gov/', snippet: '' }],
    })).toBe('Here are web results for NASA updates:\n\n1. [NASA](https://www.nasa.gov/)');
    expect(composeSourceResultAnswer({ subject: 'NASA updates', results: [] }))
      .toBe('I could not find search results for NASA updates.');
  });

  it('escapes markdown delimiters in source result labels and preserves URL parentheses', () => {
    expect(composeSourceResultAnswer({
      subject: 'OpenAI docs',
      results: [{
        title: 'OpenAI [beta] docs',
        url: 'https://example.test/search?q=tools(v2)&ref=docs',
        snippet: 'Updated docs with\nline breaks.',
      }],
    })).toBe(
      'Here are web results for OpenAI docs:\n\n'
      + '1. [OpenAI \\[beta\\] docs](<https://example.test/search?q=tools(v2)&ref=docs>) - Updated docs with line breaks.',
    );
  });
});

describe('formatUnavailableSearchMessage', () => {
  it('formats unavailable search results with optional location and issue details', () => {
    expect(formatUnavailableSearchMessage({
      answerSubject: 'restaurants',
      location: 'Arlington Heights, IL',
      reason: 'Search provider unavailable.',
    })).toBe('Web search is unavailable for restaurants near Arlington Heights, IL.\nSearch issue: Search provider unavailable.');
    expect(formatUnavailableSearchMessage({ answerSubject: 'OpenAI docs' }))
      .toBe('Web search is unavailable for OpenAI docs.');
  });
});
