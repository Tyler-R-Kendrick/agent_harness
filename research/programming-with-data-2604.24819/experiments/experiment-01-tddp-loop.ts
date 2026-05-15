export type DefectKind = 'concept-gap' | 'reasoning-break';

export interface FailureRecord {
  readonly itemId: string;
  readonly conceptTags: readonly string[];
  readonly reasoningTags: readonly string[];
  readonly severity: number;
}

export interface DefectCluster {
  readonly key: string;
  readonly kind: DefectKind;
  readonly itemIds: readonly string[];
  readonly score: number;
}

export interface PatchCandidate {
  readonly clusterKey: string;
  readonly operations: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly expectedGain: number;
  readonly contradictionRisk: number;
}

export interface AcceptedPatch extends PatchCandidate {
  readonly version: number;
}

export function localizeFailures(failures: readonly FailureRecord[]): DefectCluster[] {
  const buckets = new Map<string, FailureRecord[]>();

  for (const failure of failures) {
    for (const concept of failure.conceptTags) {
      const key = `concept:${concept}`;
      const row = buckets.get(key) ?? [];
      row.push(failure);
      buckets.set(key, row);
    }

    for (const edge of failure.reasoningTags) {
      const key = `reasoning:${edge}`;
      const row = buckets.get(key) ?? [];
      row.push(failure);
      buckets.set(key, row);
    }
  }

  return Array.from(buckets.entries()).map(([key, rows]) => {
    const kind: DefectKind = key.startsWith('concept:') ? 'concept-gap' : 'reasoning-break';
    const itemIds = rows.map((row) => row.itemId);
    const severity = rows.reduce((total, row) => total + row.severity, 0);

    return {
      key,
      kind,
      itemIds,
      score: severity / Math.max(rows.length, 1),
    };
  });
}

export function synthesizePatch(cluster: DefectCluster): PatchCandidate {
  const operation = cluster.kind === 'concept-gap' ? 'add-targeted-examples' : 'add-reasoning-chain-examples';

  return {
    clusterKey: cluster.key,
    operations: [operation, 'attach-counterexample'],
    evidenceRefs: cluster.itemIds.slice(0, 3),
    expectedGain: Math.min(0.4, cluster.score * 0.08),
    contradictionRisk: cluster.kind === 'reasoning-break' ? 0.12 : 0.08,
  };
}

export function validatePatch(candidate: PatchCandidate, minGain = 0.1): boolean {
  if (candidate.evidenceRefs.length === 0) {
    return false;
  }

  if (candidate.expectedGain < minGain) {
    return false;
  }

  return candidate.contradictionRisk <= 0.2;
}

export function runTddpLoop(failures: readonly FailureRecord[]): AcceptedPatch[] {
  const clusters = localizeFailures(failures)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  let version = 1;
  const accepted: AcceptedPatch[] = [];

  for (const cluster of clusters) {
    const candidate = synthesizePatch(cluster);
    if (!validatePatch(candidate)) {
      continue;
    }

    accepted.push({
      ...candidate,
      version,
    });

    version += 1;
  }

  return accepted;
}
