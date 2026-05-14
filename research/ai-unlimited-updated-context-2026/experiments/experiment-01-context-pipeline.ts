export interface SourceDoc {
  readonly sourceId: string;
  readonly title: string;
  readonly body: string;
  readonly updatedAt: string;
}

export interface PendingItem {
  readonly sourceId: string;
}

export interface WikiPage {
  readonly topic: string;
  readonly facts: readonly string[];
  readonly sources: readonly string[];
}

export interface PipelineConfig {
  readonly hotCharBudget: number;
}

export interface RunEvent {
  readonly runId: string;
  readonly processed: number;
  readonly hotChars: number;
}

export interface ContextPipelineState {
  readonly pending: readonly PendingItem[];
  readonly wiki: ReadonlyMap<string, WikiPage>;
  readonly hotContext: string;
  readonly log: readonly RunEvent[];
}

export const DEFAULT_CONFIG: PipelineConfig = {
  hotCharBudget: 800,
};

export function ingestSources(docs: readonly SourceDoc[]): PendingItem[] {
  return docs
    .map((doc) => ({ sourceId: doc.sourceId }))
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

export function compileWiki(
  docs: readonly SourceDoc[],
  pending: readonly PendingItem[],
  priorWiki: ReadonlyMap<string, WikiPage>,
): Map<string, WikiPage> {
  const next = new Map(priorWiki);
  const index = new Map(docs.map((doc) => [doc.sourceId, doc]));

  for (const item of pending) {
    const doc = index.get(item.sourceId);
    if (!doc) {
      continue;
    }

    next.set(doc.title, {
      topic: doc.title,
      facts: [doc.body.trim()],
      sources: [doc.sourceId],
    });
  }

  return next;
}

export function buildHotContext(wiki: ReadonlyMap<string, WikiPage>, maxChars: number): string {
  const sorted = [...wiki.values()].sort((a, b) => a.topic.localeCompare(b.topic));
  const lines: string[] = [];

  for (const page of sorted) {
    const line = `- ${page.topic}: ${page.facts[0]} [src:${page.sources.join(',')}]`;
    lines.push(line);
    if (lines.join('\n').length > maxChars) {
      lines.pop();
      break;
    }
  }

  return lines.join('\n');
}

export function appendRun(log: readonly RunEvent[], event: RunEvent): RunEvent[] {
  return [...log, event];
}

export function runPipeline(
  docs: readonly SourceDoc[],
  previous: ContextPipelineState,
  config: PipelineConfig = DEFAULT_CONFIG,
): ContextPipelineState {
  const pending = ingestSources(docs);
  const wiki = compileWiki(docs, pending, previous.wiki);
  const hotContext = buildHotContext(wiki, config.hotCharBudget);
  const event: RunEvent = {
    runId: `run-${previous.log.length + 1}`,
    processed: pending.length,
    hotChars: hotContext.length,
  };

  return {
    pending,
    wiki,
    hotContext,
    log: appendRun(previous.log, event),
  };
}

export function emptyState(): ContextPipelineState {
  return {
    pending: [],
    wiki: new Map(),
    hotContext: '',
    log: [],
  };
}
