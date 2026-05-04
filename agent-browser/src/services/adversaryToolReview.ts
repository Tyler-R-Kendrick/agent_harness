export type AdversaryToolReviewDecision = 'allow' | 'block' | 'escalate';
export type AdversaryToolReviewSeverity = 'low' | 'medium' | 'high';

export interface AdversaryToolReviewSettings {
  enabled: boolean;
  strictMode: boolean;
  customRules: string[];
}

export interface AdversaryToolReviewInput {
  task: string;
  action: string;
  allowedToolIds: string[];
  recentContext: string[];
  settings?: AdversaryToolReviewSettings;
}

export interface AdversaryToolReviewResult {
  decision: AdversaryToolReviewDecision;
  severity: AdversaryToolReviewSeverity;
  summary: string;
  rationale: string[];
  matchedRules: string[];
}

type RuleHit = {
  id: string;
  severity: AdversaryToolReviewSeverity;
  rationale: string;
  blocksWhenStrict?: boolean;
};

export const DEFAULT_ADVERSARY_TOOL_REVIEW_SETTINGS: AdversaryToolReviewSettings = {
  enabled: true,
  strictMode: false,
  customRules: [],
};

const TOOL_LIST_PATTERNS = [
  /\bUse executor tools:\s*([^\n]+)/i,
  /\bAllowed tools:\s*([^\n]+)/i,
  /\bTool selection pass \d+:\s*([^\n]+)/i,
];

const TOKEN_STOPWORDS = new Set([
  'and',
  'are',
  'for',
  'from',
  'into',
  'the',
  'this',
  'that',
  'then',
  'with',
  'your',
  'user',
  'task',
  'use',
  'using',
]);

export function isAdversaryToolReviewSettings(value: unknown): value is AdversaryToolReviewSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && typeof value.strictMode === 'boolean'
    && Array.isArray(value.customRules)
    && value.customRules.every((entry) => typeof entry === 'string')
  );
}

export function normalizeAdversaryToolReviewSettings(
  settings: AdversaryToolReviewSettings = DEFAULT_ADVERSARY_TOOL_REVIEW_SETTINGS,
): AdversaryToolReviewSettings {
  return {
    enabled: settings.enabled,
    strictMode: settings.strictMode,
    customRules: settings.customRules
      .map((rule) => rule.trim())
      .filter((rule, index, rules) => rule.length > 0 && rules.indexOf(rule) === index),
  };
}

export function reviewAdversaryToolAction(input: AdversaryToolReviewInput): AdversaryToolReviewResult {
  const settings = normalizeAdversaryToolReviewSettings(input.settings);
  if (!settings.enabled) {
    return {
      decision: 'allow',
      severity: 'low',
      summary: 'Adversary tool review disabled.',
      rationale: ['The operator has disabled adversary tool-call review.'],
      matchedRules: ['disabled'],
    };
  }

  const action = normalizeText(input.action);
  const task = normalizeText(input.task);
  const context = normalizeText(input.recentContext.join('\n'));
  const allowedToolIds = input.allowedToolIds.map((toolId) => toolId.trim()).filter(Boolean);
  const declaredToolIds = extractDeclaredToolIds(input.action);
  const hits: RuleHit[] = [];

  const unassignedTools = declaredToolIds.filter((toolId) => !allowedToolIds.includes(toolId));
  if (unassignedTools.length > 0) {
    hits.push({
      id: 'unassigned-tool',
      severity: 'high',
      blocksWhenStrict: true,
      rationale: `The action references tool(s) not assigned by policy: ${unassignedTools.join(', ')}.`,
    });
  }

  if (/\b(rm\s+-rf|del\s+\/[sq]|format\s+[a-z]:|drop\s+database|delete\s+.+(?:repo|repository|\.git)|erase\s+.+(?:disk|drive)|shutdown|reboot)\b/i.test(input.action)) {
    hits.push({
      id: 'destructive-action',
      severity: 'high',
      blocksWhenStrict: true,
      rationale: 'The action includes destructive filesystem, database, or host-control language.',
    });
  }

  if (/\b(secret|token|api[_-]?key|password|credential|env(?:ironment)? variable)s?\b/i.test(input.action)) {
    hits.push({
      id: 'credential-exposure',
      severity: 'high',
      blocksWhenStrict: true,
      rationale: 'The action may expose secrets, credentials, tokens, or environment values.',
    });
  }

  const hasPromptInjection = /\b(ignore (?:the )?(?:user|previous|system|instructions?)|disregard (?:the )?(?:user|previous|system|instructions?)|follow page instructions|developer mode|bypass policy|jailbreak)\b/i.test(`${input.action}\n${input.recentContext.join('\n')}`);
  if (hasPromptInjection) {
    hits.push({
      id: 'prompt-injection',
      severity: 'high',
      blocksWhenStrict: true,
      rationale: 'The action or recent context contains prompt-injection or instruction-bypass language.',
    });
  }

  const taskOverlap = overlapScore(tokenize(task), tokenize(action));
  const contextOverlap = overlapScore(tokenize(`${task}\n${context}`), tokenize(action));
  if (task.length > 0 && taskOverlap === 0 && (contextOverlap < 2 || hasPromptInjection)) {
    hits.push({
      id: 'task-drift',
      severity: 'medium',
      blocksWhenStrict: false,
      rationale: 'The action has weak lexical overlap with the original task and recent context.',
    });
  }

  const customRuleHits = settings.customRules.filter((rule) => customRuleMatches(rule, input.task, input.action, input.recentContext));
  if (customRuleHits.length > 0) {
    hits.push({
      id: 'custom-rule',
      severity: 'medium',
      blocksWhenStrict: false,
      rationale: `Matched operator rule(s): ${customRuleHits.join('; ')}.`,
    });
  }

  if (hits.length === 0) {
    return {
      decision: 'allow',
      severity: 'low',
      summary: 'Adversary review allowed the action.',
      rationale: [
        'The action is grounded in the user task and does not match configured risk rules.',
      ],
      matchedRules: ['task-grounded'],
    };
  }

  const severity = maxSeverity(hits.map((hit) => hit.severity));
  const hasStrictBlock = settings.strictMode && hits.some((hit) => hit.blocksWhenStrict || hit.severity === 'high');
  const decision: AdversaryToolReviewDecision = hasStrictBlock ? 'block' : 'escalate';
  return {
    decision,
    severity,
    summary: decision === 'block'
      ? 'Adversary review blocked the action before execution.'
      : 'Adversary review requires operator approval before execution.',
    rationale: hits.map((hit) => hit.rationale),
    matchedRules: hits.map((hit) => hit.id).filter((id, index, ids) => ids.indexOf(id) === index),
  };
}

function extractDeclaredToolIds(action: string): string[] {
  const ids = new Set<string>();
  for (const pattern of TOOL_LIST_PATTERNS) {
    const match = pattern.exec(action);
    if (!match) continue;
    const listSegment = match[1].replace(/\.\s.*$/, '');
    for (const rawId of listSegment.split(/[,;]/)) {
      const id = rawId.trim().replace(/^["'`]+|["'`.]+$/g, '');
      if (id && id !== '(none)') ids.add(id);
    }
  }
  for (const match of action.matchAll(/<tool_call>\s*\{[\s\S]*?"tool"\s*:\s*"([^"]+)"/gi)) {
    ids.add(match[1]);
  }
  for (const match of action.matchAll(/\b(?:tool|toolName)"?\s*:\s*"([^"]+)"/gi)) {
    ids.add(match[1]);
  }
  return [...ids];
}

function customRuleMatches(rule: string, task: string, action: string, recentContext: readonly string[]): boolean {
  const ruleTokens = tokenize(rule);
  if (ruleTokens.size === 0) return false;
  const haystack = normalizeText([task, action, ...recentContext].join('\n'));
  const haystackTokens = tokenize(haystack);
  const requiredOverlap = Math.min(2, ruleTokens.size);
  return overlapScore(ruleTokens, haystackTokens) >= requiredOverlap;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenize(value: string): Set<string> {
  return new Set(value
    .toLowerCase()
    .replace(/[^a-z0-9_:/.-]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !TOKEN_STOPWORDS.has(token)));
}

function overlapScore(left: Set<string>, right: Set<string>): number {
  let score = 0;
  for (const token of left) {
    if (right.has(token)) score += 1;
  }
  return score;
}

function maxSeverity(severities: AdversaryToolReviewSeverity[]): AdversaryToolReviewSeverity {
  if (severities.includes('high')) return 'high';
  if (severities.includes('medium')) return 'medium';
  return 'low';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
