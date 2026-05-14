export type RegionType = 'header' | 'paragraph' | 'table' | 'cell' | 'form-label' | 'form-value';

export interface DocumentRegion {
  id: string;
  type: RegionType;
  text: string;
  parentId?: string;
  x: number;
  y: number;
}

export interface PointerEdge {
  from: string;
  to: string;
  kind: 'parent-child' | 'next-sibling' | 'spatial-near';
}

export interface RankedEvidence {
  regionId: string;
  score: number;
  reasons: string[];
}

const tokenize = (input: string): string[] =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

export const buildPointerEdges = (regions: DocumentRegion[]): PointerEdge[] => {
  const edges: PointerEdge[] = [];

  for (const region of regions) {
    if (region.parentId) {
      edges.push({ from: region.parentId, to: region.id, kind: 'parent-child' });
    }
  }

  const byParent = new Map<string, DocumentRegion[]>();
  for (const region of regions) {
    const key = region.parentId ?? '__root__';
    const list = byParent.get(key) ?? [];
    list.push(region);
    byParent.set(key, list);
  }

  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.y - b.y || a.x - b.x);
    for (let i = 0; i < siblings.length - 1; i += 1) {
      edges.push({ from: siblings[i].id, to: siblings[i + 1].id, kind: 'next-sibling' });
    }
  }

  for (let i = 0; i < regions.length; i += 1) {
    for (let j = i + 1; j < regions.length; j += 1) {
      const dx = Math.abs(regions[i].x - regions[j].x);
      const dy = Math.abs(regions[i].y - regions[j].y);
      if (dx <= 20 && dy <= 20) {
        edges.push({ from: regions[i].id, to: regions[j].id, kind: 'spatial-near' });
      }
    }
  }

  return edges;
};

export const rankByProxyPointers = (query: string, regions: DocumentRegion[]): RankedEvidence[] => {
  const q = new Set(tokenize(query));
  const edges = buildPointerEdges(regions);

  const neighborCount = new Map<string, number>();
  for (const edge of edges) {
    neighborCount.set(edge.from, (neighborCount.get(edge.from) ?? 0) + 1);
    neighborCount.set(edge.to, (neighborCount.get(edge.to) ?? 0) + 1);
  }

  const ranked = regions.map((region) => {
    const tokens = tokenize(region.text);
    const lexicalHits = tokens.filter((t) => q.has(t)).length;
    const lexicalScore = tokens.length === 0 ? 0 : lexicalHits / tokens.length;

    const structuralBias =
      region.type === 'header' ? 0.2 : region.type === 'cell' || region.type === 'form-value' ? 0.15 : 0.05;

    const connectivity = Math.min((neighborCount.get(region.id) ?? 0) / 10, 0.2);

    const score = Number((lexicalScore + structuralBias + connectivity).toFixed(4));
    const reasons = [
      `lexical=${lexicalScore.toFixed(4)}`,
      `structural=${structuralBias.toFixed(4)}`,
      `connectivity=${connectivity.toFixed(4)}`,
    ];

    return { regionId: region.id, score, reasons };
  });

  return ranked.sort((a, b) => b.score - a.score || a.regionId.localeCompare(b.regionId));
};

// Deterministic self-check as experiment smoke test.
if (import.meta.url === `file://${process.argv[1]}`) {
  const sample: DocumentRegion[] = [
    { id: 'h1', type: 'header', text: 'Invoice Summary', x: 0, y: 0 },
    { id: 'p1', type: 'paragraph', text: 'Total amount due is listed below', parentId: 'h1', x: 0, y: 30 },
    { id: 't1', type: 'table', text: 'Line Items', x: 0, y: 60 },
    { id: 'c1', type: 'cell', text: 'Amount 5000 USD', parentId: 't1', x: 10, y: 80 },
  ];

  const top = rankByProxyPointers('invoice amount', sample)[0];
  if (!top || top.regionId !== 'h1') {
    throw new Error(`Unexpected top region: ${JSON.stringify(top)}`);
  }

  console.log('PPF experiment smoke test passed. Top region:', top.regionId, top.score);
}
