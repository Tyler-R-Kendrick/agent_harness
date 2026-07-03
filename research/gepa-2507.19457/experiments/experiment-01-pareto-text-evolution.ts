export interface EvalInstance {
  readonly id: string;
  readonly requiredTerms: readonly string[];
  readonly maxLength: number;
}

export interface Candidate {
  readonly id: string;
  readonly parentId: string | null;
  readonly text: string;
  readonly scores: readonly number[];
}

export interface MutationRecord {
  readonly generation: number;
  readonly parentId: string;
  readonly childId: string;
  readonly mutation: string;
  readonly accepted: boolean;
  readonly frontierSize: number;
}

export interface EvolutionResult {
  readonly frontier: readonly Candidate[];
  readonly selected: Candidate;
  readonly history: readonly MutationRecord[];
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

export const EVAL_INSTANCES: readonly EvalInstance[] = [
  { id: 'i1', requiredTerms: ['cite sources', 'summary'], maxLength: 220 },
  { id: 'i2', requiredTerms: ['step by step', 'assumptions'], maxLength: 260 },
  { id: 'i3', requiredTerms: ['verify', 'checklist'], maxLength: 240 },
  { id: 'i4', requiredTerms: ['concise'], maxLength: 140 },
];

export const MAX_FRONTIER = 6;

export function scoreInstance(text: string, instance: EvalInstance): number {
  // Hard length gate: over-budget text scores zero on this instance.
  if (text.length > instance.maxLength) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const term of instance.requiredTerms) {
    if (lower.indexOf(term) >= 0) hits += 1;
  }
  const coverage = hits / instance.requiredTerms.length;
  return Math.round(coverage * 1000) / 1000;
}

export function evaluate(text: string, instances: readonly EvalInstance[]): readonly number[] {
  return instances.map((instance) => scoreInstance(text, instance));
}

export function dominates(a: readonly number[], b: readonly number[]): boolean {
  let strictlyBetter = false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] < b[i]) return false;
    if (a[i] > b[i]) strictlyBetter = true;
  }
  return strictlyBetter;
}

export function updateFrontier(frontier: readonly Candidate[], child: Candidate): readonly Candidate[] {
  for (const member of frontier) {
    if (dominates(member.scores, child.scores) || member.text === child.text) {
      return frontier;
    }
  }
  const next = frontier.filter((member) => !dominates(child.scores, member.scores)).concat([child]);
  if (next.length <= MAX_FRONTIER) return next;
  // Cap the frontier: keep the best MAX_FRONTIER members by mean score (deterministic tie-break by id).
  const mean = (scores: readonly number[]): number =>
    scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return next
    .slice()
    .sort((a, b) => mean(b.scores) - mean(a.scores) || (a.id < b.id ? -1 : 1))
    .slice(0, MAX_FRONTIER);
}

export function reflectAndMutate(
  parent: Candidate,
  instances: readonly EvalInstance[],
  prng: SeededPrng,
): { readonly text: string; readonly mutation: string } {
  let weakest = instances[0];
  let weakestScore = parent.scores[0];
  for (let i = 1; i < instances.length; i += 1) {
    if (parent.scores[i] < weakestScore) {
      weakestScore = parent.scores[i];
      weakest = instances[i];
    }
  }
  const lower = parent.text.toLowerCase();
  const missing = weakest.requiredTerms.filter((term) => lower.indexOf(term) < 0);
  const roll = prng.nextInt(3);
  if (roll === 0 && missing.length > 0) {
    return {
      text: `${parent.text} Always include ${missing[0]} in the response.`,
      mutation: `append-missing-term(${weakest.id}:${missing[0]})`,
    };
  }
  if (roll === 1 && parent.text.length > weakest.maxLength) {
    const words = parent.text.split(' ');
    return {
      text: words.slice(0, Math.max(6, words.length - 5)).join(' '),
      mutation: `compress(${weakest.id})`,
    };
  }
  return {
    text: `${parent.text} Verify the result against the checklist before finishing.`,
    mutation: `add-verification-rule(${weakest.id})`,
  };
}

export function runParetoEvolution(generations = 24, seed = 7): EvolutionResult {
  const prng = new SeededPrng(seed);
  const seedText = 'Answer the question with a concise summary.';
  const seedCandidate: Candidate = {
    id: 'c0',
    parentId: null,
    text: seedText,
    scores: evaluate(seedText, EVAL_INSTANCES),
  };
  let frontier: readonly Candidate[] = [seedCandidate];
  const history: MutationRecord[] = [];

  for (let generation = 1; generation <= generations; generation += 1) {
    const parent = frontier[prng.nextInt(frontier.length)];
    const proposal = reflectAndMutate(parent, EVAL_INSTANCES, prng);
    const child: Candidate = {
      id: `c${generation}`,
      parentId: parent.id,
      text: proposal.text,
      scores: evaluate(proposal.text, EVAL_INSTANCES),
    };
    const nextFrontier = updateFrontier(frontier, child);
    history.push({
      generation,
      parentId: parent.id,
      childId: child.id,
      mutation: proposal.mutation,
      accepted: nextFrontier !== frontier,
      frontierSize: nextFrontier.length,
    });
    frontier = nextFrontier;
  }

  const mean = (scores: readonly number[]): number =>
    scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const selected = frontier.reduce((a, b) => (mean(a.scores) >= mean(b.scores) ? a : b));
  return { frontier, selected, history };
}

export function runDemo(): readonly string[] {
  const result = runParetoEvolution(24, 7);
  const growth = result.history.map((row) => row.frontierSize).join(' ');
  return [
    `frontier growth: ${growth}`,
    `final frontier: ${result.frontier.map((c) => `${c.id}[${c.scores.join(',')}]`).join(' ')}`,
    `selected: ${result.selected.id} (parent ${result.selected.parentId})`,
    `selected text: ${result.selected.text}`,
  ];
}

export const demoOutput: readonly string[] = runDemo();
