import type { SkillDefinition, TaskEnvelope } from './skillContracts';

export type SkillRoutingReasonCode =
  | 'capability-match'
  | 'exact-task-type-match'
  | 'policy-blocked'
  | 'fallback-low-confidence'
  | 'no-capability-match';

export interface RankedSkillCandidate {
  skillId: string;
  score: number;
  reasonCodes: SkillRoutingReasonCode[];
  blockedByPolicy: boolean;
}

export interface SkillRouteTelemetry {
  event: 'skill.route';
  taskId: string;
  selectedSkillId: string;
  confidence: number;
  reasonCode: SkillRoutingReasonCode;
  ranking: RankedSkillCandidate[];
}

export interface SkillRoutingDecision {
  selectedSkillId: string;
  confidence: number;
  reasonCode: SkillRoutingReasonCode;
  ranking: RankedSkillCandidate[];
}

export function routeTaskToSkill(task: TaskEnvelope, skills: SkillDefinition[]): SkillRoutingDecision {
  const ranked = skills.map((skill): RankedSkillCandidate => {
    const capabilityOverlap = task.capabilityTags.filter((tag) => skill.capabilityTags.includes(tag)).length;
    const exactTypeMatch = skill.id === task.taskType ? 1 : 0;
    const baseScore = capabilityOverlap * 10 + exactTypeMatch * 25;
    const gateResult = skill.policyGates?.map((gate) => gate(task)).find((result) => !result.allowed);
    if (gateResult) {
      return {
        skillId: skill.id,
        score: -1,
        reasonCodes: ['policy-blocked'],
        blockedByPolicy: true,
      };
    }

    const reasons: SkillRoutingReasonCode[] = [];
    if (exactTypeMatch) reasons.push('exact-task-type-match');
    if (capabilityOverlap > 0) reasons.push('capability-match');
    if (reasons.length === 0) reasons.push('no-capability-match');

    return {
      skillId: skill.id,
      score: baseScore,
      reasonCodes: reasons,
      blockedByPolicy: false,
    };
  }).sort((left, right) => right.score - left.score || left.skillId.localeCompare(right.skillId));

  const top = ranked.find((candidate) => !candidate.blockedByPolicy);
  if (!top) {
    throw new Error('No eligible skill candidates were available after policy gates.');
  }

  const second = ranked.filter((candidate) => !candidate.blockedByPolicy)[1];
  const margin = second ? top.score - second.score : top.score;
  const confidence = Math.max(0, Math.min(1, Number((margin / 25).toFixed(2))));

  if (confidence < 0.4) {
    return {
      selectedSkillId: top.skillId,
      confidence,
      reasonCode: 'fallback-low-confidence',
      ranking: ranked,
    };
  }

  return {
    selectedSkillId: top.skillId,
    confidence,
    reasonCode: top.reasonCodes[0] ?? 'capability-match',
    ranking: ranked,
  };
}

export function buildSkillRouteTelemetry(task: TaskEnvelope, decision: SkillRoutingDecision): SkillRouteTelemetry {
  return {
    event: 'skill.route',
    taskId: task.taskId,
    selectedSkillId: decision.selectedSkillId,
    confidence: decision.confidence,
    reasonCode: decision.reasonCode,
    ranking: decision.ranking,
  };
}
