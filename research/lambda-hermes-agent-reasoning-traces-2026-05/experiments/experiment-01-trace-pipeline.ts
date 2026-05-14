export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface RawMessage {
  readonly role: Role;
  readonly content: string;
  readonly name?: string;
}

export interface RawTraceConversation {
  readonly id: string;
  readonly category: string;
  readonly messages: readonly RawMessage[];
}

export type EventKind = 'reasoning' | 'tool_call' | 'tool_result' | 'assistant_output';

export interface ParsedEvent {
  readonly conversationId: string;
  readonly step: number;
  readonly kind: EventKind;
  readonly content: string;
}

export interface ParsedTrace {
  readonly id: string;
  readonly category: string;
  readonly events: readonly ParsedEvent[];
}

export interface TraceAnalytics {
  readonly conversationCount: number;
  readonly avgReasoningSteps: number;
  readonly avgToolCalls: number;
  readonly toolResultRate: number;
}

export interface VizPoint {
  readonly conversationId: string;
  readonly step: number;
  readonly kind: EventKind;
}

export interface SftExample {
  readonly prompt: string;
  readonly response: string;
  readonly metadata: {
    readonly conversationId: string;
    readonly category: string;
  };
}

export function classifyAssistantContent(content: string): EventKind {
  if (content.includes('<tool_call>')) return 'tool_call';
  if (content.includes('<think>')) return 'reasoning';
  return 'assistant_output';
}

export function parseConversation(conversation: RawTraceConversation): ParsedTrace {
  const events: ParsedEvent[] = [];

  for (const [index, message] of conversation.messages.entries()) {
    if (message.role === 'assistant') {
      events.push({
        conversationId: conversation.id,
        step: index,
        kind: classifyAssistantContent(message.content),
        content: message.content,
      });
      continue;
    }

    if (message.role === 'tool') {
      events.push({
        conversationId: conversation.id,
        step: index,
        kind: 'tool_result',
        content: message.content,
      });
    }
  }

  return {
    id: conversation.id,
    category: conversation.category,
    events,
  };
}

export function analyzeTraces(traces: readonly ParsedTrace[]): TraceAnalytics {
  const conversationCount = traces.length;
  if (conversationCount === 0) {
    return { conversationCount: 0, avgReasoningSteps: 0, avgToolCalls: 0, toolResultRate: 0 };
  }

  const reasoningSteps = traces.map((trace) => trace.events.filter((event) => event.kind === 'reasoning').length);
  const toolCalls = traces.map((trace) => trace.events.filter((event) => event.kind === 'tool_call').length);
  const toolResults = traces.map((trace) => trace.events.filter((event) => event.kind === 'tool_result').length);

  const totalReasoning = reasoningSteps.reduce((acc, value) => acc + value, 0);
  const totalToolCalls = toolCalls.reduce((acc, value) => acc + value, 0);
  const totalToolResults = toolResults.reduce((acc, value) => acc + value, 0);

  return {
    conversationCount,
    avgReasoningSteps: totalReasoning / conversationCount,
    avgToolCalls: totalToolCalls / conversationCount,
    toolResultRate: totalToolCalls === 0 ? 0 : totalToolResults / totalToolCalls,
  };
}

export function toVisualizationSeries(trace: ParsedTrace): VizPoint[] {
  return trace.events.map((event) => ({
    conversationId: trace.id,
    step: event.step,
    kind: event.kind,
  }));
}

export function isEligibleForSft(trace: ParsedTrace): boolean {
  const hasOutput = trace.events.some((event) => event.kind === 'assistant_output');
  const hasUserSignal = trace.events.length > 0;
  return hasOutput && hasUserSignal;
}

export function buildSftExamples(rawConversations: readonly RawTraceConversation[]): SftExample[] {
  return rawConversations
    .map((conversation) => ({
      raw: conversation,
      parsed: parseConversation(conversation),
    }))
    .filter(({ parsed }) => isEligibleForSft(parsed))
    .map(({ raw }) => {
      const prompt = raw.messages
        .filter((message) => message.role === 'user')
        .map((message) => message.content.trim())
        .join('\n');

      const response = raw.messages
        .filter((message) => message.role === 'assistant' && !message.content.includes('<think>'))
        .map((message) => message.content.trim())
        .join('\n');

      return {
        prompt,
        response,
        metadata: {
          conversationId: raw.id,
          category: raw.category,
        },
      };
    })
    .filter((example) => example.prompt.length > 0 && example.response.length > 0);
}

export const TRACE_FIXTURE: readonly RawTraceConversation[] = [
  {
    id: 'trace-001',
    category: 'web-research',
    messages: [
      { role: 'user', content: 'Find the latest price of product X.' },
      { role: 'assistant', content: '<think>I should query the price API.</think>' },
      { role: 'assistant', content: '<tool_call>{"tool":"price_lookup","query":"product X"}</tool_call>' },
      { role: 'tool', name: 'price_lookup', content: '{"price": 19.99, "currency": "USD"}' },
      { role: 'assistant', content: 'The latest listed price is $19.99 USD.' },
    ],
  },
];

export function runExperimentFixture(): {
  readonly parsed: readonly ParsedTrace[];
  readonly analytics: TraceAnalytics;
  readonly series: readonly VizPoint[];
  readonly sft: readonly SftExample[];
} {
  const parsed = TRACE_FIXTURE.map(parseConversation);
  const analytics = analyzeTraces(parsed);
  const series = parsed.flatMap(toVisualizationSeries);
  const sft = buildSftExamples(TRACE_FIXTURE);

  return { parsed, analytics, series, sft };
}
