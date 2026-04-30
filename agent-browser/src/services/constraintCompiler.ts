import type {
  SearchTurnContext,
  ValidationConstraint,
  ValidationContract,
} from '../types';

export interface CompileValidationContractOptions {
  taskText: string;
  resolvedTaskText?: string;
  context?: SearchTurnContext;
  subject?: string;
  location?: string;
  requestedCount?: number;
  excludedCandidateNames?: string[];
  legacyCriteria?: string[];
}

export interface ConstraintEvaluationCandidate {
  name: string;
  entityLink?: string;
  subjectMatch?: boolean;
  locationEvidence?: string[];
  sourceEvidence?: string[];
}

export interface ConstraintEvaluationFailure {
  constraintId: string;
  reason: string;
  evidence?: string;
}

export interface ConstraintEvaluationResult {
  passed: boolean;
  partial: boolean;
  failures: ConstraintEvaluationFailure[];
}

export function compileValidationContract(options: CompileValidationContractOptions): ValidationContract {
  const taskText = normalizeWhitespace(options.taskText);
  const resolvedTaskText = normalizeWhitespace(options.resolvedTaskText ?? taskText);
  const constraints: ValidationConstraint[] = [];
  const legacyCriteria = [...(options.legacyCriteria ?? [])].filter((item) => item.trim());
  const requestedCount = options.requestedCount ?? extractRequestedCount(taskText);
  const subject = normalizeSubject(options.subject ?? options.context?.subject ?? inferSubject(resolvedTaskText));
  const location = cleanLocation(options.location ?? options.context?.location ?? inferLocation(resolvedTaskText));
  const outsideLocation = cleanLocation(inferOutsideLocation(resolvedTaskText));
  const prefix = inferNameBoundary(resolvedTaskText, 'start');
  const suffix = inferNameBoundary(resolvedTaskText, 'end');
  const rhyme = inferRhymeTarget(resolvedTaskText);
  const exclusions = uniqueStrings([
    ...(options.excludedCandidateNames ?? []),
    ...inferExclusions(taskText),
  ]);
  const entitySeeking = Boolean(subject && subject !== 'results');

  if (requestedCount !== undefined) {
    constraints.push(createConstraint({
      id: 'count:min-results',
      sourceText: taskText,
      type: 'count',
      operator: 'at_least',
      target: 'acceptedCandidates',
      value: requestedCount,
      failureMessage: `Expected at least ${requestedCount} accepted result(s).`,
    }));
  }
  if (entitySeeking) {
    constraints.push(createConstraint({
      id: 'subject:entity-type',
      sourceText: resolvedTaskText,
      type: 'subject',
      operator: 'matches',
      target: 'acceptedCandidates.subject',
      value: subject,
      failureMessage: `Results must be instances of ${subject}.`,
    }));
    constraints.push(createConstraint({
      id: 'link:entity-specific',
      sourceText: resolvedTaskText,
      type: 'entity_link',
      operator: 'has_safe_entity_link',
      target: 'acceptedCandidates.entityLink',
      value: true,
      failureMessage: 'Each rendered result needs a safe source-backed entity link.',
    }));
    constraints.push(createConstraint({
      id: 'source:evidence',
      sourceText: resolvedTaskText,
      type: 'source_evidence',
      operator: 'has_evidence',
      target: 'acceptedCandidates.sourceEvidence',
      value: true,
      failureMessage: 'Each rendered result needs source evidence.',
    }));
    constraints.push(createConstraint({
      id: 'chrome:no-page-labels',
      sourceText: resolvedTaskText,
      type: 'page_chrome',
      operator: 'rejects_page_chrome',
      target: 'finalAnswer.labels',
      value: true,
      failureMessage: 'Page chrome, navigation, source categories, and content buckets cannot be rendered as results.',
    }));
  }
  if (location) {
    constraints.push(createConstraint({
      id: locationOperatorFor(resolvedTaskText) === 'near' ? 'location:nearby' : locationConstraintId('location', location),
      sourceText: resolvedTaskText,
      type: 'location',
      operator: locationOperatorFor(resolvedTaskText),
      target: 'acceptedCandidates.locationEvidence',
      value: location,
      failureMessage: `Results need location or proximity evidence for ${location}.`,
    }));
  }
  if (outsideLocation) {
    constraints.push(createConstraint({
      id: locationConstraintId('outside-location', outsideLocation),
      sourceText: resolvedTaskText,
      type: 'location',
      operator: 'outside',
      target: 'acceptedCandidates.locationEvidence',
      value: outsideLocation,
      failureMessage: `Results must be outside ${outsideLocation}.`,
    }));
  }
  if (prefix) {
    constraints.push(createConstraint({
      id: 'name:prefix',
      sourceText: resolvedTaskText,
      type: 'name_prefix',
      operator: 'starts_with',
      target: 'acceptedCandidates.name',
      value: prefix,
      failureMessage: `Result names must start with ${prefix}.`,
    }));
  }
  if (suffix) {
    constraints.push(createConstraint({
      id: 'name:suffix',
      sourceText: resolvedTaskText,
      type: 'name_suffix',
      operator: 'ends_with',
      target: 'acceptedCandidates.name',
      value: suffix,
      failureMessage: `Result names must end with ${suffix}.`,
    }));
  }
  if (rhyme) {
    constraints.push(createConstraint({
      id: 'name:rhyme',
      sourceText: resolvedTaskText,
      type: 'rhyme',
      operator: 'rhymes_with',
      target: 'acceptedCandidates.name',
      value: rhyme,
      failureMessage: `Result names must rhyme with ${rhyme}.`,
    }));
  }
  if (exclusions.length > 0) {
    constraints.push(createConstraint({
      id: 'exclude:prior-candidates',
      sourceText: taskText,
      type: 'exclusion',
      operator: 'excludes',
      target: 'acceptedCandidates.name',
      value: exclusions,
      failureMessage: `Results must exclude ${exclusions.join(', ')}.`,
    }));
  }

  const contradictory = Boolean(location && outsideLocation && normalizeComparable(location) === normalizeComparable(outsideLocation));
  const fictionalLocation = location && looksFictionalOrUnverifiableLocation(location);
  const successSemantics = requestedCount !== undefined || contradictory || fictionalLocation
    ? 'allow-partial-with-acknowledgement'
    : 'all-required';
  return {
    type: 'validation-contract',
    version: 1,
    taskGoal: resolvedTaskText || taskText,
    constraints,
    evidenceRequirements: buildEvidenceRequirements(constraints),
    impossibilityPolicy: contradictory
      ? {
        kind: 'contradictory',
        reason: `The request contains both in/near and outside constraints for ${location}.`,
        askUserForHelp: true,
      }
      : fictionalLocation
        ? {
          kind: 'likely-impossible',
          reason: `${location} appears fictional or not directly verifiable by normal web/local search evidence.`,
          askUserForHelp: true,
        }
        : { kind: 'none', askUserForHelp: false },
    clarificationTriggers: [
      'required constraint cannot be evaluated from available tool evidence',
      'required constraints conflict or appear impossible',
      'bounded recovery cannot find enough source-backed evidence',
    ],
    successSemantics,
    legacyCriteria,
  };
}

export function validationContractToCriteria(contract: ValidationContract): string[] {
  return [
    `validation-contract:${JSON.stringify(contract)}`,
    ...contract.constraints.map((constraint) => (
      `${constraint.id}: ${constraint.failureMessage}`
    )),
    ...contract.legacyCriteria,
  ];
}

export function evaluateAnswerAgainstValidationContract({
  contract,
  answer,
  acceptedCandidates,
}: {
  contract: ValidationContract;
  answer: string;
  acceptedCandidates: ConstraintEvaluationCandidate[];
}): ConstraintEvaluationResult {
  const labels = renderedEntityLabels(answer);
  const names = acceptedCandidates.map((candidate) => candidate.name);
  const failures: ConstraintEvaluationFailure[] = [];
  const acknowledged = answerAcknowledgesShortfall(answer, contract);
  for (const constraint of contract.constraints) {
    const passed = evaluateConstraint(constraint, acceptedCandidates, labels);
    if (passed) continue;
    if (acknowledged && contract.successSemantics === 'allow-partial-with-acknowledgement') continue;
    failures.push({
      constraintId: constraint.id,
      reason: constraint.failureMessage,
      evidence: names.join(', ') || answer,
    });
  }
  return {
    passed: failures.length === 0,
    partial: acknowledged && contract.successSemantics === 'allow-partial-with-acknowledgement',
    failures,
  };
}

function createConstraint(input: Omit<ValidationConstraint, 'required' | 'confidence' | 'validationMethod'> & {
  required?: boolean;
  confidence?: number;
  validationMethod?: ValidationConstraint['validationMethod'];
}): ValidationConstraint {
  return {
    required: true,
    confidence: 0.9,
    validationMethod: input.type === 'format' ? 'answer-text' : 'structured-candidate',
    ...input,
  };
}

function buildEvidenceRequirements(constraints: ValidationConstraint[]): ValidationContract['evidenceRequirements'] {
  const requirements: ValidationContract['evidenceRequirements'] = [];
  if (constraints.some((constraint) => constraint.type === 'subject')) {
    requirements.push({
      id: 'evidence:subject-instance',
      description: 'Evidence must show each result is an instance of the requested subject.',
      required: true,
      target: 'acceptedCandidates.subjectEvidence',
    });
  }
  if (constraints.some((constraint) => constraint.type === 'location')) {
    requirements.push({
      id: 'evidence:location',
      description: 'Evidence must tie each result to the requested location or proximity.',
      required: true,
      target: 'acceptedCandidates.locationEvidence',
    });
  }
  if (constraints.some((constraint) => constraint.type === 'entity_link')) {
    requirements.push({
      id: 'evidence:entity-link',
      description: 'Evidence must include a safe source-backed entity link.',
      required: true,
      target: 'acceptedCandidates.entityLink',
    });
  }
  return requirements;
}

function evaluateConstraint(
  constraint: ValidationConstraint,
  candidates: ConstraintEvaluationCandidate[],
  labels: string[],
): boolean {
  const names = labels.length > 0 ? labels : candidates.map((candidate) => candidate.name);
  switch (constraint.type) {
    case 'count':
      return candidates.length >= Number(constraint.value ?? 0);
    case 'subject':
      return candidates.length === 0 ? false : candidates.every((candidate) => candidate.subjectMatch === true);
    case 'location':
      return candidates.length === 0 ? false : candidates.every((candidate) => (candidate.locationEvidence ?? []).length > 0);
    case 'entity_link':
      return candidates.length === 0 ? false : candidates.every((candidate) => isSafeExternalUrl(candidate.entityLink ?? ''));
    case 'source_evidence':
      return candidates.length === 0 ? false : candidates.every((candidate) => (candidate.sourceEvidence ?? []).length > 0);
    case 'name_prefix':
      return names.length > 0 && names.every((name) => name.trim().toLocaleLowerCase().startsWith(String(constraint.value ?? '').toLocaleLowerCase()));
    case 'name_suffix':
      return names.length > 0 && names.every((name) => name.trim().toLocaleLowerCase().endsWith(String(constraint.value ?? '').toLocaleLowerCase()));
    case 'rhyme':
      return names.length > 0 && names.every((name) => rhymesWith(name, String(constraint.value ?? '')));
    case 'exclusion': {
      const excluded = Array.isArray(constraint.value) ? constraint.value.map(String) : [];
      return names.every((name) => !excluded.some((excludedName) => normalizeComparable(name) === normalizeComparable(excludedName)));
    }
    case 'page_chrome':
      return names.every((name) => !looksLikeGenericPageLabel(name));
    default:
      return true;
  }
}

function extractRequestedCount(text: string): number | undefined {
  const numeric = text.match(/\b(\d{1,2})\s+(?:more|others?|additional|extra|websites?|shops?|stores?|results?|items?|places?)\b/i)?.[1]
    ?? text.match(/\b(?:show|give|find|list|suggest|recommend|provide)\s+(?:me\s+)?(\d{1,2})\b/i)?.[1];
  if (!numeric) return /\bmore\b/i.test(text) ? 3 : undefined;
  const value = Number.parseInt(numeric, 10);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 50) : undefined;
}

function inferSubject(text: string): string {
  const quoted = text.match(/\b(?:websites?|shops?|stores?|restaurants?|bars?|theaters?|theatres?|cafes?|parks?|museums?|gyms?|bookstores?|venues?)\b/i)?.[0];
  if (quoted) return normalizeSubject(quoted);
  const match = text.match(/\b(?:show|find|list|provide|give|recommend|search for)\s+(?:me\s+)?(?:\d+\s+)?(?:more\s+)?(.+?)(?:\s+(?:near|in|located|that|which|who|with|where|outside)\b|$)/i);
  return normalizeSubject(match?.[1] ?? 'results');
}

function normalizeSubject(value: string | undefined): string {
  const normalized = normalizeWhitespace(value ?? '')
    .replace(/\b(?:best|top|worst|closest|nearest|popular|recommended|open now|highly rated|budget-friendly|family-friendly|quiet|more|additional|extra)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
  return normalized || 'results';
}

function inferLocation(text: string): string | undefined {
  return text.match(/\b(?:near|around|in|located in)\s+(.+?)(?:\s+(?:that|which|who|with|and|but|outside|start|starts|end|ends|rhyme|rhymes|located)\b|$)/i)?.[1];
}

function inferOutsideLocation(text: string): string | undefined {
  return text.match(/\boutside\s+(.+?)(?:\s+(?:that|which|who|with|and|but|start|starts|end|ends|rhyme|rhymes|located)\b|$)/i)?.[1];
}

function inferNameBoundary(text: string, kind: 'start' | 'end'): string | undefined {
  const pattern = kind === 'start'
    ? /\bstarts?\s+with\s+(?:the\s+letter\s+)?["']?([A-Za-z0-9]+)["']?/i
    : /\bends?\s+with\s+(?:the\s+letter\s+)?["']?([A-Za-z0-9]+)["']?/i;
  return text.match(pattern)?.[1];
}

function inferRhymeTarget(text: string): string | undefined {
  return text.match(/\brhymes?\s+with\s+["']?([A-Za-z0-9]+)["']?/i)?.[1];
}

function inferExclusions(text: string): string[] {
  const match = text.match(/\bnot\s+([^,.;]+?)(?:\s+(?:show|give|find|list|suggest|recommend)\b|,|;|\.|$)/i);
  return match?.[1] ? [normalizeWhitespace(match[1])] : [];
}

function locationOperatorFor(text: string): string {
  return /\bnear|around\b/i.test(text) ? 'near' : 'in';
}

function locationConstraintId(prefix: string, location: string): string {
  return `${prefix}:${normalizeComparable(location).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'requested'}`;
}

function cleanLocation(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = normalizeWhitespace(value)
    .replace(/^["']|["']$/g, '')
    .replace(/^(?:the\s+)/i, 'the ')
    .replace(/[?!.]+$/g, '')
    .trim();
  if (/^(?:me|us|my area|our area|here|nearby)$/i.test(cleaned)) return undefined;
  return cleaned || undefined;
}

function looksFictionalOrUnverifiableLocation(value: string): boolean {
  return /\b(?:middle earth|middle-earth|narnia|hogwarts|neverland|wonderland|gotham|metropolis|wakanda)\b/i.test(value);
}

function renderedEntityLabels(answer: string): string[] {
  const markdown = [...answer.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((match) => match[1].trim());
  if (markdown.length > 0) return markdown;
  return [...answer.matchAll(/^\s*\d+\.\s+([^-:\n]+?)(?:\s+-|\s*:|$)/gim)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function answerAcknowledgesShortfall(answer: string, contract: ValidationContract): boolean {
  if (!/\b(?:could not|could only|unable to|insufficient|not enough|cannot verify|couldn't verify)\b/i.test(answer)) return false;
  return contract.constraints
    .filter((constraint) => constraint.required)
    .some((constraint) => {
      if (constraint.value === undefined) return answer.toLocaleLowerCase().includes(constraint.type.replace('_', ' '));
      return answer.toLocaleLowerCase().includes(String(constraint.value).toLocaleLowerCase());
    });
}

function rhymesWith(value: string, target: string): boolean {
  const lastWord = value.toLocaleLowerCase().match(/[a-z0-9]+(?=[^a-z0-9]*$)/i)?.[0] ?? '';
  const normalizedTarget = target.toLocaleLowerCase();
  if (!lastWord || !normalizedTarget) return false;
  const tail = normalizedTarget.length <= 3 ? normalizedTarget.slice(-2) : normalizedTarget.slice(-3);
  return lastWord.endsWith(tail);
}

function looksLikeGenericPageLabel(label: string): boolean {
  return /^(?:home|search|sign in|sign in\/join|fanclub|fan club|movies?|theaters?|theatres?|streaming|coming soon|movie charts?|movie news|skip to main content|tickets?|reviews?)$/i.test(label.trim());
}

function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const normalized = normalizeWhitespace(value);
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) return [];
    seen.add(key);
    return [normalized];
  });
}

function normalizeComparable(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^the\s+/i, '')
    .toLocaleLowerCase();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
