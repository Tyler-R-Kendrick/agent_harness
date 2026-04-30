import { describe, expect, it, vi } from 'vitest';
import type { ToolSet } from 'ai';
import { resolveExecutionRequirements } from './executionRequirements';
import type { ToolAgentRuntime, ToolPlan } from '../tool-agents/tool-agent';
import type { ToolDescriptor } from '../tools';

const descriptors: ToolDescriptor[] = [
  {
    id: 'webmcp:search_web',
    label: 'Search web',
    description: 'Search the public web for current and local facts.',
    group: 'built-in',
    groupLabel: 'Built-In',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:read_web_page',
    label: 'Read web page',
    description: 'Read result pages and extract named entity evidence.',
    group: 'built-in',
    groupLabel: 'Built-In',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'cli',
    label: 'CLI',
    description: 'Run curl, node fetch, or shell commands.',
    group: 'built-in',
    groupLabel: 'Built-In',
  },
];

function plan(selectedToolIds = descriptors.map((descriptor) => descriptor.id)): ToolPlan {
  return {
    version: 1,
    goal: 'best movie theaters in Arlington Heights IL',
    selectedToolIds,
    steps: [],
    createdToolFiles: [],
    actorToolAssignments: {
      executor: selectedToolIds,
    },
  };
}

describe('resolveExecutionRequirements web search fallback', () => {
  it('uses a curl-capable CLI fallback before blocking when the registered search tool is unavailable', async () => {
    const search = vi.fn(async ({ query }) => ({
      status: 'unavailable',
      query,
      reason: 'Web search returned 404.',
      results: [],
    }));
    const cli = vi.fn(async () => JSON.stringify({
      status: 'found',
      query: 'movie theaters names near Arlington Heights IL',
      results: [{
        title: 'AMC Randhurst 12',
        url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
        snippet: 'Movie theater in Mount Prospect near Arlington Heights, IL.',
      }],
    }));
    const readPage = vi.fn(async ({ url }) => ({
      status: 'read',
      url,
      title: 'AMC Randhurst 12',
      text: 'AMC Randhurst 12 is a movie theater in Mount Prospect near Arlington Heights, IL.',
      links: [],
      jsonLd: [{ '@type': 'MovieTheater', name: 'AMC Randhurst 12', url }],
      entities: [{ name: 'AMC Randhurst 12', url, evidence: 'json-ld' }],
      observations: [],
    }));
    const runtime: ToolAgentRuntime = {
      descriptors,
      tools: {
        'webmcp:search_web': { execute: search },
        'webmcp:read_web_page': { execute: readPage },
        cli: { execute: cli },
      } as unknown as ToolSet,
    };

    const result = await resolveExecutionRequirements({
      runtime,
      plan: plan(),
      messages: [{ role: 'user', content: 'what are the best movie theaters in Arlington Heights IL?' }],
      callbacks: {},
    });

    expect(result.status).toBe('fulfilled');
    if (result.status !== 'fulfilled') {
      throw new Error(`Expected fulfilled search fallback, got ${result.status}.`);
    }
    expect(search).toHaveBeenCalled();
    expect(cli).toHaveBeenCalledWith(
      expect.objectContaining({ command: expect.stringMatching(/\b(?:curl|fetch)\b/i) }),
    );
    expect(result.result.text).toContain('AMC Randhurst 12');
    expect(result.result.needsUserInput).not.toBe(true);
  });
});
