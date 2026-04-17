import type { AgentNode, AgentRegistryInterface } from './types.js';

export class AgentRegistry implements AgentRegistryInterface {
  private readonly nodes = new Map<string, AgentNode>();

  register(node: AgentNode): () => void {
    this.nodes.set(node.id, node);
    return () => {
      this.nodes.delete(node.id);
    };
  }

  get(id: string): AgentNode | undefined {
    return this.nodes.get(id);
  }

  has(id: string): boolean {
    return this.nodes.has(id);
  }

  list(): AgentNode[] {
    return Array.from(this.nodes.values());
  }
}
