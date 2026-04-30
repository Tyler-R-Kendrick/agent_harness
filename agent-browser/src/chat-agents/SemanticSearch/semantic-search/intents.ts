import type { SearchIntent } from './types';
import { clampWikidataLimit } from './templates/wikidata';

export function classifySemanticSearchIntent(text: string, options: { limit?: number } = {}): SearchIntent {
  const cleaned = text.trim();
  const limit = clampWikidataLimit(options.limit ?? explicitLimit(cleaned) ?? 10);
  if (/\b(?:health|status|available|latency)\b/i.test(cleaned) && /\b(?:rdf|sparql|wikidata|endpoint)\b/i.test(cleaned)) {
    return { kind: 'endpointHealth', text: cleaned, limit };
  }
  const qid = cleaned.match(/\b(Q[1-9][0-9]*)\b/i)?.[1]?.toUpperCase();
  if (qid && /\b(?:instances?|subclasses?|class|types?)\s+of\b/i.test(cleaned)) {
    return { kind: 'classInstances', qid, text: cleaned, limit };
  }
  if (qid && /\b(?:facts?|claims?|properties?|about|show|lookup|look\s+up)\b/i.test(cleaned)) {
    return { kind: 'qidFacts', qid, text: cleaned, limit };
  }
  return { kind: 'entitySearch', text: cleaned, limit };
}

function explicitLimit(text: string): number | undefined {
  const match = text.match(/\blimit\s+([0-9]{1,3})\b/i);
  return match ? Number(match[1]) : undefined;
}
