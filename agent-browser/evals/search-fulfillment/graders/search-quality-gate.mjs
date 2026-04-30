import { readFileSync } from 'node:fs';

function readStdinJson() {
  const input = readFileSync(0, 'utf8');
  return input.trim() ? JSON.parse(input) : {};
}

function readFileBackedOutput(data) {
  if (data.output !== null && data.output !== undefined) return data.output;
  if (typeof data.output_path !== 'string' || data.output_path.trim().length === 0) {
    return data.output;
  }
  try {
    return JSON.parse(readFileSync(data.output_path, 'utf8'));
  } catch {
    return data.output;
  }
}

function textFromMessageValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((entry) => (
      typeof entry?.content === 'string' ? entry.content : JSON.stringify(entry)
    )).join('\n');
  }
  return value ? JSON.stringify(value) : '';
}

function parseContract(value) {
  const text = textFromMessageValue(value);
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

function outputMessages(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : parsed.output ?? [{ role: 'assistant', content: value }];
    } catch {
      return [{ role: 'assistant', content: value }];
    }
  }
  if (value?.output && Array.isArray(value.output)) return value.output;
  return value ? [value] : [];
}

function collectToolCalls(messages) {
  return messages.flatMap((message) => Array.isArray(message?.tool_calls) ? message.tool_calls : []);
}

function includesInsensitive(value, expected) {
  return value.toLowerCase().includes(String(expected).toLowerCase());
}

function renderedEntityLabels(answer) {
  const markdownLabels = [...answer.matchAll(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g)]
    .map((match) => match[1].trim());
  const listLabels = [...answer.matchAll(/^\s*\d+[.)]\s+([^-\n]+?)(?:\s+-|\n|$)/gm)]
    .map((match) => match[1].replace(/\[|\]|\([^)]*\)/g, '').trim())
    .filter(Boolean);
  return [...new Set([...markdownLabels, ...listLabels])];
}

function labelLooksLikePageChrome(label, forbiddenLabels = [], contract = {}) {
  if (forbiddenLabels.some((forbidden) => String(forbidden).toLowerCase() === label.toLowerCase())) return true;
  if ((contract.badLabels ?? []).some((forbidden) => String(forbidden).toLowerCase() === label.toLowerCase())) return true;
  if (/^(?:movies?|theaters?|theatres?|cinemas?|showt?imes?|tickets?|reviews?|menu|directions|home|search|find)$/i.test(label)) return true;
  if (/\b(?:sign\s*in|join|fan\s*club|at\s+home|streaming|coming\s+soon|movie\s+charts?|movie\s+news|screen\s+reader|ticketing|featured|trailers?|showt?imes?|update\s+zip(?:code)?|skip\s+to\s+main\s+content)\b/i.test(label)) return true;
  if (/\b(?:yelp|yellow\s+pages|restaurantji|restaurant\s+guru|tripadvisor|foursquare|google|directory|guide|source|best\s+\d+|top\s+\d+)\b/i.test(label)
    && /\b(?:best|top|closest|nearest|near|in|bars?|restaurants?|cafes?|coffee|parks?|theaters?|theatres?|cinemas?|museums?|bookstores?|gyms?|venues?)\b/i.test(label)) {
    return true;
  }
  if (/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(label) && /\b(?:update|zip(?:code)?|postal|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(label)) return true;
  return false;
}

function normalizeComparable(value) {
  return String(value ?? '')
    .replace(/^the\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function lastWord(value) {
  return String(value ?? '').toLowerCase().match(/[a-z0-9]+(?=[^a-z0-9]*$)/i)?.[0] ?? '';
}

function rhymesWith(value, target) {
  const word = lastWord(value);
  const normalizedTarget = String(target ?? '').toLowerCase();
  if (!word || !normalizedTarget) return false;
  const tail = normalizedTarget.length <= 3 ? normalizedTarget.slice(-2) : normalizedTarget.slice(-3);
  return word.endsWith(tail);
}

function answerAcknowledgesShortfall(value, validationContract = {}) {
  if (!/\b(?:could not|could only|unable to|insufficient|not enough|cannot verify|couldn't verify|unmet|shortfall)\b/i.test(value)) {
    return false;
  }
  return (validationContract.constraints ?? [])
    .filter((constraint) => constraint.required !== false)
    .some((constraint) => {
      if (constraint.value === undefined) return value.toLowerCase().includes(String(constraint.type ?? '').replace('_', ' '));
      if (Array.isArray(constraint.value)) {
        return constraint.value.some((entry) => value.toLowerCase().includes(String(entry).toLowerCase()));
      }
      return value.toLowerCase().includes(String(constraint.value).toLowerCase());
    });
}

function contractConstraintAssertions(validationContract, answer, labels, expectedContract) {
  if (!validationContract || !Array.isArray(validationContract.constraints)) return [];
  const allowAcknowledgedPartial = validationContract.successSemantics === 'allow-partial-with-acknowledgement'
    && answerAcknowledgesShortfall(answer, validationContract);
  const assertions = [];
  const addConstraint = (constraint, passed, evidence) => {
    assertions.push({
      text: `validation contract ${constraint.id}`,
      passed: passed || allowAcknowledgedPartial,
      evidence,
    });
  };

  for (const constraint of validationContract.constraints.filter((item) => item.required !== false)) {
    const value = constraint.value;
    switch (constraint.type) {
      case 'count':
        addConstraint(
          constraint,
          labels.length >= Number(value ?? 0),
          `${labels.length}/${Number(value ?? 0)} labels: ${labels.join(', ')}`,
        );
        break;
      case 'name_prefix':
        addConstraint(
          constraint,
          labels.length > 0 && labels.every((label) => label.toLowerCase().startsWith(String(value ?? '').toLowerCase())),
          labels.join(', ') || answer,
        );
        break;
      case 'name_suffix':
        addConstraint(
          constraint,
          labels.length > 0 && labels.every((label) => label.toLowerCase().endsWith(String(value ?? '').toLowerCase())),
          labels.join(', ') || answer,
        );
        break;
      case 'rhyme':
        addConstraint(
          constraint,
          labels.length > 0 && labels.every((label) => rhymesWith(label, value)),
          labels.join(', ') || answer,
        );
        break;
      case 'exclusion': {
        const excluded = Array.isArray(value) ? value.map(String) : [];
        addConstraint(
          constraint,
          labels.every((label) => !excluded.some((excludedLabel) => normalizeComparable(label) === normalizeComparable(excludedLabel))),
          labels.join(', ') || answer,
        );
        break;
      }
      case 'location':
        addConstraint(
          constraint,
          !value || includesInsensitive(answer, value),
          answer,
        );
        break;
      case 'entity_link':
        addConstraint(
          constraint,
          labels.length > 0 && /\[[^\]]+\]\(https?:\/\/[^)]+\)/.test(answer),
          answer,
        );
        break;
      case 'source_evidence':
        addConstraint(
          constraint,
          labels.length > 0 && /\b(?:why|source|evidence|listed|found|verified|location evidence)\b/i.test(answer),
          answer,
        );
        break;
      case 'page_chrome': {
        const badLabels = labels.filter((label) => labelLooksLikePageChrome(label, expectedContract.forbiddenLabels ?? [], expectedContract));
        addConstraint(constraint, badLabels.length === 0, badLabels.join(', ') || answer);
        break;
      }
      case 'subject':
        addConstraint(
          constraint,
          labels.length > 0 && (!value || includesInsensitive(answer, value)),
          answer,
        );
        break;
      default:
        addConstraint(constraint, true, 'No deterministic checker for this constraint type; deferred to AgentV rubric/llm-grader.');
        break;
    }
  }
  return assertions;
}

const data = readStdinJson();
const contract = parseContract(data.expected_output);
const messages = outputMessages(readFileBackedOutput(data));
const answer = messages.map((message) => textFromMessageValue(message?.content ?? message)).join('\n');
const toolCalls = collectToolCalls(messages);
const toolNames = toolCalls.map((call) => call.tool ?? call.name).filter(Boolean);
const assertions = [];

function add(text, passed, evidence) {
  assertions.push({ text, passed, ...(evidence ? { evidence } : {}) });
}

function isInsufficientEvidenceAnswer(value) {
  return /could not|could only verify|insufficient|no validated|verify enough|not enough|aborted|unavailable|no search results found|search issue|please provide a search source/i.test(value);
}

const semanticOnly = contract.semanticOnly === true;
const semanticInsufficientEvidence = semanticOnly && isInsufficientEvidenceAnswer(answer);

const expectedSequence = semanticInsufficientEvidence
  ? [
      'webmcp:recall_user_context',
      'webmcp:search_web',
      'validation-agent',
    ]
  : [
  'webmcp:recall_user_context',
  'webmcp:search_web',
  'search-analyzer',
  'webmcp:read_web_page',
  'validation-agent',
  'post-processor',
  'verification-agent',
];

const expectsInsufficientEvidence = !semanticOnly
  && /insufficient|blocked|no-publish/i.test(String(contract.expectedResult ?? ''));
const requestedEntityCount = Number.isFinite(Number(contract.minimumAcceptedEntities))
  ? Number(contract.minimumAcceptedEntities)
  : Number.isFinite(Number(contract.requestedCount))
    ? Number(contract.requestedCount)
    : Number.isFinite(Number(contract.minEntities))
      ? Number(contract.minEntities)
      : undefined;

let cursor = 0;
if (toolNames.length === 0) {
  add('tool trajectory is scored by the AgentV tool-trajectory evaluator', true);
} else {
  for (const expected of expectedSequence) {
    const index = toolNames.findIndex((name, candidateIndex) => candidateIndex >= cursor && name === expected);
    if (index === -1) {
      add(`tool trajectory includes ${expected}`, false, toolNames.join(' -> '));
    } else {
      add(`tool trajectory includes ${expected}`, true);
      cursor = index + 1;
    }
  }
}

if (semanticOnly) {
  const labels = renderedEntityLabels(answer);
  const badLabels = labels.filter((label) => labelLooksLikePageChrome(label, contract.forbiddenLabels ?? [], contract));
  if (semanticInsufficientEvidence) {
    add('semantic live output may report insufficient evidence instead of fabricating entities', true, answer);
    add('semantic live insufficient-evidence output does not publish page chrome labels', badLabels.length === 0, badLabels.join(', '));
  } else {
    add(
      `semantic live output lists at least ${contract.minEntities ?? 1} linked requested entities`,
      labels.length >= (contract.minEntities ?? 1),
      answer,
    );
    add('semantic live output rejects page chrome labels as entities', badLabels.length === 0, badLabels.join(', '));
    if (contract.subject) {
      add('semantic live output includes the requested subject context', includesInsensitive(answer, contract.subject), answer);
    }
    if (contract.location) {
      add('semantic live output includes location or proximity context', includesInsensitive(answer, contract.location), answer);
    }
  }
} else if (expectsInsufficientEvidence) {
  add(
    'insufficient-evidence cases must not publish a fabricated entity list',
    isInsufficientEvidenceAnswer(answer),
    answer,
  );
} else {
  if (requestedEntityCount !== undefined) {
    const labels = renderedEntityLabels(answer);
    add(
      `answer renders at least ${requestedEntityCount} requested entities`,
      labels.length >= requestedEntityCount,
      labels.join(', ') || answer,
    );
  }
  for (const entity of contract.expectedEntities ?? []) {
    add(`answer contains expected entity ${entity}`, includesInsensitive(answer, entity), answer);
    add(`answer links expected entity ${entity}`, new RegExp(`\\[${entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\(https?://`, 'i').test(answer), answer);
  }
}
if (!expectsInsufficientEvidence) {
  for (const location of contract.expectedLocations ?? []) {
    add(`answer includes location evidence ${location}`, includesInsensitive(answer, location), answer);
  }
}

if (contract.negative) {
  add('negative runtime response is not published as the final answer', !includesInsensitive(answer, contract.badAnswer ?? ''), answer);
  const labels = renderedEntityLabels(answer);
  for (const label of contract.badLabels ?? []) {
    add(`bad label ${label} is not published as an entity`, !labels.some((candidate) => candidate.toLowerCase() === String(label).toLowerCase()), answer);
  }
}

for (const label of contract.forbiddenLabels ?? []) {
  const labels = renderedEntityLabels(answer);
  add(`forbidden page chrome ${label} is not rendered as an entity`, !labels.some((candidate) => candidate.toLowerCase() === String(label).toLowerCase()), answer);
}

for (const label of contract.excludedCandidates ?? []) {
  const labels = renderedEntityLabels(answer);
  add(`excluded prior candidate ${label} is not rendered again`, !labels.some((candidate) => candidate.toLowerCase() === String(label).toLowerCase()), answer);
}

for (const assertion of contractConstraintAssertions(
  contract.validationContract,
  answer,
  renderedEntityLabels(answer),
  contract,
)) {
  assertions.push(assertion);
}

const passed = assertions.filter((assertion) => assertion.passed).length;
console.log(JSON.stringify({
  score: assertions.length === 0 ? 0 : passed / assertions.length,
  assertions,
  reasoning: `Passed ${passed}/${assertions.length} AgentEvals search-quality checks.`,
}));
