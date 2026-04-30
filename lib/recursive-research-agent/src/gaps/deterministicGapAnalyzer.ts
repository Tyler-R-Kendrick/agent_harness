import type { EvidenceItem, GapAnalyzer, ResearchGap, ResearchTask } from '../types';
import { domainFromUrl } from '../utils/domain';
import { stableHash } from '../utils/hash';

export class DeterministicGapAnalyzer implements GapAnalyzer {
  async analyze(args: Parameters<GapAnalyzer['analyze']>[0]): Promise<{ gaps: ResearchGap[] }> {
    const gaps: ResearchGap[] = [];
    for (const criterion of args.task.successCriteria) {
      if (!criterionAddressed(criterion, args.evidence)) {
        gaps.push(gap(`criterion:${criterion}`, `Need stronger evidence about ${criterion}.`, 0.78, [queryFor(args.task, criterion)], `Success criterion "${criterion}" is not addressed by strong evidence.`));
      }
    }
    const domains = new Set(args.evidence.map((item) => domainFromUrl(item.url)).filter(Boolean));
    if (args.evidence.length > 0 && domains.size < 2) {
      gaps.push(gap('source-diversity', 'Need more source diversity beyond the currently concentrated domains.', 0.68, [`${args.task.question} independent sources`], 'Evidence is concentrated in one domain.'));
    }
    if (needsFreshness(args.task) && !args.evidence.some((item) => new RegExp(String(new Date().getFullYear())).test(item.text))) {
      gaps.push(gap('freshness', 'Need current-year freshness evidence for this recent/current task.', 0.72, [`${args.task.question} ${new Date().getFullYear()}`], 'The task asks for recent information but evidence lacks current-year signals.'));
    }
    if (args.evidence.filter((item) => item.quality.overall >= 0.7).length < 3) {
      gaps.push(gap('evidence-sufficiency', 'Need at least three strong evidence items before finalizing.', 0.64, [`${args.task.question} cited sources`], 'Fewer than three strong evidence items are available.'));
    }
    return { gaps: mergeWithPrevious(gaps, args.previousGaps) };
  }
}

function criterionAddressed(criterion: string, evidence: EvidenceItem[]): boolean {
  const words = criterion.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return evidence.filter((item) => item.quality.relevance >= 0.6)
    .some((item) => words.every((word) => item.text.toLowerCase().includes(word)));
}

function gap(key: string, description: string, priority: number, suggestedQueries: string[], reason: string): ResearchGap {
  return { id: `gap-${stableHash(key)}`, description, priority, suggestedQueries, reason, status: 'open' };
}

function queryFor(task: ResearchTask, criterion: string): string {
  return `${task.question} ${criterion}`.replace(/\s+/g, ' ').trim();
}

function needsFreshness(task: ResearchTask): boolean {
  return task.scope?.freshness !== undefined && task.scope.freshness !== 'any'
    || /\b(?:latest|current|recent|today|this week)\b/i.test(task.question);
}

function mergeWithPrevious(gaps: ResearchGap[], previous: ResearchGap[]): ResearchGap[] {
  const byDescription = new Map(previous.map((item) => [item.description, item]));
  return gaps.map((item) => byDescription.get(item.description) ?? item);
}
