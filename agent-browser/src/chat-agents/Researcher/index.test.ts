import { describe, expect, it } from 'vitest';
import {
  buildResearcherOperatingInstructions,
  buildResearcherSystemPrompt,
  buildResearcherToolInstructions,
  createResearchTaskRecord,
  getResearchArtifactPath,
  getResearchArtifactRoot,
  inferResearchToolHints,
  isResearchTaskText,
  normalizeResearchTaskId,
  rankResearchSources,
  renderResearchTaskMarkdown,
  resolveResearchConflict,
  scoreResearchSource,
} from './index';

describe('researcher', () => {
  it('builds first-class Researcher operating instructions', () => {
    const instructions = buildResearcherOperatingInstructions();

    expect(instructions).toContain('# Researcher');
    expect(instructions).toContain('## Purpose');
    expect(instructions).toContain('Use whichever research tools are currently available');
    expect(instructions).toContain('Persist reusable research output under `.research/<task-id>/research.md`.');
  });

  it('detects research tasks and builds Researcher prompts for chat and tools', () => {
    expect(isResearchTaskText('Research browser automation options with citations.')).toBe(true);
    expect(isResearchTaskText('Please fact-check this claim with evidence.')).toBe(true);
    expect(isResearchTaskText('Say hello.')).toBe(false);

    const systemPrompt = buildResearcherSystemPrompt({ workspaceName: 'Research' });
    expect(systemPrompt).toContain('Active workspace: Research');
    expect(systemPrompt).toContain('## Researcher Operating Instructions');
    expect(systemPrompt).toContain('Persist reusable research output under `.research/<task-id>/research.md`.');

    const toolPrompt = buildResearcherToolInstructions({
      workspaceName: 'Research',
      workspacePromptContext: 'Workspace rules.',
      descriptors: [{ id: 'web-search', label: 'Web search', description: 'Search the web.' }],
      selectedToolIds: ['web-search'],
    });
    expect(toolPrompt).toContain('## Tool Instructions');
    expect(toolPrompt).toContain('Selected tool ids: web-search');
    expect(toolPrompt).toContain('Search the web.');
  });

  it('creates deterministic research task artifacts with tool capability hints', () => {
    const task = createResearchTaskRecord({
      taskId: 'Browser Automation 2026',
      topic: 'Browser automation options',
      toolIds: ['cli', 'browser_navigate', 'web-search', 'docs.search'],
      now: '2026-04-24T00:00:00.000Z',
    });

    expect(task).toEqual(expect.objectContaining({
      taskId: 'browser-automation-2026',
      topic: 'Browser automation options',
      artifactRoot: '.research/browser-automation-2026',
      artifactPath: '.research/browser-automation-2026/research.md',
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
    }));
    expect(task.toolHints).toEqual(['curl-or-cli', 'browser-use', 'web-search', 'mcp-docs']);
  });

  it('normalizes empty task ids and de-duplicates inferred tool hints', () => {
    expect(normalizeResearchTaskId(' !!! ')).toBe('research-task');
    expect(getResearchArtifactRoot(' !!! ')).toBe('.research/research-task');
    expect(getResearchArtifactPath(' !!! ')).toBe('.research/research-task/research.md');
    expect(inferResearchToolHints([
      'cli',
      'curl',
      'browser_page',
      'search_web',
      'fetch_url',
      'docs.reference',
      'unknown-tool',
    ])).toEqual(['curl-or-cli', 'browser-use', 'web-search', 'web-scrape', 'mcp-docs']);
  });

  it('scores and ranks authoritative recent sources above weaker sources', () => {
    const official = scoreResearchSource({
      title: 'Official browser automation docs',
      domain: 'playwright.dev',
      url: 'https://playwright.dev/docs/intro',
      sourceType: 'official',
      evidence: 'Official API reference and maintained documentation.',
      publishedAt: '2026-04-01T00:00:00.000Z',
      retrievedAt: '2026-04-24T00:00:00.000Z',
    }, '2026-04-24T00:00:00.000Z');
    const forum = scoreResearchSource({
      title: 'Old forum comparison',
      domain: 'forum.example.com',
      sourceType: 'community',
      evidence: 'Anecdotal report without citations.',
      publishedAt: '2021-01-01T00:00:00.000Z',
      retrievedAt: '2026-04-24T00:00:00.000Z',
    }, '2026-04-24T00:00:00.000Z');

    expect(official.qualityScore).toBeGreaterThan(forum.qualityScore);
    expect(rankResearchSources([forum, official]).map((source) => source.title)).toEqual([
      'Official browser automation docs',
      'Old forum comparison',
    ]);
  });

  it('covers source quality scoring branches for source type, recency, provenance, and evidence', () => {
    const now = '2026-04-24T00:00:00.000Z';
    const sourceTypes = ['primary', 'standard', 'documentation', 'analysis', 'community', undefined] as const;
    const scores = sourceTypes.map((sourceType, index) => scoreResearchSource({
      title: `Source ${index}`,
      domain: index % 2 === 0 ? 'docs.example.com' : '',
      sourceType,
      evidence: index % 2 === 0 ? 'Detailed evidence with enough supporting context.' : 'short',
      publishedAt: ['2026-04-10T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2025-05-01T00:00:00.000Z', '2023-01-01T00:00:00.000Z', undefined, 'not-a-date'][index],
      retrievedAt: index === 4 ? '2026-04-20T00:00:00.000Z' : undefined,
    }, now));

    expect(scores.map((source) => source.sourceType)).toEqual(['primary', 'standard', 'documentation', 'analysis', 'community', 'unknown']);
    expect(scores[0].qualityScore).toBeGreaterThan(scores[3].qualityScore);
    expect(scores[4].qualityScore).toBeGreaterThan(scores[5].qualityScore);

    const capped = scoreResearchSource({
      title: 'High confidence source',
      domain: 'docs.example.com',
      url: 'https://docs.example.com',
      sourceType: 'official',
      evidence: 'Detailed evidence with enough supporting context.',
      publishedAt: '2026-04-24T00:00:00.000Z',
      retrievedAt: '2026-04-24T00:00:00.000Z',
    }, now);
    expect(capped.qualityScore).toBe(1);
  });

  it('uses publication time, retrieved time, and title as deterministic ranking tie breakers', () => {
    const alpha = scoreResearchSource({
      title: 'Alpha',
      domain: 'docs.example.com',
      sourceType: 'official',
      evidence: 'Detailed evidence with enough supporting context.',
      retrievedAt: '2026-04-22T00:00:00.000Z',
    }, 'invalid-date');
    const beta = { ...alpha, title: 'Beta' };
    const newer = { ...alpha, title: 'Newer', publishedAt: '2026-04-23T00:00:00.000Z' };
    const older = { ...alpha, title: 'Older', publishedAt: '2026-04-20T00:00:00.000Z' };

    expect(rankResearchSources([beta, alpha]).map((source) => source.title)).toEqual(['Alpha', 'Beta']);
    expect(rankResearchSources([older, newer]).map((source) => source.title)).toEqual(['Newer', 'Older']);
  });

  it('resolves conflicts by quality first and recency as a tie breaker', () => {
    const official = scoreResearchSource({
      title: 'Official changelog correction',
      domain: 'example.com',
      url: 'https://example.com/changelog',
      sourceType: 'official',
      evidence: 'Corrects the previous limit.',
      publishedAt: '2026-04-20T00:00:00.000Z',
      retrievedAt: '2026-04-24T00:00:00.000Z',
    }, '2026-04-24T00:00:00.000Z');
    const blog = scoreResearchSource({
      title: 'Older implementation note',
      domain: 'engineering.example.com',
      url: 'https://engineering.example.com/old-note',
      sourceType: 'analysis',
      evidence: 'Mentions the previous limit.',
      publishedAt: '2026-01-01T00:00:00.000Z',
      retrievedAt: '2026-04-24T00:00:00.000Z',
    }, '2026-04-24T00:00:00.000Z');

    const qualityResolution = resolveResearchConflict({
      claim: 'Browser automation limit',
      sources: [blog, official],
    });

    expect(qualityResolution.selectedSource.title).toBe('Official changelog correction');
    expect(qualityResolution.reason).toContain('higher source quality');

    const newer = scoreResearchSource({
      title: 'Newer release note',
      domain: 'docs.example.com',
      sourceType: 'official',
      evidence: 'Latest release note.',
      publishedAt: '2026-04-22T00:00:00.000Z',
      retrievedAt: '2026-04-24T00:00:00.000Z',
    }, '2026-04-24T00:00:00.000Z');
    const older = scoreResearchSource({
      title: 'Older release note',
      domain: 'docs.example.com',
      sourceType: 'official',
      evidence: 'Previous release note.',
      publishedAt: '2026-04-21T00:00:00.000Z',
      retrievedAt: '2026-04-24T00:00:00.000Z',
    }, '2026-04-24T00:00:00.000Z');

    const recencyResolution = resolveResearchConflict({
      claim: 'Same-quality release detail',
      sources: [older, newer],
    });

    expect(recencyResolution.selectedSource.title).toBe('Newer release note');
    expect(recencyResolution.reason).toContain('more recent');
  });

  it('rejects conflict resolution without sources', () => {
    expect(() => resolveResearchConflict({ claim: 'Unsupported claim', sources: [] })).toThrow('without sources');
  });

  it('renders markdown research artifacts with citations and conflict decisions', () => {
    const source = scoreResearchSource({
      title: 'Official docs',
      domain: 'docs.example.com',
      url: 'https://docs.example.com/research',
      sourceType: 'official',
      evidence: 'Primary reference for the researched behavior.',
      publishedAt: '2026-04-22T00:00:00.000Z',
      retrievedAt: '2026-04-24T00:00:00.000Z',
    }, '2026-04-24T00:00:00.000Z');
    const task = createResearchTaskRecord({
      taskId: 'Docs Research',
      topic: 'Docs research',
      toolIds: ['web-search'],
      sources: [source],
      conflicts: [resolveResearchConflict({ claim: 'Docs behavior', sources: [source] })],
      now: '2026-04-24T00:00:00.000Z',
    });

    const markdown = renderResearchTaskMarkdown(task);

    expect(markdown).toContain('# Research: Docs research');
    expect(markdown).toContain('Artifact path: `.research/docs-research/research.md`');
    expect(markdown).toContain('- [Official docs](https://docs.example.com/research)');
    expect(markdown).toContain('quality:');
    expect(markdown).toContain('## Conflict Resolutions');
    expect(markdown).toContain('Docs behavior');
  });

  it('renders empty research artifacts without citations', () => {
    const markdown = renderResearchTaskMarkdown(createResearchTaskRecord({
      taskId: 'Empty',
      topic: 'Empty research',
      now: '2026-04-24T00:00:00.000Z',
    }));

    expect(markdown).toContain('- No specific tool capabilities detected.');
    expect(markdown).toContain('- No sources recorded yet.');
    expect(markdown).toContain('- No conflicts recorded yet.');
  });
});
