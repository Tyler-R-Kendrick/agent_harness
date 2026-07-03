export interface SkillSection {
  readonly heading: string;
  readonly body: string;
}

export interface SkillDoc {
  readonly name: string;
  readonly sections: readonly SkillSection[];
}

export type EditKind = 'replace' | 'append';

export interface EditProposal {
  readonly key: string;
  readonly kind: EditKind;
  readonly sectionIndex: number;
  readonly body: string;
}

export interface RejectedEdit {
  readonly key: string;
  readonly scoreDelta: number;
}

export interface FixtureTask {
  readonly id: string;
  readonly requiredPhrases: readonly string[];
  readonly weight: number;
}

export interface OptimizationStep {
  readonly iteration: number;
  readonly proposalKey: string;
  readonly candidateScore: number;
  readonly accepted: boolean;
  readonly skippedByMemory: number;
}

export const MAX_SECTION_CHARS = 240;
export const MAX_DOC_CHARS = 1600;

export class SeededLcg {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextInt(maxExclusive: number): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return Math.floor((this.state / 4294967296) * maxExclusive);
  }
}

export function renderDoc(doc: SkillDoc): string {
  const header = `# ${doc.name}`;
  const body = doc.sections.map((s) => `## ${s.heading}\n${s.body}`).join('\n');
  return `${header}\n${body}`;
}

export function isBounded(doc: SkillDoc, proposal: EditProposal): boolean {
  if (proposal.body.length === 0 || proposal.body.length > MAX_SECTION_CHARS) {
    return false;
  }
  if (proposal.kind === 'replace' && (proposal.sectionIndex < 0 || proposal.sectionIndex >= doc.sections.length)) {
    return false;
  }
  return applyEdit(doc, proposal) !== null;
}

export function applyEdit(doc: SkillDoc, proposal: EditProposal): SkillDoc | null {
  const sections =
    proposal.kind === 'replace'
      ? doc.sections.map((s, i) => (i === proposal.sectionIndex ? { ...s, body: proposal.body } : s))
      : [...doc.sections, { heading: `Step ${doc.sections.length + 1}`, body: proposal.body }];
  const candidate: SkillDoc = { ...doc, sections };
  return renderDoc(candidate).length <= MAX_DOC_CHARS ? candidate : null;
}

export function validateDoc(doc: SkillDoc, tasks: readonly FixtureTask[]): number {
  const text = renderDoc(doc).toLowerCase();
  const coverage = tasks.reduce((sum, task) => {
    const hits = task.requiredPhrases.filter((phrase) => text.includes(phrase)).length;
    return sum + task.weight * (hits / task.requiredPhrases.length);
  }, 0);
  const lengthPenalty = renderDoc(doc).length / MAX_DOC_CHARS;
  return coverage - 0.25 * lengthPenalty;
}

const CANDIDATE_BODIES: readonly string[] = [
  'Always run tests before declaring the task complete.',
  'Verify output against the acceptance criteria and cite sources for claims.',
  'Prefer vivid adjectives and dramatic phrasing in every reply.',
  'Handle errors explicitly: surface the failing command and its exit code.',
  'Restate the user request in three different ways before starting.',
  'Keep edits minimal and reversible; never rewrite unrelated sections.',
];

export function proposeEdit(
  doc: SkillDoc,
  rng: SeededLcg,
  rejected: readonly RejectedEdit[],
): { proposal: EditProposal; skipped: number } {
  const rejectedKeys = new Set(rejected.map((r) => r.key));
  let skipped = 0;
  const maxAttempts = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const kind: EditKind = rng.nextInt(2) === 0 ? 'replace' : 'append';
    const sectionIndex = kind === 'replace' ? rng.nextInt(doc.sections.length) : doc.sections.length;
    const body = CANDIDATE_BODIES[rng.nextInt(CANDIDATE_BODIES.length)];
    const key = `${kind}:${sectionIndex}:${body.slice(0, 24)}`;
    if (!rejectedKeys.has(key)) {
      return { proposal: { key, kind, sectionIndex, body }, skipped };
    }
    skipped += 1;
  }
  throw new Error(
    `proposeEdit exhausted ${maxAttempts} attempts: all sampled proposals are in rejected-edit memory`,
  );
}

export function optimizeSkillDoc(
  seed: SkillDoc,
  tasks: readonly FixtureTask[],
  iterations: number,
  rngSeed: number,
): { bestDoc: SkillDoc; bestScore: number; log: OptimizationStep[]; rejectedEdits: RejectedEdit[] } {
  const rng = new SeededLcg(rngSeed);
  const rejectedEdits: RejectedEdit[] = [];
  const log: OptimizationStep[] = [];
  let bestDoc = seed;
  let bestScore = validateDoc(seed, tasks);

  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const { proposal, skipped } = proposeEdit(bestDoc, rng, rejectedEdits);
    const candidate = isBounded(bestDoc, proposal) ? applyEdit(bestDoc, proposal) : null;
    const candidateScore = candidate === null ? bestScore - 1 : validateDoc(candidate, tasks);
    const accepted = candidate !== null && candidateScore > bestScore;

    if (accepted && candidate !== null) {
      bestDoc = candidate;
      bestScore = candidateScore;
    } else {
      rejectedEdits.push({ key: proposal.key, scoreDelta: candidateScore - bestScore });
    }
    log.push({ iteration, proposalKey: proposal.key, candidateScore, accepted, skippedByMemory: skipped });
  }

  return { bestDoc, bestScore, log, rejectedEdits };
}

const seedDoc: SkillDoc = {
  name: 'code-review-skill',
  sections: [
    { heading: 'Trigger', body: 'Use when the user asks for a review of a diff or pull request.' },
    { heading: 'Procedure', body: 'Read the diff and summarize the changes.' },
  ],
};

const fixtureTasks: readonly FixtureTask[] = [
  { id: 'T1', requiredPhrases: ['run tests', 'exit code'], weight: 1.0 },
  { id: 'T2', requiredPhrases: ['acceptance criteria', 'cite sources'], weight: 0.8 },
  { id: 'T3', requiredPhrases: ['minimal and reversible'], weight: 0.6 },
];

const result = optimizeSkillDoc(seedDoc, fixtureTasks, 14, 26052390);
console.log(`best score: ${result.bestScore.toFixed(3)}`);
console.log(`accepted edits: ${result.log.filter((s) => s.accepted).length} / ${result.log.length}`);
console.log(`rejected-edit memory size: ${result.rejectedEdits.length}`);
console.log(`proposals skipped via memory: ${result.log.reduce((n, s) => n + s.skippedByMemory, 0)}`);
console.log('--- optimization log ---');
for (const step of result.log) {
  console.log(`#${step.iteration} ${step.accepted ? 'ACCEPT' : 'REJECT'} ${step.proposalKey} -> ${step.candidateScore.toFixed(3)}`);
}
console.log('--- best_skill.md ---');
console.log(renderDoc(result.bestDoc));
