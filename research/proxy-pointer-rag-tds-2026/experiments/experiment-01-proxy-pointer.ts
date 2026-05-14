export type NodeKind = 'section' | 'paragraph' | 'figure' | 'table';

export interface GraphNode {
  readonly id: string;
  readonly docId: string;
  readonly kind: NodeKind;
  readonly text: string;
  readonly page: number;
  readonly assetUri?: string;
}

export type EdgeType = 'contains' | 'references' | 'near';

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly type: EdgeType;
}

export interface PointerBundle {
  readonly docId: string;
  readonly nodeId: string;
  readonly kind: Extract<NodeKind, 'figure' | 'table'>;
  readonly page: number;
  readonly assetUri: string;
  readonly score: number;
}

export interface Corpus {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

const EDGE_PRIOR: Record<EdgeType, number> = {
  contains: 0.2,
  references: 0.5,
  near: 0.1,
};

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function scoreText(query: string, text: string): number {
  const q = new Set(tokenize(query));
  const t = tokenize(text);
  if (q.size === 0 || t.length === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of t) {
    if (q.has(token)) {
      overlap += 1;
    }
  }

  return overlap / t.length;
}

export function retrieveTextNodes(corpus: Corpus, query: string, topK = 3): GraphNode[] {
  return corpus.nodes
    .filter((node) => node.kind === 'paragraph' || node.kind === 'section')
    .map((node) => ({ node, score: scoreText(query, node.text) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((row) => row.node);
}

export function expandPointers(corpus: Corpus, query: string, seeds: readonly GraphNode[]): PointerBundle[] {
  const nodesById = new Map(corpus.nodes.map((node) => [node.id, node]));
  const seedScores = new Map(seeds.map((seed) => [seed.id, scoreText(query, seed.text)]));

  const bundles: PointerBundle[] = [];
  for (const edge of corpus.edges) {
    const seedScore = seedScores.get(edge.from);
    if (seedScore === undefined) {
      continue;
    }

    const target = nodesById.get(edge.to);
    if (!target || (target.kind !== 'figure' && target.kind !== 'table') || !target.assetUri) {
      continue;
    }

    const captionScore = scoreText(query, target.text);
    bundles.push({
      docId: target.docId,
      nodeId: target.id,
      kind: target.kind,
      page: target.page,
      assetUri: target.assetUri,
      score: seedScore + EDGE_PRIOR[edge.type] + captionScore,
    });
  }

  return dedupeByBestScore(bundles);
}

function dedupeByBestScore(bundles: readonly PointerBundle[]): PointerBundle[] {
  const best = new Map<string, PointerBundle>();
  for (const bundle of bundles) {
    const existing = best.get(bundle.nodeId);
    if (!existing || bundle.score > existing.score) {
      best.set(bundle.nodeId, bundle);
    }
  }

  return [...best.values()].sort((a, b) => b.score - a.score);
}

export function runProxyPointerQuery(corpus: Corpus, query: string, topK = 3): PointerBundle[] {
  const seeds = retrieveTextNodes(corpus, query, topK);
  return expandPointers(corpus, query, seeds);
}

export function buildDemoCorpus(): Corpus {
  return {
    nodes: [
      { id: 's1', docId: 'doc-1', kind: 'section', text: 'Revenue analysis by region', page: 1 },
      { id: 'p1', docId: 'doc-1', kind: 'paragraph', text: 'The chart shows quarterly revenue growth in North America.', page: 2 },
      { id: 'p2', docId: 'doc-1', kind: 'paragraph', text: 'Table 4 contains median latency and p95 latency by release.', page: 3 },
      { id: 'f1', docId: 'doc-1', kind: 'figure', text: 'Quarterly revenue growth chart', page: 2, assetUri: 'assets/doc-1/figure-1.png' },
      { id: 't1', docId: 'doc-1', kind: 'table', text: 'Latency summary table', page: 3, assetUri: 'assets/doc-1/table-4.png' },
    ],
    edges: [
      { from: 'p1', to: 'f1', type: 'references' },
      { from: 'p2', to: 't1', type: 'references' },
      { from: 's1', to: 'p1', type: 'contains' },
      { from: 's1', to: 'p2', type: 'contains' },
    ],
  };
}
