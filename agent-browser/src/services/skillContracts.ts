export type CapabilityTag =
  | 'planning'
  | 'coding'
  | 'testing'
  | 'research'
  | 'analysis'
  | 'review'
  | 'automation'
  | (string & {});

export interface TaskEnvelope<TInput = unknown, TOutput = unknown> {
  taskId: string;
  taskType: string;
  input: TInput;
  capabilityTags: CapabilityTag[];
  policyContext?: {
    workspaceId?: string;
    userRole?: string;
    restrictedTags?: CapabilityTag[];
  };
  metadata?: Record<string, unknown>;
  expectedOutput?: TOutput;
}

export type PolicyGateResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export interface SkillDefinition<TInput = unknown, TOutput = unknown> {
  id: string;
  displayName: string;
  capabilityTags: CapabilityTag[];
  inputSchemaHint: string;
  outputSchemaHint: string;
  policyGates?: Array<(task: TaskEnvelope<TInput, TOutput>) => PolicyGateResult>;
  execute: (task: TaskEnvelope<TInput, TOutput>) => Promise<TOutput>;
}
