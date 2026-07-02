export interface GenomeScores {
  readonly quality: number;
  readonly cost: number;
}

export interface HarnessGenome {
  readonly id: string;
  readonly parentId: string | null;
  readonly summary: string;
  readonly definition: string;
  readonly scores: GenomeScores;
}

export interface SearchReport {
  readonly archiveSize: number;
  readonly dedupeCount: number;
  readonly best: HarnessGenome;
  readonly lineage: readonly string[];
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

export function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (Math.imul(hash, 33) ^ input.charCodeAt(i)) >>> 0;
  }
  return `g${hash.toString(36)}`;
}

export class Archive {
  private readonly byId = new Map<string, HarnessGenome>();

  insert(genome: HarnessGenome): boolean {
    if (this.byId.has(genome.id)) {
      return false;
    }
    this.byId.set(genome.id, genome);
    return true;
  }

  get(id: string): HarnessGenome | undefined {
    return this.byId.get(id);
  }

  all(): readonly HarnessGenome[] {
    return Array.from(this.byId.values());
  }

  size(): number {
    return this.byId.size;
  }
}

const FEATURE_TOKENS: readonly string[] = ['reflect', 'verify', 'ensemble', 'plan', 'retry'];

export function evaluate(definition: string): GenomeScores {
  const lower = definition.toLowerCase();
  let quality = 0.2;
  for (const token of FEATURE_TOKENS) {
    if (lower.indexOf(token) >= 0) quality += 0.16;
  }
  const cost = Math.min(1, definition.length / 600);
  return {
    quality: Math.round(Math.min(1, quality) * 1000) / 1000,
    cost: Math.round(cost * 1000) / 1000,
  };
}

export function combinedScore(scores: GenomeScores): number {
  return Math.round((scores.quality - scores.cost * 0.3) * 1000) / 1000;
}

function wordSet(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\s+/).filter((word) => word.length > 0));
}

export function novelty(definition: string, others: readonly HarnessGenome[]): number {
  if (others.length === 0) return 1;
  const words = wordSet(definition);
  let maxOverlap = 0;
  for (const other of others) {
    const otherWords = wordSet(other.definition);
    let shared = 0;
    words.forEach((word) => {
      if (otherWords.has(word)) shared += 1;
    });
    const unionSize = words.size + otherWords.size - shared;
    const overlap = unionSize === 0 ? 1 : shared / unionSize;
    if (overlap > maxOverlap) maxOverlap = overlap;
  }
  return Math.round((1 - maxOverlap) * 1000) / 1000;
}

export function sampleParent(archive: Archive, prng: SeededPrng): HarnessGenome {
  const genomes = archive.all();
  const weights = genomes.map((genome) => {
    const rest = genomes.filter((other) => other.id !== genome.id);
    return Math.max(0.01, combinedScore(genome.scores)) + 0.5 * novelty(genome.definition, rest);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = prng.next() * total;
  for (let i = 0; i < genomes.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return genomes[i];
  }
  return genomes[genomes.length - 1];
}

const MUTATIONS: readonly string[] = [
  'Add a reflect step after each tool call.',
  'Verify outputs with a rubric before returning.',
  'Use an ensemble of two drafts and pick the stronger.',
  'Plan sub-goals before acting.',
  'Retry failed steps once with narrowed scope.',
];

export function mutate(parent: HarnessGenome, prng: SeededPrng): { readonly definition: string; readonly summary: string } {
  const snippet = MUTATIONS[prng.nextInt(MUTATIONS.length)];
  return {
    definition: `${parent.definition} ${snippet}`,
    summary: `${parent.summary} + ${snippet.split(' ')[0].toLowerCase()}`,
  };
}

export function lineageReport(archive: Archive, genome: HarnessGenome): readonly string[] {
  const lines: string[] = [];
  let current: HarnessGenome | undefined = genome;
  while (current) {
    lines.push(`${current.id} score=${combinedScore(current.scores)} :: ${current.summary}`);
    current = current.parentId === null ? undefined : archive.get(current.parentId);
  }
  return lines;
}

export function runArchiveSearch(iterations = 30, seed = 11): SearchReport {
  const prng = new SeededPrng(seed);
  const archive = new Archive();
  const seedDefinition = 'Baseline harness: read task, act, return answer.';
  archive.insert({
    id: hashString(seedDefinition),
    parentId: null,
    summary: 'baseline',
    definition: seedDefinition,
    scores: evaluate(seedDefinition),
  });

  let dedupeCount = 0;
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const parent = sampleParent(archive, prng);
    const proposal = mutate(parent, prng);
    const child: HarnessGenome = {
      id: hashString(proposal.definition),
      parentId: parent.id,
      summary: proposal.summary,
      definition: proposal.definition,
      scores: evaluate(proposal.definition),
    };
    if (!archive.insert(child)) dedupeCount += 1;
  }

  const best = archive
    .all()
    .reduce((a, b) => (combinedScore(a.scores) >= combinedScore(b.scores) ? a : b));
  return {
    archiveSize: archive.size(),
    dedupeCount,
    best,
    lineage: lineageReport(archive, best),
  };
}

export function runDemo(): readonly string[] {
  const report = runArchiveSearch(30, 11);
  return [
    `archive size: ${report.archiveSize}`,
    `dedupe count: ${report.dedupeCount}`,
    `best genome: ${report.best.id} score=${combinedScore(report.best.scores)}`,
    `lineage:`,
  ].concat(report.lineage.map((line) => `  ${line}`));
}

export const demoOutput: readonly string[] = runDemo();
