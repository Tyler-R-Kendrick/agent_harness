import { describe, expect, it, vi } from 'vitest';

const executeCliCommandMock = vi.fn();
const runLocalWebResearchAgentMock = vi.fn();

vi.mock('./cli/exec', () => ({
  executeCliCommand: (...args: unknown[]) => executeCliCommandMock(...args),
}));

vi.mock('../chat-agents/LocalWebResearch', () => ({
  LOCAL_WEB_RESEARCH_AGENT_ID: 'local-web-research-agent',
  LOCAL_WEB_RESEARCH_AGENT_LABEL: 'Local Web Research Agent',
  LOCAL_WEB_RESEARCH_TOOL_ID: 'webmcp:local_web_research',
  runLocalWebResearchAgent: (...args: unknown[]) => runLocalWebResearchAgentMock(...args),
}));


import { DEFAULT_TOOL_DESCRIPTORS, buildDefaultToolInstructions, buildToolGroupDescriptors, createDefaultTools, selectToolDescriptorsByIds, selectToolsByIds } from './index';
import type { TerminalExecutorContext } from './types';

function createContext(): TerminalExecutorContext {
  return {
    appendSharedMessages: vi.fn(),
    getSessionBash: vi.fn(() => ({
      exec: vi.fn(),
      fs: { getAllPaths: vi.fn(() => []) },
    })),
    notifyTerminalFsPathsChanged: vi.fn(),
    sessionId: 'session-1',
    setBashHistoryBySession: vi.fn(),
    setCwdBySession: vi.fn(),
  } as unknown as TerminalExecutorContext;
}

describe('default tools', () => {
  it('builds tool instructions for the active workspace', () => {
    const instructions = buildDefaultToolInstructions({
      workspaceName: 'Research',
      workspacePromptContext: 'Workspace instructions.',
      selectedToolIds: ['cli'],
    });
    expect(instructions).toContain('Active workspace: Research');
    expect(instructions).toContain('//session-1-fs/workspace');
    expect(instructions).toContain('Selected tool ids: cli');
  });

  it('includes built-in CLI and local web research descriptors', () => {
    expect(DEFAULT_TOOL_DESCRIPTORS.map((descriptor) => descriptor.id)).toEqual([
      'cli',
      'webmcp:local_web_research',
    ]);
    expect(DEFAULT_TOOL_DESCRIPTORS[0]).toMatchObject({ id: 'cli', group: 'built-in' });
    expect(DEFAULT_TOOL_DESCRIPTORS[1]).toMatchObject({
      id: 'webmcp:local_web_research',
      group: 'web-search-mcp',
      subGroup: 'web-search-mcp',
    });
  });

  it('creates CLI and local web research tools that delegate to their runtimes', async () => {
    const context = createContext();
    const tools = createDefaultTools(context);

    executeCliCommandMock.mockResolvedValueOnce({ exitCode: 0 });
    await tools.cli.execute?.({ command: 'pwd' }, {} as never);
    runLocalWebResearchAgentMock.mockResolvedValueOnce({ searchResults: [], evidence: [], citations: [], errors: [] });
    await tools['webmcp:local_web_research'].execute?.({
      question: 'local web search agents',
      maxSearchResults: 6,
      maxPagesToExtract: 2,
      maxEvidenceChunks: 4,
      synthesize: false,
      searchProviderName: 'perplexity',
      perplexityApiKey: 'secret-ref://local/perplexity-key',
    }, {} as never);

    expect(executeCliCommandMock).toHaveBeenCalledWith(context, 'pwd', { emitMessages: false });
    expect(runLocalWebResearchAgentMock).toHaveBeenCalledWith('local web search agents', {
      maxSearchResults: 6,
      maxPagesToExtract: 2,
      maxEvidenceChunks: 4,
      synthesize: false,
      searchProviderName: 'perplexity',
      perplexityApiKey: 'secret-ref://local/perplexity-key',
    });
  });

  it('filters tool sets and descriptors by selected ids', () => {
    const filteredTools = selectToolsByIds({ cli: { execute: vi.fn() }, other: { execute: vi.fn() } } as never, ['cli']);
    const filteredDescriptors = selectToolDescriptorsByIds([
      ...DEFAULT_TOOL_DESCRIPTORS,
      {
        id: 'read_session_file',
        label: 'Read session file',
        description: 'Read a file.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'files-worktree-mcp',
        subGroupLabel: 'Files',
      },
    ], ['read_session_file']);

    expect(Object.keys(filteredTools)).toEqual(['cli']);
    expect(filteredDescriptors.map((descriptor) => descriptor.id)).toEqual(['read_session_file']);
  });

  it('builds group descriptors from top-level and subgroup tool metadata', () => {
    const groups = buildToolGroupDescriptors([
      ...DEFAULT_TOOL_DESCRIPTORS,
      {
        id: 'read_session_file',
        label: 'Read session file',
        description: 'Read a file.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'files-worktree-mcp',
        subGroupLabel: 'Files',
      },
    ]);

    expect(groups).toEqual([
      expect.objectContaining({ id: 'built-in', label: 'Built-In', toolIds: ['cli'] }),
      expect.objectContaining({ id: 'files-worktree-mcp', label: 'Files', toolIds: ['read_session_file'] }),
      expect.objectContaining({ id: 'web-search-mcp', label: 'Search', toolIds: ['webmcp:local_web_research'] }),
    ]);
  });
});
