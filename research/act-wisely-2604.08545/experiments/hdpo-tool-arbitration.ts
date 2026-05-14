export type Domain = 'freshness' | 'math' | 'general' | 'policy';

export interface Task {
  id: string;
  domain: Domain;
  prompt: string;
  toolActuallyNeeded: boolean;
  internalConfidence: number; // 0..1 proxy from model self-assessment
}

export interface Decision {
  taskId: string;
  shouldUseTool: boolean;
  reason: 'mandatory-domain' | 'low-confidence' | 'abstain-high-confidence';
}

export interface Metrics {
  totalTasks: number;
  totalToolCalls: number;
  unnecessaryToolCalls: number;
  mandatoryDomainViolations: number;
}

const MANDATORY_TOOL_DOMAINS: ReadonlySet<Domain> = new Set(['freshness', 'policy']);

export function decideToolUse(task: Task, threshold = 0.72): Decision {
  if (MANDATORY_TOOL_DOMAINS.has(task.domain)) {
    return { taskId: task.id, shouldUseTool: true, reason: 'mandatory-domain' };
  }

  if (task.internalConfidence < threshold) {
    return { taskId: task.id, shouldUseTool: true, reason: 'low-confidence' };
  }

  return {
    taskId: task.id,
    shouldUseTool: false,
    reason: 'abstain-high-confidence',
  };
}

export function runPolicy(tasks: Task[], threshold = 0.72): Metrics {
  let totalToolCalls = 0;
  let unnecessaryToolCalls = 0;
  let mandatoryDomainViolations = 0;

  for (const task of tasks) {
    const d = decideToolUse(task, threshold);

    if (d.shouldUseTool) {
      totalToolCalls += 1;
      if (!task.toolActuallyNeeded) {
        unnecessaryToolCalls += 1;
      }
    }

    if (MANDATORY_TOOL_DOMAINS.has(task.domain) && !d.shouldUseTool) {
      mandatoryDomainViolations += 1;
    }
  }

  return {
    totalTasks: tasks.length,
    totalToolCalls,
    unnecessaryToolCalls,
    mandatoryDomainViolations,
  };
}

export function runAlwaysToolBaseline(tasks: Task[]): Metrics {
  let unnecessaryToolCalls = 0;

  for (const task of tasks) {
    if (!task.toolActuallyNeeded) {
      unnecessaryToolCalls += 1;
    }
  }

  return {
    totalTasks: tasks.length,
    totalToolCalls: tasks.length,
    unnecessaryToolCalls,
    mandatoryDomainViolations: 0,
  };
}

if (process.argv[1] && process.argv[1].endsWith('hdpo-tool-arbitration.ts')) {
  const sampleTasks: Task[] = [
    { id: 't1', domain: 'math', prompt: '2+2', toolActuallyNeeded: false, internalConfidence: 0.94 },
    { id: 't2', domain: 'freshness', prompt: 'today stock price', toolActuallyNeeded: true, internalConfidence: 0.91 },
    { id: 't3', domain: 'general', prompt: 'summarize paragraph', toolActuallyNeeded: false, internalConfidence: 0.83 },
    { id: 't4', domain: 'policy', prompt: 'legal filing deadline', toolActuallyNeeded: true, internalConfidence: 0.77 },
    { id: 't5', domain: 'general', prompt: 'obscure fact', toolActuallyNeeded: true, internalConfidence: 0.41 },
  ];

  const baseline = runAlwaysToolBaseline(sampleTasks);
  const candidate = runPolicy(sampleTasks, 0.72);

  console.log('baseline', baseline);
  console.log('candidate', candidate);
}
