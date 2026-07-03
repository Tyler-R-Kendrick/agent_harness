import { describe, expect, it } from 'vitest';

import { buildAgentCard, isA2AAgentCard, type BuildAgentCardInput } from '../agentCard';
import type { A2AAgentCard } from '../types';

const validInput: BuildAgentCardInput = {
  id: 'researcher',
  name: 'Researcher',
  version: '1.0.0',
  skills: [{ id: 'search', name: 'Web search' }],
};

describe('buildAgentCard', () => {
  it('builds a card including optional description and url', () => {
    const card = buildAgentCard({
      ...validInput,
      description: 'Runs research tasks',
      url: 'https://example.test/agents/researcher',
    });

    expect(card).toEqual({
      id: 'researcher',
      name: 'Researcher',
      version: '1.0.0',
      skills: [{ id: 'search', name: 'Web search' }],
      description: 'Runs research tasks',
      url: 'https://example.test/agents/researcher',
    });
  });

  it('builds a minimal card without optional fields', () => {
    const card = buildAgentCard(validInput);

    expect(card).toEqual({
      id: 'researcher',
      name: 'Researcher',
      version: '1.0.0',
      skills: [{ id: 'search', name: 'Web search' }],
    });
    expect('description' in card).toBe(false);
    expect('url' in card).toBe(false);
  });

  it('throws when id is not a string', () => {
    expect(() =>
      buildAgentCard({ ...validInput, id: 123 } as unknown as BuildAgentCardInput),
    ).toThrow(/"id" must be a non-empty string/);
  });

  it('throws when name is an empty string', () => {
    expect(() => buildAgentCard({ ...validInput, name: '' })).toThrow(
      /"name" must be a non-empty string/,
    );
  });

  it('throws when version is only whitespace', () => {
    expect(() => buildAgentCard({ ...validInput, version: '   ' })).toThrow(
      /"version" must be a non-empty string/,
    );
  });

  it('throws when skills is not an array', () => {
    expect(() =>
      buildAgentCard({ ...validInput, skills: 'nope' } as unknown as BuildAgentCardInput),
    ).toThrow(/"skills" must be an array/);
  });
});

describe('isA2AAgentCard', () => {
  it('returns true for a well-formed card', () => {
    const card: A2AAgentCard = {
      id: 'a',
      name: 'A',
      version: '1.0.0',
      skills: [],
    };
    expect(isA2AAgentCard(card)).toBe(true);
  });

  it('returns false for non-object and null values', () => {
    expect(isA2AAgentCard('not-a-card')).toBe(false);
    expect(isA2AAgentCard(null)).toBe(false);
  });

  it('returns false when required fields are missing or wrong-typed', () => {
    expect(isA2AAgentCard({ name: 'A', version: '1', skills: [] })).toBe(false);
    expect(isA2AAgentCard({ id: 'a', version: '1', skills: [] })).toBe(false);
    expect(isA2AAgentCard({ id: 'a', name: 'A', skills: [] })).toBe(false);
    expect(isA2AAgentCard({ id: 'a', name: 'A', version: '1', skills: 'x' })).toBe(false);
  });
});
