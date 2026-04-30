const QID_PATTERN = /^Q[1-9][0-9]*$/;

export function escapeSparqlString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

export function clampWikidataLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 10;
  return Math.max(1, Math.min(25, Math.trunc(limit ?? 10)));
}

export function assertWikidataQid(qid: string): string {
  const normalized = qid.trim().toUpperCase();
  if (!QID_PATTERN.test(normalized)) {
    throw new TypeError(`Invalid Wikidata QID: ${qid}`);
  }
  return normalized;
}

export function buildWikidataEntitySearchQuery({
  text,
  limit,
}: {
  text: string;
  limit?: number;
}): string {
  const escaped = escapeSparqlString(text.trim());
  const clampedLimit = clampWikidataLimit(limit);
  return `
SELECT ?item ?itemLabel ?itemDescription WHERE {
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:endpoint "www.wikidata.org";
                    wikibase:api "EntitySearch";
                    mwapi:search "${escaped}";
                    mwapi:language "en";
                    mwapi:limit "${clampedLimit}".
    ?item wikibase:apiOutputItem mwapi:item.
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${clampedLimit}
`.trim();
}

export function buildWikidataFactsQuery({
  qid,
  limit,
}: {
  qid: string;
  limit?: number;
}): string {
  const normalizedQid = assertWikidataQid(qid);
  const clampedLimit = clampWikidataLimit(limit);
  return `
SELECT ?property ?propertyLabel ?value ?valueLabel WHERE {
  wd:${normalizedQid} ?claim ?statement.
  ?property wikibase:claim ?claim.
  ?property wikibase:statementProperty ?statementProperty.
  ?statement ?statementProperty ?value.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${clampedLimit}
`.trim();
}

export function buildWikidataClassInstancesQuery({
  qid,
  limit,
}: {
  qid: string;
  limit?: number;
}): string {
  const normalizedQid = assertWikidataQid(qid);
  const clampedLimit = clampWikidataLimit(limit);
  return `
SELECT ?item ?itemLabel ?itemDescription WHERE {
  ?item wdt:P31/wdt:P279* wd:${normalizedQid}.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${clampedLimit}
`.trim();
}

export function buildWikidataHealthQuery(): string {
  return 'ASK { wd:Q42 wdt:P31 wd:Q5 }';
}
