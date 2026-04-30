import { describe, expect, it, vi } from 'vitest';
import {
  RDF_SEMANTIC_SEARCH_TOOL_ID,
  RDF_WEB_SEARCH_AGENT_ID,
  buildRdfWebSearchAgentPrompt,
  buildWikidataClassInstancesQuery,
  buildWikidataEntitySearchQuery,
  buildWikidataFactsQuery,
  checkWikidataHealth,
  classifySemanticSearchIntent,
  escapeSparqlString,
  evaluateRdfWebSearchAgentPolicy,
  normalizeWikidataEntityResults,
  rankSemanticSearchResults,
  runRdfWebSearchAgent,
  selectRdfWebSearchAgentTools,
} from '.';
import type { ToolDescriptor } from '../../tools';

const descriptors: ToolDescriptor[] = [
  {
    id: 'webmcp:semantic_search',
    label: 'Semantic search',
    description: 'Search RDF and SPARQL endpoints with checked query templates.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:search_web',
    label: 'Search web',
    description: 'Search the public web.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:elicit_user_input',
    label: 'Elicit user input',
    description: 'Ask the user for missing input.',
    group: 'built-in',
    groupLabel: 'Built-In',
  },
];

describe('RDF Web Search Agent', () => {
  it('classifies semantic intents and builds safe Wikidata templates', () => {
    expect(classifySemanticSearchIntent('facts for Q42')).toEqual({
      kind: 'qidFacts',
      qid: 'Q42',
      text: 'facts for Q42',
      limit: 10,
    });
    expect(classifySemanticSearchIntent('instances of Q5 limit 7')).toEqual({
      kind: 'classInstances',
      qid: 'Q5',
      text: 'instances of Q5 limit 7',
      limit: 7,
    });
    expect(classifySemanticSearchIntent('Azure OpenAI Service')).toMatchObject({
      kind: 'entitySearch',
      text: 'Azure OpenAI Service',
      limit: 10,
    });
    expect(escapeSparqlString('Ada "Lovelace" \\ test')).toBe('Ada \\"Lovelace\\" \\\\ test');
    expect(buildWikidataFactsQuery({ qid: 'Q42', limit: 3 })).toContain('wd:Q42');
    expect(buildWikidataFactsQuery({ qid: 'Q42', limit: 50 })).toContain('LIMIT 25');
    expect(() => buildWikidataFactsQuery({ qid: 'not-qid' })).toThrow(/Invalid Wikidata QID/);
    expect(buildWikidataClassInstancesQuery({ qid: 'Q5', limit: 3 })).toContain('wdt:P31/wdt:P279* wd:Q5');
    expect(buildWikidataEntitySearchQuery({ text: 'Ada Lovelace', limit: 3 })).toContain('mwapi:search "Ada Lovelace"');
  });

  it('normalizes and ranks Wikidata results deterministically', () => {
    const normalized = normalizeWikidataEntityResults({
      head: { vars: ['item', 'itemLabel', 'itemDescription'] },
      results: {
        bindings: [
          {
            item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q7259' },
            itemLabel: { type: 'literal', value: 'Ada Lovelace' },
            itemDescription: { type: 'literal', value: 'English mathematician and writer' },
          },
          {
            item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q1' },
            itemLabel: { type: 'literal', value: 'Universe' },
          },
        ],
      },
    });

    const ranked = rankSemanticSearchResults({
      question: 'Ada Lovelace mathematician',
      results: normalized,
    });

    expect(ranked[0]).toMatchObject({
      id: 'Q7259',
      title: 'Ada Lovelace',
      source: 'wikidata',
      sourceName: 'Wikidata',
      url: 'https://www.wikidata.org/wiki/Q7259',
    });
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('runs against an injected SPARQL fetcher and returns structured errors', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      head: { vars: ['item', 'itemLabel', 'itemDescription'] },
      results: {
        bindings: [{
          item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q7259' },
          itemLabel: { type: 'literal', value: 'Ada Lovelace' },
          itemDescription: { type: 'literal', value: 'English mathematician and writer' },
        }],
      },
    }), { status: 200 }));

    await expect(runRdfWebSearchAgent('Ada Lovelace', { fetchImpl })).resolves.toMatchObject({
      query: 'Ada Lovelace',
      endpointId: 'wikidata',
      results: [expect.objectContaining({ id: 'Q7259', title: 'Ada Lovelace' })],
      errors: [],
    });

    await expect(runRdfWebSearchAgent('facts for Q42', {
      fetchImpl: vi.fn(async () => new Response('bad gateway', { status: 502, statusText: 'Bad Gateway' })) as never,
    })).resolves.toMatchObject({
      results: [],
      errors: [expect.objectContaining({ message: expect.stringContaining('HTTP 502') })],
    });
  });

  it('checks endpoint health without requiring generated control flow', async () => {
    const health = await checkWikidataHealth({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({
        head: { vars: ['answer'] },
        results: { bindings: [{ answer: { type: 'literal', value: 'true' } }] },
      }), { status: 200 })),
    });

    expect(health).toMatchObject({
      endpointId: 'wikidata',
      ok: true,
    });
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('selects the semantic search tool and passes the static AgentEvals policy rubric', () => {
    const selectedToolIds = selectRdfWebSearchAgentTools(descriptors, 'facts for Q42');
    const prompt = buildRdfWebSearchAgentPrompt({
      task: 'facts for Q42',
      descriptors,
    });

    expect(RDF_WEB_SEARCH_AGENT_ID).toBe('rdf-web-search-agent');
    expect(RDF_SEMANTIC_SEARCH_TOOL_ID).toBe('webmcp:semantic_search');
    expect(selectedToolIds).toEqual(['webmcp:semantic_search']);
    expect(prompt).toContain('safe SPARQL templates');
    expect(prompt).toContain('fan-in merge');
    expect(evaluateRdfWebSearchAgentPolicy({ prompt, selectedToolIds })).toEqual({
      passed: true,
      score: 1,
      checks: {
        usesSemanticTool: true,
        usesSafeTemplates: true,
        citesSources: true,
        handlesEndpointFailure: true,
        participatesInFanIn: true,
      },
    });
  });
});
