import type { CrawlTarget } from '../types';
import { normalizeUrl } from '../utils/normalizeUrl';

export class FrontierQueue {
  private readonly maxSize: number;
  private targets: CrawlTarget[] = [];

  constructor(options: { maxSize?: number } = {}) {
    this.maxSize = options.maxSize ?? Number.POSITIVE_INFINITY;
  }

  add(target: CrawlTarget): boolean {
    if (target.priority <= 0 || this.hasEquivalent(target)) return false;
    this.targets.push(target);
    this.sortAndTrim();
    return this.targets.some((candidate) => candidate.id === target.id);
  }

  addMany(targets: CrawlTarget[]): number {
    return targets.reduce((count, target) => count + (this.add(target) ? 1 : 0), 0);
  }

  nextBatch(size: number): CrawlTarget[] {
    this.sortAndTrim();
    return this.targets.splice(0, Math.max(0, size));
  }

  list(): CrawlTarget[] {
    this.sortAndTrim();
    return [...this.targets];
  }

  size(): number {
    return this.targets.length;
  }

  hasEquivalent(target: CrawlTarget): boolean {
    const key = equivalentKey(target);
    return this.targets.some((candidate) => equivalentKey(candidate) === key);
  }

  private sortAndTrim(): void {
    this.targets.sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
    if (this.targets.length > this.maxSize) this.targets = this.targets.slice(0, this.maxSize);
  }
}

export function equivalentKey(target: CrawlTarget): string {
  switch (target.kind) {
    case 'url':
      return `url:${normalizeUrl(target.url)}`;
    case 'domain_search':
      return `domain:${target.domain.toLowerCase()}:${normalizeQuery(target.query)}`;
    case 'entity_expand':
      return `entity:${target.entity.toLowerCase()}`;
    default:
      return `${target.kind}:${normalizeQuery(target.query)}`;
  }
}

function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/\s+/g, ' ').trim();
}
