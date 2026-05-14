import { describe, expect, it } from 'vitest';

import { deriveSessionTitle } from './sessionTitles';
import type { ChatMessage } from '../types';

function message(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `${role}:${content}`,
    role,
    content,
  };
}

describe('sessionTitles', () => {
  it('derives a short title from the chat intent instead of keeping numbered session names', () => {
    expect(deriveSessionTitle([
      message('system', 'You are Agent Browser.'),
      message('user', 'Can you investigate why the checkout flow breaks on mobile and summarize the fix?'),
      message('assistant', 'The checkout flow fails because the mobile drawer traps focus.'),
    ])).toBe('Investigate Checkout Flow');
  });

  it('falls back to assistant completion content when a user prompt is not useful', () => {
    expect(deriveSessionTitle([
      message('user', 'help'),
      message('assistant', 'Created a migration plan for workspace session grouping.'),
    ])).toBe('Migration Plan Session Grouping');
  });
});
