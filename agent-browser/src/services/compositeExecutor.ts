import type { SkillDefinition, TaskEnvelope } from './skillContracts';
import type { SkillRoutingDecision } from './skillRouter';
import { buildSkillRouteTelemetry, routeTaskToSkill } from './skillRouter';

export interface CompositeExecutionStepTelemetry {
  event: 'skill.step';
  taskId: string;
  depth: number;
  step: number;
  skillId: string;
}

export interface CompositeExecutionOptions {
  maxDepth?: number;
  maxSteps?: number;
  emitTelemetry?: (event: CompositeExecutionStepTelemetry | ReturnType<typeof buildSkillRouteTelemetry>) => void;
}

const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_MAX_STEPS = 16;

export async function executeCompositeTask<TOutput = unknown>(
  task: TaskEnvelope,
  skills: SkillDefinition[],
  options: CompositeExecutionOptions = {},
): Promise<TOutput> {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  let stepCount = 0;

  async function run(currentTask: TaskEnvelope, depth: number): Promise<unknown> {
    if (depth > maxDepth) throw new Error(`Composite execution exceeded maxDepth=${maxDepth}.`);
    stepCount += 1;
    if (stepCount > maxSteps) throw new Error(`Composite execution exceeded maxSteps=${maxSteps}.`);

    const decision: SkillRoutingDecision = routeTaskToSkill(currentTask, skills);
    options.emitTelemetry?.(buildSkillRouteTelemetry(currentTask, decision));
    options.emitTelemetry?.({
      event: 'skill.step',
      taskId: currentTask.taskId,
      depth,
      step: stepCount,
      skillId: decision.selectedSkillId,
    });

    const skill = skills.find((candidate) => candidate.id === decision.selectedSkillId);
    if (!skill) throw new Error(`Skill '${decision.selectedSkillId}' was selected but not found in registry.`);

    const output = await skill.execute(currentTask);
    const nextTask = (output as { nextTask?: TaskEnvelope }).nextTask;
    if (nextTask) {
      return run(nextTask, depth + 1);
    }

    return output;
  }

  return run(task, 1) as Promise<TOutput>;
}
