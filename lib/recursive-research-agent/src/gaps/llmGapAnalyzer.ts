import { DeterministicGapAnalyzer } from './deterministicGapAnalyzer';
import type { GapAnalyzer, ResearchClaim, ResearchGap } from '../types';
import { stableHash } from '../utils/hash';

export class LlmGapAnalyzer implements GapAnalyzer {
  private readonly fallback = new DeterministicGapAnalyzer();
  constructor(private readonly options: {
    callModel: (prompt: string, signal?: AbortSignal) => Promise<string>;
  }) {}

  async analyze(args: Parameters<GapAnalyzer['analyze']>[0]): Promise<{ gaps: ResearchGap[]; claims?: ResearchClaim[] }> {
    try {
      const parsed = JSON.parse(await this.options.callModel(buildPrompt(args), args.signal)) as unknown;
      const validated = validateModelOutput(parsed);
      if (validated) return validated;
    } catch {
      return this.fallback.analyze(args);
    }
    return this.fallback.analyze(args);
  }
}

function buildPrompt(args: Parameters<GapAnalyzer['analyze']>[0]): string {
  return [
    'You are a research controller deciding what information is still missing.',
    `Task: ${args.task.question}`,
    `Success criteria: ${args.task.successCriteria.join(', ')}`,
    `Evidence summary: ${args.evidence.map((item) => `${item.id}: ${item.title ?? item.url}`).join('; ')}`,
    `Previous gaps: ${args.previousGaps.map((gap) => gap.description).join('; ')}`,
    'Return JSON only with gaps and optional claims.',
  ].join('\n');
}

function validateModelOutput(value: unknown): { gaps: ResearchGap[]; claims?: ResearchClaim[] } | null {
  if (!isRecord(value) || !Array.isArray(value.gaps)) return null;
  const gaps = value.gaps.slice(0, 5).map((entry): ResearchGap | null => {
    if (!isRecord(entry) || typeof entry.description !== 'string' || typeof entry.reason !== 'string') return null;
    const suggestedQueries = Array.isArray(entry.suggestedQueries) ? entry.suggestedQueries.filter((item): item is string => typeof item === 'string').slice(0, 3) : [];
    return {
      id: `gap-${stableHash(entry.description)}`,
      description: entry.description,
      priority: typeof entry.priority === 'number' ? Math.max(0, Math.min(1, entry.priority)) : 0.5,
      suggestedQueries,
      suggestedDomains: Array.isArray(entry.suggestedDomains) ? entry.suggestedDomains.filter((item): item is string => typeof item === 'string').slice(0, 3) : undefined,
      suggestedUrls: Array.isArray(entry.suggestedUrls) ? entry.suggestedUrls.filter((item): item is string => typeof item === 'string').slice(0, 3) : undefined,
      reason: entry.reason,
      status: 'open',
    };
  }).filter((entry): entry is ResearchGap => Boolean(entry));
  const claims = Array.isArray(value.claims)
    ? value.claims.map((entry): ResearchClaim | null => {
      if (!isRecord(entry) || typeof entry.text !== 'string') return null;
      return {
        id: `claim-${stableHash(entry.text)}`,
        text: entry.text,
        confidence: typeof entry.confidence === 'number' ? Math.max(0, Math.min(1, entry.confidence)) : 0.5,
        supportingEvidenceIds: Array.isArray(entry.supportingEvidenceIds) ? entry.supportingEvidenceIds.filter((item): item is string => typeof item === 'string') : [],
        contradictingEvidenceIds: Array.isArray(entry.contradictingEvidenceIds) ? entry.contradictingEvidenceIds.filter((item): item is string => typeof item === 'string') : [],
        status: entry.status === 'supported' || entry.status === 'contradicted' || entry.status === 'uncertain' ? entry.status : 'uncertain',
      };
    }).filter((entry): entry is ResearchClaim => Boolean(entry))
    : undefined;
  return { gaps, ...(claims ? { claims } : {}) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
