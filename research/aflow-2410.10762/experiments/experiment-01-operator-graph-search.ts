export type OperatorKind = 'generate' | 'review' | 'revise' | 'ensemble' | 'test';

export interface Operator {
  readonly id: string;
  readonly kind: OperatorKind;
}

export interface WorkflowEdge {
  readonly from: string;
  readonly to: string;
}

export interface WorkflowGraph {
  readonly operators: readonly Operator[];
  readonly edges: readonly WorkflowEdge[];
}

export type GraphEdit =
  | { readonly type: 'add-operator'; readonly operator: Operator; readonly after: string }
  | { readonly type: 'swap-kind'; readonly operatorId: string; readonly kind: OperatorKind }
  | { readonly type: 'add-edge'; readonly from: string; readonly to: string };

export interface SearchTraceEntry {
  readonly iteration: number;
  readonly editType: GraphEdit['type'];
  readonly score: number;
  readonly bestScoreSoFar: number;
}

export interface SearchResult {
  readonly bestGraph: WorkflowGraph;
  readonly bestScore: number;
  readonly trace: readonly SearchTraceEntry[];
}

export class SeededPrng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  nextInt(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
}

const KINDS: readonly OperatorKind[] = ['generate', 'review', 'revise', 'ensemble', 'test'];

export function seedGraph(): WorkflowGraph {
  return { operators: [{ id: 'op0', kind: 'generate' }], edges: [] };
}

function kindOf(graph: WorkflowGraph, id: string): OperatorKind | undefined {
  const found = graph.operators.filter((op) => op.id === id)[0];
  return found ? found.kind : undefined;
}

export function mockEvaluate(graph: WorkflowGraph): number {
  let score = 0.4;
  for (const edge of graph.edges) {
    const from = kindOf(graph, edge.from);
    const to = kindOf(graph, edge.to);
    if (from === 'generate' && to === 'review') score += 0.15;
    if (from === 'review' && to === 'revise') score += 0.1;
    if (to === 'ensemble') score += 0.05;
    if (to === 'test') score += 0.05;
  }
  score -= Math.max(0, graph.operators.length - 4) * 0.06;
  return Math.max(0, Math.min(1, score));
}

export function proposeEdit(graph: WorkflowGraph, prng: SeededPrng, nextId: number): GraphEdit {
  const anchor = graph.operators[prng.nextInt(graph.operators.length)];
  const roll = prng.nextInt(3);
  if (roll === 0 && graph.operators.length < 6) {
    const kind = KINDS[prng.nextInt(KINDS.length)];
    return { type: 'add-operator', operator: { id: `op${nextId}`, kind }, after: anchor.id };
  }
  if (roll === 1) {
    return { type: 'swap-kind', operatorId: anchor.id, kind: KINDS[prng.nextInt(KINDS.length)] };
  }
  const target = graph.operators[prng.nextInt(graph.operators.length)];
  return { type: 'add-edge', from: anchor.id, to: target.id };
}

export function applyEdit(graph: WorkflowGraph, edit: GraphEdit): WorkflowGraph {
  if (edit.type === 'add-operator') {
    return {
      operators: graph.operators.concat([edit.operator]),
      edges: graph.edges.concat([{ from: edit.after, to: edit.operator.id }]),
    };
  }
  if (edit.type === 'swap-kind') {
    return {
      operators: graph.operators.map((op) =>
        op.id === edit.operatorId ? { id: op.id, kind: edit.kind } : op,
      ),
      edges: graph.edges,
    };
  }
  if (edit.from === edit.to) return graph;
  const exists = graph.edges.some((e) => e.from === edit.from && e.to === edit.to);
  return exists ? graph : { operators: graph.operators, edges: graph.edges.concat([edit]) };
}

export function isAcyclic(graph: WorkflowGraph): boolean {
  // Kahn-style topological check: repeatedly remove operators with no incoming edges.
  const remaining = new Set(graph.operators.map((op) => op.id));
  let removed = true;
  while (removed && remaining.size > 0) {
    removed = false;
    for (const id of Array.from(remaining)) {
      const hasIncoming = graph.edges.some((e) => e.to === id && remaining.has(e.from));
      if (!hasIncoming) {
        remaining.delete(id);
        removed = true;
      }
    }
  }
  return remaining.size === 0;
}

export function isValidGraph(graph: WorkflowGraph): boolean {
  const ids = new Set(graph.operators.map((op) => op.id));
  // Contract: unique operator ids, every edge endpoint resolves, no self-loops, and the graph is acyclic.
  if (ids.size !== graph.operators.length) return false;
  for (const edge of graph.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) return false;
  }
  return isAcyclic(graph);
}

interface SearchNode {
  readonly graph: WorkflowGraph;
  readonly parent: SearchNode | null;
  readonly children: SearchNode[];
  visits: number;
  totalScore: number;
}

function ucb(node: SearchNode, parentVisits: number, c: number): number {
  if (node.visits === 0) return Number.POSITIVE_INFINITY;
  return node.totalScore / node.visits + c * Math.sqrt(Math.log(parentVisits) / node.visits);
}

export function runOperatorGraphSearch(iterations = 40, seed = 42, exploration = 1.4): SearchResult {
  const prng = new SeededPrng(seed);
  const root: SearchNode = { graph: seedGraph(), parent: null, children: [], visits: 1, totalScore: mockEvaluate(seedGraph()) };
  const trace: SearchTraceEntry[] = [];
  let best: SearchNode = root;
  let nextId = 1;

  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    let node = root;
    while (node.children.length > 0 && prng.next() < 0.7) {
      node = node.children.reduce((a, b) => (ucb(a, node.visits, exploration) >= ucb(b, node.visits, exploration) ? a : b));
    }
    const edit = proposeEdit(node.graph, prng, nextId);
    if (edit.type === 'add-operator') nextId += 1;
    const childGraph = applyEdit(node.graph, edit);
    // Skip invalid children (cyclic or contract-violating graphs) before any scoring or accounting.
    if (!isValidGraph(childGraph)) continue;
    const child: SearchNode = { graph: childGraph, parent: node, children: [], visits: 0, totalScore: 0 };
    node.children.push(child);
    const score = mockEvaluate(child.graph);
    for (let walker: SearchNode | null = child; walker !== null; walker = walker.parent) {
      walker.visits += 1;
      walker.totalScore += score;
    }
    if (score > mockEvaluate(best.graph)) best = child;
    trace.push({ iteration, editType: edit.type, score, bestScoreSoFar: mockEvaluate(best.graph) });
  }

  return { bestGraph: best.graph, bestScore: mockEvaluate(best.graph), trace };
}

export function runDemo(): readonly string[] {
  const result = runOperatorGraphSearch(40, 42, 1.4);
  const ops = result.bestGraph.operators.map((op) => `${op.id}:${op.kind}`).join(', ');
  return [
    `seed graph score: ${mockEvaluate(seedGraph()).toFixed(3)}`,
    `best graph score: ${result.bestScore.toFixed(3)}`,
    `best graph operators: ${ops}`,
    `best graph edges: ${result.bestGraph.edges.map((e) => `${e.from}->${e.to}`).join(', ')}`,
    `trace length: ${result.trace.length}`,
  ];
}

export const demoOutput: readonly string[] = runDemo();
