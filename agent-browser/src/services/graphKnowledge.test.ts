import { describe, expect, it } from 'vitest';
import {
  buildGraphKnowledgeContextPack,
  consolidateGraphKnowledge,
  createEmptyGraphKnowledgeState,
  exportGraphKnowledge,
  getGraphKnowledgeStats,
  importGraphKnowledge,
  ingestGraphKnowledgeSession,
  ingestGraphKnowledgeSkill,
  ingestGraphKnowledgeText,
  isGraphKnowledgeState,
  loadSampleGraphKnowledge,
  promoteGraphKnowledgeToHotMemory,
  searchGraphKnowledge,
} from './graphKnowledge';

describe('graphKnowledge', () => {
  it('loads sample GraphRAG memory with all three tiers and typed schema coverage', () => {
    const state = loadSampleGraphKnowledge('2026-05-08T00:00:00.000Z');
    const stats = getGraphKnowledgeStats(state);

    expect(stats.status).toBe('offline-ready');
    expect(stats.hotMemoryBlocks).toBeGreaterThanOrEqual(3);
    expect(stats.graphNodes).toBeGreaterThan(20);
    expect(stats.graphEdges).toBeGreaterThan(20);
    expect(stats.archiveRecords).toBeGreaterThanOrEqual(2);
    expect(stats.skillCount).toBeGreaterThanOrEqual(2);
    expect(state.schema.nodeCategories).toContain('HotMemoryBlock');
    expect(state.schema.relationshipTypes).toContain('PATH_INCLUDES');
  });

  it('retrieves lexical, entity, path, activation, community, temporal, and procedural results with score breakdowns', () => {
    const state = loadSampleGraphKnowledge('2026-05-08T00:00:00.000Z');
    const result = searchGraphKnowledge(state, 'How does Kuzu-WASM improve offline PathRAG retrieval for agents?');

    expect(result.entities.map((entity) => entity.canonicalName)).toContain('Kuzu-WASM');
    expect(result.hotMemoryBlocks.map((block) => block.name)).toContain('active_projects');
    expect(result.claims.some((claim) => claim.text.includes('Path-based retrieval'))).toBe(true);
    expect(result.paths[0].explanation).toMatch(/matched query seed/i);
    expect(result.activation[0].scoreBreakdown.activationScore).toBeGreaterThan(0);
    expect(result.communities.map((community) => community.name)).toContain('Offline graph memory');
    expect(result.skills.map((skill) => skill.name)).toContain('Build offline WASM graph app');
    expect(result.temporalCaveats.some((caveat) => caveat.includes('observed'))).toBe(true);
    expect(result.scoreBreakdowns[0]).toHaveProperty('lexicalScore');
  });

  it('ingests text, sessions, and skills into persistent local graph memory', () => {
    let state = createEmptyGraphKnowledgeState('2026-05-08T00:00:00.000Z');
    state = ingestGraphKnowledgeText(state, {
      title: 'Browser memory note',
      text: 'Kuzu-WASM enables local graph traversal. PathRAG improves explainability for agent memory.',
      source: 'manual paste',
      now: '2026-05-08T01:00:00.000Z',
    });
    state = ingestGraphKnowledgeSession(state, {
      title: 'Design review',
      turns: [
        { role: 'user', text: 'We need offline graph persistence.' },
        { role: 'assistant', text: 'Use IndexedDB, a worker boundary, and compact hot memory.' },
      ],
      now: '2026-05-08T01:05:00.000Z',
    });
    state = ingestGraphKnowledgeSkill(state, {
      name: 'Debug worker persistence',
      description: 'Use exported state, storage validation, and reset recovery when worker persistence fails.',
      steps: ['Export state', 'Validate JSON', 'Reset only after backup'],
      tools: ['IndexedDB inspector', 'Vitest'],
      now: '2026-05-08T01:10:00.000Z',
    });

    const stats = getGraphKnowledgeStats(state);
    const result = searchGraphKnowledge(state, 'offline graph persistence worker skill');

    expect(stats.documentCount).toBe(1);
    expect(stats.sessionCount).toBe(1);
    expect(stats.skillCount).toBe(1);
    expect(result.entities.map((entity) => entity.canonicalName)).toContain('Kuzu-WASM');
    expect(result.skills.map((skill) => skill.name)).toContain('Debug worker persistence');
    expect(result.evidence.some((evidence) => evidence.sourceRef.includes('manual paste'))).toBe(true);
  });

  it('builds compact prompt-ready context packs and promotes relevant memories to hot memory', () => {
    const state = loadSampleGraphKnowledge('2026-05-08T00:00:00.000Z');
    const pack = buildGraphKnowledgeContextPack(state, 'offline graph memory with PathRAG skills');
    const promoted = promoteGraphKnowledgeToHotMemory(state, 'offline graph memory with PathRAG skills');

    expect(pack.text).toContain('HOT MEMORY');
    expect(pack.text).toContain('RELEVANT FACTS');
    expect(pack.text).toContain('PATHS');
    expect(pack.text).toContain('SKILLS');
    expect(pack.localCitationIds.length).toBeGreaterThan(3);
    expect(pack.tokenEstimate).toBeLessThanOrEqual(900);
    expect(promoted.hotMemoryBlocks.some((block) => block.name === 'recent_focus')).toBe(true);
  });

  it('detects contradictions, preserves superseded facts, and round-trips export/import', () => {
    const state = loadSampleGraphKnowledge('2026-05-08T00:00:00.000Z');
    const consolidated = consolidateGraphKnowledge(state);
    const serialized = exportGraphKnowledge(consolidated);
    const imported = importGraphKnowledge(serialized);

    expect(consolidated.claims.some((claim) => claim.status === 'superseded')).toBe(true);
    expect(consolidated.relations.some((relation) => relation.type === 'CONTRADICTS')).toBe(true);
    expect(isGraphKnowledgeState(imported)).toBe(true);
    expect(getGraphKnowledgeStats(imported)).toEqual(getGraphKnowledgeStats(consolidated));
  });
});
