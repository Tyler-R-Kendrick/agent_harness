/**
 * Shared types for the eval-gated skill/steering self-improvement capability.
 *
 * This library fuses two research scaffolds into one typed surface:
 *
 * - Memp procedural-memory lifecycle (`research/memp-2508.06433`): a
 *   candidate -> active -> deprecated state machine with retrieval scoring that
 *   excludes deprecated entries.
 * - SkillOpt bounded-edit eval-gate (`research/skillopt-2605.23904`): bounded
 *   edit proposals accepted only when a validator score improves, with a
 *   rejected-edit memory.
 *
 * The library is self-contained and has no dependency on `agent-browser`. The
 * `PolicyGateResult` union below is redeclared locally so that
 * {@link createSkillPromotionGate} produces a value structurally compatible with
 * `agent-browser`'s `SkillDefinition.policyGates` attach point without importing
 * from that package.
 */

/** Lifecycle state of a learned skill/procedure entry. */
export type SkillLifecycleState = 'candidate' | 'active' | 'deprecated';

/**
 * A single learned procedure entry tracked by the lifecycle state machine.
 * Mirrors the Memp scaffold's memory-entry shape.
 */
export interface SkillLifecycleEntry {
  /** Stable identifier for this entry. */
  readonly id: string;
  /** Task family this procedure applies to (used for retrieval matching). */
  readonly taskFamily: string;
  /** Human-readable summary of the procedure/trajectory. */
  readonly procedure: string;
  /** Number of successful uses observed. */
  readonly successCount: number;
  /** Number of failed uses observed. */
  readonly failureCount: number;
  /** Current lifecycle state. */
  readonly state: SkillLifecycleState;
  /** Tick at which this entry was last exercised. */
  readonly lastUsedTick: number;
}

/** Tunable thresholds that govern lifecycle transitions. */
export interface LifecycleThresholds {
  /** Promote candidate -> active once this many successes accumulate. */
  readonly promoteAfterSuccesses: number;
  /** Deprecate once this many failures accumulate. */
  readonly deprecateAfterFailures: number;
  /** Deprecate a non-success entry once it goes unused for this many ticks. */
  readonly staleAfterTicks: number;
}

/**
 * Result of a policy gate. Structurally compatible with the `PolicyGateResult`
 * union declared by `agent-browser`'s `skillContracts.ts`.
 */
export type PolicyGateResult = { allowed: true } | { allowed: false; reason: string };

/** Kind of a bounded skill-doc edit. */
export type SkillEditKind = 'replace' | 'append';

/**
 * A bounded edit proposal against a {@link SkillDoc}. Mirrors the SkillOpt
 * scaffold's `EditProposal` shape.
 */
export interface SkillEditProposal {
  /** Deterministic identity for rejected-edit memory de-duplication. */
  readonly key: string;
  /** Whether the edit replaces an existing section or appends a new one. */
  readonly kind: SkillEditKind;
  /** Target section index (for `replace`) or the append position. */
  readonly sectionIndex: number;
  /** The new section body. */
  readonly body: string;
}

/** A skill document as an ordered list of section bodies. */
export interface SkillDoc {
  readonly sections: readonly string[];
}

/** A record kept in rejected-edit memory so the same edit is not retried. */
export interface RejectedEdit {
  /** The rejected proposal's {@link SkillEditProposal.key}. */
  readonly key: string;
  /** Why the edit was rejected. */
  readonly reason: string;
}
