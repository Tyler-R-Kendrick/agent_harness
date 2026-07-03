export interface VariantNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly ownScore: number;
  readonly evalCount: number;
}

export type PromotionState = 'candidate' | 'benchmarked' | 'promoted' | 'rejected';

export interface PromotionRecord {
  readonly variantId: string;
  readonly state: PromotionState;
  readonly benchmarkScore: number;
}

export interface ExpansionReport {
  readonly rounds: number;
  readonly bestByOwnScore: VariantNode;
  readonly bestByCmp: VariantNode;
  readonly selectionDiverges: boolean;
  readonly activeHarnessId: string;
  readonly promotions: readonly PromotionRecord[];
}

export class SeededLcg {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
}

export class LineageTree {
  private readonly nodes = new Map<string, VariantNode>();
  private readonly childIndex = new Map<string, string[]>();

  add(node: VariantNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`duplicate variant id: ${node.id}`);
    }
    if (node.parentId !== null && !this.nodes.has(node.parentId)) {
      throw new Error(`unknown parent id: ${node.parentId}`);
    }
    this.nodes.set(node.id, node);
    if (node.parentId !== null) {
      const siblings = this.childIndex.get(node.parentId) ?? [];
      siblings.push(node.id);
      this.childIndex.set(node.parentId, siblings);
    }
  }

  get(id: string): VariantNode {
    const node = this.nodes.get(id);
    if (node === undefined) {
      throw new Error(`unknown variant id: ${id}`);
    }
    return node;
  }

  descendants(id: string): VariantNode[] {
    const out: VariantNode[] = [];
    const stack = [...(this.childIndex.get(id) ?? [])];
    while (stack.length > 0) {
      const nextId = stack.pop() as string;
      const node = this.get(nextId);
      out.push(node);
      stack.push(...(this.childIndex.get(nextId) ?? []));
    }
    return out;
  }

  all(): VariantNode[] {
    return [...this.nodes.values()];
  }
}

export function cladeMetaproductivity(tree: LineageTree, nodeId: string): number {
  const clade = [tree.get(nodeId), ...tree.descendants(nodeId)];
  const totalEvals = clade.reduce((sum, node) => sum + node.evalCount, 0);
  if (totalEvals === 0) {
    return 0;
  }
  const weighted = clade.reduce((sum, node) => sum + node.ownScore * node.evalCount, 0);
  return weighted / totalEvals;
}

export function selectByOwnScore(tree: LineageTree): VariantNode {
  return tree.all().reduce((best, node) => (node.ownScore > best.ownScore ? node : best));
}

export function selectByCmp(tree: LineageTree): VariantNode {
  return tree.all().reduce((best, node) =>
    cladeMetaproductivity(tree, node.id) > cladeMetaproductivity(tree, best.id) ? node : best,
  );
}

export function mockBenchmark(latentQuality: number, rng: SeededLcg): number {
  const noise = (rng.next() - 0.5) * 0.5;
  const score = latentQuality + noise;
  return Math.min(1, Math.max(0, score));
}

// Advances a promotion record one stage per call: candidate -> benchmarked on the
// first call, then benchmarked -> promoted/rejected (vs the incumbent + margin) on the second.
export function stepPromotion(
  record: PromotionRecord,
  incumbentScore: number,
  minMargin: number,
): PromotionRecord {
  if (record.state === 'candidate') {
    return { ...record, state: 'benchmarked' };
  }
  if (record.state === 'benchmarked') {
    const state: PromotionState =
      record.benchmarkScore >= incumbentScore + minMargin ? 'promoted' : 'rejected';
    return { ...record, state };
  }
  return record;
}

export function runExpansionLoop(seed: number, rounds: number): ExpansionReport {
  const rng = new SeededLcg(seed);
  const tree = new LineageTree();
  const latent = new Map<string, number>();
  const promotions: PromotionRecord[] = [];

  latent.set('V0', 0.5);
  tree.add({ id: 'V0', parentId: null, ownScore: mockBenchmark(0.5, rng), evalCount: 4 });
  let activeHarnessId = 'V0';

  for (let round = 1; round <= rounds; round += 1) {
    const parent = selectByCmp(tree);
    const parentLatent = latent.get(parent.id) as number;
    const childLatent = Math.min(1, Math.max(0, parentLatent + (rng.next() - 0.45) * 0.2));
    const childId = `V${round}`;
    const childScore = mockBenchmark(childLatent, rng);
    latent.set(childId, childLatent);
    tree.add({ id: childId, parentId: parent.id, ownScore: childScore, evalCount: 4 });

    let record: PromotionRecord = { variantId: childId, state: 'candidate', benchmarkScore: childScore };
    // Two-stage transition: the first step moves candidate -> benchmarked,
    // the second compares against the incumbent and moves benchmarked -> promoted/rejected.
    record = stepPromotion(record, tree.get(activeHarnessId).ownScore, 0.02);
    record = stepPromotion(record, tree.get(activeHarnessId).ownScore, 0.02);
    promotions.push(record);
    if (record.state === 'promoted') {
      activeHarnessId = childId;
    }
  }

  const bestByOwnScore = selectByOwnScore(tree);
  const bestByCmp = selectByCmp(tree);
  return {
    rounds,
    bestByOwnScore,
    bestByCmp,
    selectionDiverges: bestByOwnScore.id !== bestByCmp.id,
    activeHarnessId,
    promotions,
  };
}

const report = runExpansionLoop(20251021, 12);
console.log(`rounds=${report.rounds}`);
console.log(`best by own score: ${report.bestByOwnScore.id} (${report.bestByOwnScore.ownScore.toFixed(3)})`);
console.log(`best by CMP:       ${report.bestByCmp.id} (own ${report.bestByCmp.ownScore.toFixed(3)})`);
console.log(`selection diverges (metaproductivity-performance mismatch): ${report.selectionDiverges}`);
console.log(`active harness after eval-gated promotion: ${report.activeHarnessId}`);
console.log(`promotions: ${report.promotions.map((p) => `${p.variantId}:${p.state}`).join(', ')}`);
