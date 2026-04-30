export type SearchSource = 'wikidata' | 'dbpedia' | 'overpass';

export type SearchIntent =
  | {
      kind: 'entitySearch';
      text: string;
      limit: number;
    }
  | {
      kind: 'qidFacts';
      qid: string;
      text: string;
      limit: number;
    }
  | {
      kind: 'classInstances';
      qid: string;
      text: string;
      limit: number;
    }
  | {
      kind: 'endpointHealth';
      text: string;
      limit: number;
    };

export type SearchFact = {
  label: string;
  value: string;
  url?: string;
};

export type SearchResult = {
  id: string;
  title: string;
  url: string;
  source: SearchSource;
  sourceName: string;
  description?: string;
  score: number;
  facts?: SearchFact[];
  raw?: unknown;
};

export type AgentAnswer = {
  query: string;
  intent: SearchIntent;
  endpointId?: string;
  generatedQuery?: string;
  results: SearchResult[];
  errors: Array<{
    source?: string;
    message: string;
  }>;
  elapsedMs: number;
};

export type SparqlJsonBindingValue = {
  type?: string;
  value?: string;
  datatype?: string;
  'xml:lang'?: string;
};

export type SparqlJsonResult = {
  head?: {
    vars?: string[];
  };
  boolean?: boolean;
  results?: {
    bindings?: Array<Record<string, SparqlJsonBindingValue>>;
  };
};

export type SemanticSearchAgentConfig = {
  endpointUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  defaultLimit?: number;
};
