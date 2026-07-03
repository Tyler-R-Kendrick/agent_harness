import type { GenomeInput, GenomeScores, HarnessArchive, HarnessGenome } from '@agent-harness/harness-archive';
import type { HarnessEvolutionPlan } from './harnessEvolution';

export interface HarnessEvolutionGenomeOptions {
  parentId?: string | null;
  generation?: number;
  scores?: GenomeScores;
}

/**
 * Map a {@link HarnessEvolutionPlan} to a {@link GenomeInput} for the
 * content-addressed harness archive.
 *
 * The `definition` embeds the plan summary plus a stable JSON of the key plan
 * fields so two structurally identical plans canonicalize to the same archive
 * id. Scores default to a neutral `{ quality: 0, cost: 0 }` (Phase 1 record-only:
 * nothing consumes these yet), `parentId` defaults to `null`, `generation` to 0.
 */
export function createHarnessEvolutionGenomeInput(
  plan: HarnessEvolutionPlan,
  options: HarnessEvolutionGenomeOptions = {},
): GenomeInput {
  const definition = [
    plan.summary,
    JSON.stringify({
      enabled: plan.enabled,
      componentId: plan.componentId,
      sandboxId: plan.sandboxId,
      sandboxPath: plan.sandboxPath,
      patchPackageCommand: plan.patchPackageCommand,
      validationCommands: plan.validationCommands,
      adoptionGate: plan.adoptionGate,
      fallbackActions: plan.fallbackActions,
      protectedScopes: plan.protectedScopes,
      visualValidationRequired: plan.visualValidationRequired,
    }),
  ].join('\n');

  return {
    parentId: options.parentId ?? null,
    summary: plan.summary,
    definition,
    scores: options.scores ?? { quality: 0, cost: 0 },
    generation: options.generation ?? 0,
  };
}

/**
 * Best-effort record of a harness-evolution plan into the archive.
 *
 * Phase 1 record-only: this must never break the evolution flow, so any archive
 * failure is swallowed and `undefined` is returned. On success it returns the
 * recorded (or deduped) genome.
 */
export async function recordHarnessEvolutionGenome(
  archive: HarnessArchive,
  plan: HarnessEvolutionPlan,
  options: HarnessEvolutionGenomeOptions = {},
): Promise<HarnessGenome | undefined> {
  try {
    return await archive.record(createHarnessEvolutionGenomeInput(plan, options));
  } catch (error) {
    console.error('recordHarnessEvolutionGenome: failed', error);
    return undefined;
  }
}
