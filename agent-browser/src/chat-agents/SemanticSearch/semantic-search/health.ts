import { getDefaultSemanticEndpoint } from './endpoints';
import { runSparqlQuery } from './sparqlClient';
import { buildWikidataHealthQuery } from './templates/wikidata';

export type EndpointHealth = {
  endpointId: string;
  endpointUrl: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
};

export async function checkWikidataHealth({
  fetchImpl,
  signal,
}: {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
} = {}): Promise<EndpointHealth> {
  const endpoint = getDefaultSemanticEndpoint();
  const started = Date.now();
  try {
    await runSparqlQuery({
      endpointUrl: endpoint.url,
      query: buildWikidataHealthQuery(),
      fetchImpl,
      signal,
    });
    return {
      endpointId: endpoint.id,
      endpointUrl: endpoint.url,
      ok: true,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      endpointId: endpoint.id,
      endpointUrl: endpoint.url,
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
