import { SeededLcg } from './rng';
import type {
  PolicyGateResult,
  RejectedEdit,
  SkillDoc,
  SkillEditKind,
  SkillEditProposal,
} from './types';

/**
 * Candidate section bodies sampled by {@link proposeSkillEdit}. Exported so
 * exhaustion-path tests can enumerate the full proposal key space. Not part of
 * the public barrel.
 */
export const SKILL_EDIT_CANDIDATE_BODIES: readonly string[] = [
  'Always run tests before declaring the task complete.',
  'Verify output against the acceptance criteria and cite sources for claims.',
  'Prefer explicit, structured phrasing over vague summaries.',
  'Handle errors explicitly: surface the failing command and its exit code.',
  'Restate the user request before starting to confirm scope.',
  'Keep edits minimal and reversible; never rewrite unrelated sections.',
];

const MAX_PROPOSE_ATTEMPTS = 1000;

/** Deterministic proposal key used for rejected-edit memory de-duplication. */
function skillEditKey(kind: SkillEditKind, sectionIndex: number, body: string): string {
  return `${kind}:${sectionIndex}:${body.slice(0, 24)}`;
}

/**
 * Sample a bounded edit proposal deterministically from `rng`, skipping any
 * proposal whose key is already in the rejected-edit memory.
 *
 * Reuses the SkillOpt scaffold's fixed sampling loop: it retries up to
 * {@link MAX_PROPOSE_ATTEMPTS} times and throws if every sampled proposal is
 * already rejected (so an exhausted proposal space fails loudly rather than
 * looping forever). `skipped` reports how many rejected samples were passed over
 * before a fresh proposal was found.
 */
export function proposeSkillEdit(
  doc: SkillDoc,
  rng: SeededLcg,
  rejected: readonly RejectedEdit[],
): { proposal: SkillEditProposal; skipped: number } {
  const rejectedKeys = new Set(rejected.map((r) => r.key));
  let skipped = 0;
  for (let attempt = 0; attempt < MAX_PROPOSE_ATTEMPTS; attempt += 1) {
    const kind: SkillEditKind = rng.nextInt(2) === 0 ? 'replace' : 'append';
    const sectionIndex = kind === 'replace' ? rng.nextInt(doc.sections.length) : doc.sections.length;
    const body = SKILL_EDIT_CANDIDATE_BODIES[rng.nextInt(SKILL_EDIT_CANDIDATE_BODIES.length)];
    const key = skillEditKey(kind, sectionIndex, body);
    if (!rejectedKeys.has(key)) {
      return { proposal: { key, kind, sectionIndex, body }, skipped };
    }
    skipped += 1;
  }
  throw new Error(
    `proposeSkillEdit exhausted ${MAX_PROPOSE_ATTEMPTS} attempts: all sampled proposals are in rejected-edit memory`,
  );
}

/**
 * Apply an edit proposal to a document, returning a new document. `replace`
 * swaps the body at `sectionIndex`; `append` adds `body` as a new final
 * section. Pure — the input document is not mutated.
 */
export function applySkillEdit(doc: SkillDoc, proposal: SkillEditProposal): SkillDoc {
  const sections =
    proposal.kind === 'replace'
      ? doc.sections.map((section, index) => (index === proposal.sectionIndex ? proposal.body : section))
      : [...doc.sections, proposal.body];
  return { sections };
}

/**
 * Whether an edit proposal is within bounds: the body must be non-empty and no
 * longer than `maxSectionChars`, and a `replace` must target an existing
 * section index.
 */
export function isBoundedEdit(doc: SkillDoc, proposal: SkillEditProposal, maxSectionChars: number): boolean {
  if (proposal.body.length === 0 || proposal.body.length > maxSectionChars) {
    return false;
  }
  if (proposal.kind === 'replace' && (proposal.sectionIndex < 0 || proposal.sectionIndex >= doc.sections.length)) {
    return false;
  }
  return true;
}

/** Options controlling {@link optimizeSkillDoc}. */
export interface OptimizeSkillDocOptions {
  /** Number of propose -> validate -> gate iterations to run. */
  readonly iterations: number;
  /** Seed for the deterministic proposal sampler. */
  readonly seed: number;
  /** Per-section character bound enforced by {@link isBoundedEdit}. */
  readonly maxSectionChars: number;
}

/** One row of the optimization log emitted by {@link optimizeSkillDoc}. */
export interface OptimizationLogRow {
  readonly iteration: number;
  readonly proposalKey: string;
  readonly candidateScore: number;
  readonly accepted: boolean;
  readonly skipped: number;
}

/**
 * Eval-gated bounded hill-climb over a skill document.
 *
 * Each iteration proposes a bounded edit, validates the resulting candidate,
 * and accepts it only if the validator score strictly improves. Rejected edits
 * (out of bounds, or no score improvement) are recorded in rejected-edit memory
 * so they are skipped on future proposals.
 */
export function optimizeSkillDoc(
  doc: SkillDoc,
  validate: (doc: SkillDoc) => number,
  options: OptimizeSkillDocOptions,
): { bestDoc: SkillDoc; accepted: number; rejected: RejectedEdit[]; log: OptimizationLogRow[] } {
  const rng = new SeededLcg(options.seed);
  const rejected: RejectedEdit[] = [];
  const log: OptimizationLogRow[] = [];
  let bestDoc = doc;
  let bestScore = validate(doc);
  let accepted = 0;

  for (let iteration = 1; iteration <= options.iterations; iteration += 1) {
    const { proposal, skipped } = proposeSkillEdit(bestDoc, rng, rejected);
    const bounded = isBoundedEdit(bestDoc, proposal, options.maxSectionChars);
    const candidate = bounded ? applySkillEdit(bestDoc, proposal) : null;
    const candidateScore = candidate === null ? bestScore - 1 : validate(candidate);

    let isAccepted = false;
    if (candidate !== null && candidateScore > bestScore) {
      bestDoc = candidate;
      bestScore = candidateScore;
      accepted += 1;
      isAccepted = true;
    } else {
      rejected.push({ key: proposal.key, reason: candidate === null ? 'out-of-bounds' : 'no-improvement' });
    }

    log.push({ iteration, proposalKey: proposal.key, candidateScore, accepted: isAccepted, skipped });
  }

  return { bestDoc, accepted, rejected, log };
}

/**
 * Build a `SkillDefinition.policyGates`-compatible eval-gate that only allows a
 * candidate skill document to be promoted when its validator score meets
 * `threshold`.
 *
 * The returned gate maps a candidate document to a {@link PolicyGateResult},
 * matching the `PolicyGateResult` union used by `agent-browser`'s
 * `skillContracts.ts` without depending on that package.
 */
export function createSkillPromotionGate(
  validate: (doc: SkillDoc) => number,
  threshold: number,
): (candidateDoc: SkillDoc) => PolicyGateResult {
  return (candidateDoc: SkillDoc): PolicyGateResult => {
    const score = validate(candidateDoc);
    if (score >= threshold) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `skill validation score ${score} is below promotion threshold ${threshold}`,
    };
  };
}
