export type OperatorId = 'preprocess' | 'embed' | 'retrieve' | 'reason';

export interface WorkflowRecord {
  readonly id: number;
  readonly prompt: string;
  readonly tokens: readonly string[];
  readonly embedding?: readonly number[];
  readonly retrievedDocs?: readonly string[];
  readonly answer?: string;
}

export interface BatchEnvelope<T> {
  readonly records: readonly T[];
  readonly batchId: string;
}

export interface Operator<T> {
  readonly id: OperatorId;
  readonly priority: number;
  run(batch: BatchEnvelope<T>): BatchEnvelope<T>;
}

export interface SchedulerConfig {
  readonly batchSize: number;
}

export class DeterministicScheduler<T> {
  constructor(
    private readonly operators: readonly Operator<T>[],
    private readonly config: SchedulerConfig,
  ) {}

  execute(records: readonly T[]): readonly T[] {
    const stableOperators = [...this.operators].sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.id.localeCompare(b.id);
    });

    const output: T[] = [];
    let cursor = 0;

    while (cursor < records.length) {
      const next = records.slice(cursor, cursor + this.config.batchSize);
      cursor += next.length;

      let envelope: BatchEnvelope<T> = {
        records: next,
        batchId: `batch-${cursor}`,
      };

      for (const operator of stableOperators) {
        envelope = operator.run(envelope);
      }

      output.push(...envelope.records);
    }

    return output;
  }
}

export function tokenize(record: WorkflowRecord): WorkflowRecord {
  return {
    ...record,
    tokens: record.prompt.toLowerCase().split(/\s+/g).filter(Boolean),
  };
}

export function fakeEmbed(record: WorkflowRecord): WorkflowRecord {
  const sum = record.tokens.reduce((acc, token) => acc + token.length, 0);
  return {
    ...record,
    embedding: [sum, record.tokens.length],
  };
}

export function fakeRetrieve(record: WorkflowRecord): WorkflowRecord {
  const key = record.tokens[0] ?? 'default';
  return {
    ...record,
    retrievedDocs: [`doc:${key}:1`, `doc:${key}:2`],
  };
}

export function fakeReason(record: WorkflowRecord): WorkflowRecord {
  return {
    ...record,
    answer: `answer:${record.id}:${record.retrievedDocs?.length ?? 0}`,
  };
}
