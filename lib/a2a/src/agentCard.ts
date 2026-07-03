/**
 * agentCard.ts
 *
 * Construction and validation for {@link A2AAgentCard}. `buildAgentCard`
 * validates required fields and throws clear errors; `isA2AAgentCard` is a
 * runtime type guard for untrusted values (e.g. cards received over a wire).
 */

import type { A2AAgentCard, A2ASkill } from './types';

/** Input accepted by {@link buildAgentCard}. */
export interface BuildAgentCardInput {
  id: string;
  name: string;
  version: string;
  skills: A2ASkill[];
  description?: string;
  url?: string;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`A2AAgentCard "${field}" must be a non-empty string`);
  }
  return value;
}

/**
 * Build a validated {@link A2AAgentCard}. Throws when `id`, `name`, or
 * `version` is not a non-empty string, or when `skills` is not an array.
 */
export function buildAgentCard(input: BuildAgentCardInput): A2AAgentCard {
  const id = requireNonEmptyString(input.id, 'id');
  const name = requireNonEmptyString(input.name, 'name');
  const version = requireNonEmptyString(input.version, 'version');

  if (!Array.isArray(input.skills)) {
    throw new Error('A2AAgentCard "skills" must be an array');
  }

  const card: A2AAgentCard = { id, name, version, skills: input.skills };
  if (input.description !== undefined) {
    card.description = input.description;
  }
  if (input.url !== undefined) {
    card.url = input.url;
  }
  return card;
}

/** Runtime type guard for an {@link A2AAgentCard}. */
export function isA2AAgentCard(value: unknown): value is A2AAgentCard {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string') {
    return false;
  }
  if (typeof candidate.name !== 'string') {
    return false;
  }
  if (typeof candidate.version !== 'string') {
    return false;
  }
  if (!Array.isArray(candidate.skills)) {
    return false;
  }
  return true;
}
