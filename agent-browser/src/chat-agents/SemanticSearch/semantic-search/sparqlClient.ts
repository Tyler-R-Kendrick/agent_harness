import type { SparqlJsonResult } from './types';

export async function runSparqlQuery({
  endpointUrl,
  query,
  fetchImpl = fetch,
  signal,
}: {
  endpointUrl: string;
  query: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<SparqlJsonResult> {
  const response = await fetchImpl(endpointUrl, {
    method: 'POST',
    headers: {
      accept: 'application/sparql-results+json, application/json',
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: new URLSearchParams({ query }).toString(),
    signal,
  });
  if (!response.ok) {
    throw new Error(`SPARQL endpoint returned HTTP ${response.status} ${response.statusText}`.trim());
  }
  const parsed = await response.json();
  if (!isSparqlJsonResult(parsed)) {
    throw new Error('SPARQL endpoint returned malformed JSON.');
  }
  return parsed;
}

function isSparqlJsonResult(value: unknown): value is SparqlJsonResult {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as SparqlJsonResult;
  return typeof candidate.boolean === 'boolean'
    || Array.isArray(candidate.results?.bindings)
    || Array.isArray(candidate.head?.vars);
}
