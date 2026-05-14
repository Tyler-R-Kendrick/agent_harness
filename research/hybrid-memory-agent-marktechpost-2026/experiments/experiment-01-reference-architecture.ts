export type Metadata = Record<string, string | number | boolean>;

export interface MemoryRecord {
  id: string;
  text: string;
  metadata: Metadata;
}

export interface RankedMemoryRecord extends MemoryRecord {
  sparseRank: number;
  denseRank: number;
  rrfScore: number;
}

export interface EmbeddingProvider {
  embed(text: string): number[];
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  ok: boolean;
  output: string;
}

export interface Tool {
  name: string;
  description: string;
  run(args: Record<string, unknown>): ToolResult;
}

export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  public embed(text: string): number[] {
    const tokens = tokenize(text);
    const len = tokens.length || 1;
    const vowels = (text.match(/[aeiou]/gi) ?? []).length;
    const consonants = (text.match(/[bcdfghjklmnpqrstvwxyz]/gi) ?? []).length;
    return [len, vowels / len, consonants / len];
  }
}

export class HybridMemoryStore {
  private readonly records: MemoryRecord[] = [];
  private id = 0;

  public constructor(private readonly embeddings: EmbeddingProvider, private readonly rrfK = 60) {}

  public store(text: string, metadata: Metadata = {}): string {
    this.id += 1;
    const id = `mem_${String(this.id).padStart(4, '0')}`;
    this.records.push({ id, text, metadata });
    return id;
  }

  public listAll(): MemoryRecord[] {
    return [...this.records];
  }

  public search(query: string, topK = 3): RankedMemoryRecord[] {
    if (this.records.length === 0) return [];

    const sparse = this.rankSparse(query);
    const dense = this.rankDense(query);

    const scored = this.records.map((record) => {
      const sparseRank = sparse.indexOf(record.id) + 1;
      const denseRank = dense.indexOf(record.id) + 1;
      const rrfScore = 1 / (this.rrfK + sparseRank) + 1 / (this.rrfK + denseRank);
      return { ...record, sparseRank, denseRank, rrfScore };
    });

    return scored.sort((a, b) => b.rrfScore - a.rrfScore).slice(0, Math.max(1, topK));
  }

  private rankSparse(query: string): string[] {
    const q = new Set(tokenize(query));
    return [...this.records]
      .map((record) => {
        const overlap = tokenize(record.text).filter((token) => q.has(token)).length;
        return { id: record.id, score: overlap };
      })
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.id);
  }

  private rankDense(query: string): string[] {
    const qv = this.embeddings.embed(query);
    return [...this.records]
      .map((record) => ({ id: record.id, score: cosineSimilarity(qv, this.embeddings.embed(record.text)) }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.id);
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  public register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  public dispatch(call: ToolCall): ToolResult {
    const tool = this.tools.get(call.name);
    if (!tool) return { ok: false, output: `Unknown tool: ${call.name}` };
    return tool.run(call.args);
  }
}

export function tokenize(input: string): string[] {
  return input.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
