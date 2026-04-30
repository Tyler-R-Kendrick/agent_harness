import { DEFAULT_RESEARCH_BUDGET, DEFAULT_SUCCESS_CRITERIA } from '../defaults';
import { FrontierQueue } from '../frontier/FrontierQueue';
import { MutableResearchGraph } from '../graph/ResearchGraph';
import type { RecursiveResearchRequest, ResearchBudget, ResearchState, ResearchTask } from '../types';
import { stableHash } from '../utils/hash';
import { nowMs } from '../utils/time';

export function initializeState(
  request: RecursiveResearchRequest,
  defaults: Partial<ResearchBudget> = {},
): ResearchState {
  const question = request.question.trim();
  if (question.length === 0) throw new Error('RecursiveResearchAgent requires a non-empty question.');
  const budget = { ...DEFAULT_RESEARCH_BUDGET, ...defaults, ...(request.budget ?? {}) };
  const task: ResearchTask = {
    id: `task-${stableHash(question)}`,
    question,
    objective: request.objective ?? 'answer_question',
    ...(request.scope ? { scope: request.scope } : {}),
    successCriteria: request.successCriteria?.length ? request.successCriteria : DEFAULT_SUCCESS_CRITERIA,
  };
  const graph = new MutableResearchGraph();
  graph.addNode({ id: task.id, type: 'task', value: question, metadata: { objective: task.objective } });
  const startedAt = nowMs();
  return {
    id: `recursive-research-${stableHash(`${question}:${startedAt}`)}`,
    task,
    budget,
    frontier: new FrontierQueue({ maxSize: budget.maxFrontierSize }),
    visited: [],
    evidence: [],
    citations: [],
    claims: [],
    gaps: [],
    decisions: [],
    graph,
    errors: [],
    counters: { iterations: 0, searchQueriesExecuted: 0, urlsFetched: 0 },
    startedAt,
    deadlineAt: startedAt + budget.maxRuntimeMs,
    metadata: request.metadata,
  };
}
