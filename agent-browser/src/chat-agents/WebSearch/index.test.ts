import { describe, expect, it } from 'vitest';
import {
  WEB_SEARCH_AGENT_ID,
  buildWebSearchAgentPrompt,
  evaluateWebSearchAgentPrompt,
  selectWebSearchAgentTools,
} from '.';
import type { ToolDescriptor } from '../../tools';

const descriptors: ToolDescriptor[] = [
  {
    id: 'webmcp:search_web',
    label: 'Search web',
    description: 'Search the public web for current results.',
    group: 'built-in',
    groupLabel: 'Built-In',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:read_web_page',
    label: 'Read web page',
    description: 'Read and extract entities from a web page.',
    group: 'built-in',
    groupLabel: 'Built-In',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'cli',
    label: 'CLI',
    description: 'Run shell commands, including curl or node fetch when needed.',
    group: 'built-in',
    groupLabel: 'Built-In',
  },
  {
    id: 'webmcp:elicit_user_input',
    label: 'Elicit user input',
    description: 'Ask the user for missing information.',
    group: 'built-in',
    groupLabel: 'Built-In',
  },
];

describe('Web Search Agent', () => {
  it('is registered as a chat-agent with search and HTTP fallback instructions', () => {
    const prompt = buildWebSearchAgentPrompt({
      task: 'what are the best theaters near me?',
      descriptors,
      location: 'Arlington Heights, IL',
    });

    expect(WEB_SEARCH_AGENT_ID).toBe('web-search-agent');
    expect(prompt).toContain('Role: web-search-agent chat-agent');
    expect(prompt).toContain('webmcp:search_web');
    expect(prompt).toContain('webmcp:read_web_page');
    expect(prompt).toContain('cli');
    expect(prompt).toMatch(/\bcurl\b|\bfetch\b/i);
    expect(prompt).toMatch(/Do not ask the user for a search source/i);
    expect(prompt).toMatch(/source-backed/i);
  });

  it('selects registered search tools first, then curl-capable fallbacks before elicitation', () => {
    expect(selectWebSearchAgentTools(descriptors, 'best theaters near me')).toEqual([
      'webmcp:search_web',
      'webmcp:read_web_page',
      'cli',
    ]);
  });

  it('keeps CLI as the web-search path when no dedicated web search MCP tool is registered', () => {
    expect(selectWebSearchAgentTools(descriptors.filter((descriptor) => !descriptor.id.startsWith('webmcp:')), 'latest docs')).toEqual([
      'cli',
    ]);
  });

  it('passes the agentic eval rubric for effective web search tool use', () => {
    const prompt = buildWebSearchAgentPrompt({
      task: 'best theaters near me',
      descriptors,
      location: 'Arlington Heights, IL',
    });

    expect(evaluateWebSearchAgentPrompt({
      prompt,
      selectedToolIds: selectWebSearchAgentTools(descriptors, 'best theaters near me'),
    })).toEqual({
      passed: true,
      score: 1,
      checks: {
        usesRegisteredSearch: true,
        hasHttpFallback: true,
        readsAndValidatesSources: true,
        avoidsPrematureElicitation: true,
        iteratesQueries: true,
      },
    });
  });
});
