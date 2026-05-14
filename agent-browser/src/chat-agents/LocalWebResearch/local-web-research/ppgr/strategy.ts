import type { EvidenceChunk, ExtractedPage, PpgrPointerBundle } from '../types';

type TextSeed = {
  page: ExtractedPage;
  nodeId: string;
  text: string;
  score: number;
};

type PointerTarget = {
  key: string;
  pageId: string;
  pointerType: 'figure' | 'table';
  pointerLabel?: string;
  pointerAnchor?: string;
  caption: string;
  assetId?: string;
};


export function runPpgrStrategy(args: {
  question: string;
  pages: ExtractedPage[];
  maxEvidenceChunks: number;
  maxPointerBudget: number;
}): { evidence: EvidenceChunk[]; pointerBundles: PpgrPointerBundle[] } {
  const seeds = retrieveTextNodes(args.pages, args.question);
  const bundles = scoreAndBundlePointers(seeds, args.question, args.maxPointerBudget);
  const evidence = seeds
    .sort((a, b) => b.score - a.score)
    .slice(0, args.maxEvidenceChunks)
    .map((seed, index) => ({
      id: `${seed.page.id}:ppgr:${seed.nodeId}:${index}`,
      url: seed.page.url,
      normalizedUrl: seed.page.normalizedUrl,
      title: seed.page.title,
      text: seed.text,
      score: seed.score,
      sourceResultId: seed.page.sourceResultId,
      pageId: seed.page.id,
    } satisfies EvidenceChunk));
  return { evidence, pointerBundles: bundles };
}

export function retrieveTextNodes(pages: ExtractedPage[], question: string): TextSeed[] {
  const terms = tokenize(question);
  const seeds: TextSeed[] = [];
  for (const page of pages) {
    const blocks = page.text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      const isSection = /^#{1,6}\s+/.test(block) || /^[A-Z][A-Za-z0-9\s]{4,}$/.test(block);
      const isParagraph = /\w+/.test(block) && block.split(/\s+/).length >= 8;
      if (!isSection && !isParagraph) continue;
      const score = lexicalScore(block, terms);
      if (score <= 0) continue;
      seeds.push({ page, nodeId: `n${i + 1}`, text: block, score });
    }
  }
  return seeds;
}

export function expandPointers(seed: TextSeed): PointerTarget[] {
  const hits: PointerTarget[] = [];
  const re = /(figure|fig\.?|table)\s*([a-z0-9.-]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(seed.page.text)) !== null) {
    const rawType = match[1].toLowerCase();
    const pointerType = rawType.startsWith('tab') ? 'table' : 'figure';
    const pointerLabel = match[2];
    const caption = seed.page.text.slice(Math.max(0, match.index - 80), Math.min(seed.page.text.length, match.index + 160));
    const pointerAnchor = `${pointerType}-${pointerLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    hits.push({
      key: `${seed.page.id}:${pointerType}:${pointerLabel}`,
      pageId: seed.page.id,
      pointerType,
      pointerLabel,
      pointerAnchor,
      caption,
      assetId: `${pointerType}:${pointerLabel}`,
    });
  }
  return hits;
}

function scoreAndBundlePointers(seeds: TextSeed[], question: string, maxPointerBudget: number): PpgrPointerBundle[] {
  const terms = tokenize(question);
  const dedupe = new Map<string, PpgrPointerBundle>();
  for (const seed of seeds) {
    const pointers = expandPointers(seed);
    for (const pointer of pointers) {
      const structuralPrior = pointer.pointerType === 'figure' ? 0.6 : 0.7;
      const overlap = lexicalScore(pointer.caption, terms);
      const score = seed.score + structuralPrior + overlap;
      const key = pointer.assetId ? `${seed.page.id}:${pointer.assetId}` : `${pointer.pageId}:${pointer.key}`;
      const existing = dedupe.get(key);
      if (!existing || score > existing.score) {
        dedupe.set(key, {
          id: `${seed.page.id}:${seed.nodeId}:${pointer.pointerType}:${pointer.pointerLabel ?? 'na'}`,
          pageId: seed.page.id,
          pageUrl: seed.page.url,
          nodeId: seed.nodeId,
          pointerType: pointer.pointerType,
          pointerLabel: pointer.pointerLabel,
          pointerAnchor: pointer.pointerAnchor,
          text: seed.text,
          score,
        });
      }
    }
  }
  return [...dedupe.values()].sort((a, b) => b.score - a.score).slice(0, maxPointerBudget);
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
}

function lexicalScore(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  const matched = terms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0);
  return matched / Math.max(1, terms.length);
}
