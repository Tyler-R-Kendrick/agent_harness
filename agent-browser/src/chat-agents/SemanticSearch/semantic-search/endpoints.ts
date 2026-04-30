export type EndpointKind = 'sparql' | 'overpass';

export type EndpointConfig = {
  id: 'wikidata' | 'dbpedia' | 'overpass';
  name: string;
  kind: EndpointKind;
  url: string;
  enabled: boolean;
  notes: string;
};

export const SEMANTIC_ENDPOINTS: EndpointConfig[] = [
  {
    id: 'wikidata',
    name: 'Wikidata Query Service',
    kind: 'sparql',
    url: 'https://query.wikidata.org/sparql',
    enabled: true,
    notes: 'Default public RDF/SPARQL endpoint for entity search, QID facts, and class instances.',
  },
  {
    id: 'dbpedia',
    name: 'DBpedia SPARQL',
    kind: 'sparql',
    url: 'https://dbpedia.org/sparql',
    enabled: false,
    notes: 'Registered extension point; disabled until endpoint behavior is validated in-browser.',
  },
  {
    id: 'overpass',
    name: 'Overpass API',
    kind: 'overpass',
    url: 'https://overpass-api.de/api/interpreter',
    enabled: false,
    notes: 'Registered geospatial extension point; not RDF/SPARQL and requires explicit coordinates.',
  },
];

export function getDefaultSemanticEndpoint(): EndpointConfig {
  const endpoint = SEMANTIC_ENDPOINTS.find((candidate) => candidate.id === 'wikidata' && candidate.enabled);
  if (!endpoint) {
    throw new Error('Wikidata semantic endpoint is not configured.');
  }
  return endpoint;
}
