import type { ResearchGraph, ResearchGraphEdge, ResearchGraphNode } from '../types';
import { stableHash } from '../utils/hash';

export class MutableResearchGraph {
  private readonly nodes = new Map<string, ResearchGraphNode>();
  private readonly edgeKeys = new Set<string>();
  private readonly edges: ResearchGraphEdge[] = [];

  addNode(node: ResearchGraphNode): void {
    if (!this.nodes.has(node.id)) this.nodes.set(node.id, node);
  }

  addEdge(edge: Omit<ResearchGraphEdge, 'id'>): void {
    const key = `${edge.from}\u0000${edge.to}\u0000${edge.type}`;
    if (this.edgeKeys.has(key)) return;
    this.edgeKeys.add(key);
    this.edges.push({ id: `edge-${stableHash(key)}`, ...edge });
  }

  toJSON(): ResearchGraph {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges],
    };
  }
}

export type { ResearchGraph, ResearchGraphEdge, ResearchGraphNode };
