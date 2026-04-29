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

function labelLooksLikePageChrome(label, forbiddenLabels = []) {
  if (forbiddenLabels.some((forbidden) => String(forbidden).toLowerCase() === label.toLowerCase())) return true;
  if (/^(?:movies?|theaters?|theatres?|cinemas?|showt?imes?|tickets?|reviews?|menu|directions|home|search|find)$/i.test(label)) return true;
  if (/\b(?:sign\s*in|join|fan\s*club|at\s+home|streaming|coming\s+soon|movie\s+charts?|movie\s+news|screen\s+reader|ticketing|featured|trailers?|showt?imes?|update\s+zip(?:code)?|skip\s+to\s+main\s+content)\b/i.test(label)) return true;
  if (/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(label) && /\b(?:update|zip(?:code)?|postal|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(label)) return true;
  return false;
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

const expectedSequence = [
  'webmcp:recall_user_context',
  'webmcp:search_web',
  'search-analyzer',
  'webmcp:read_web_page',
  'validation-agent',
  'post-processor',
  'verification-agent',
];

const semanticOnly = contract.semanticOnly === true;
const expectsInsufficientEvidence = !semanticOnly
  && /insufficient|blocked|no-publish/i.test(String(contract.expectedResult ?? ''));

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
  const insufficient = /could not|insufficient|no validated|verify enough|aborted|unavailable/i.test(answer);
  const badLabels = labels.filter((label) => labelLooksLikePageChrome(label, contract.forbiddenLabels ?? []));
  if (insufficient) {
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
    /could not|insufficient|no validated|verify enough|aborted/i.test(answer),
    answer,
  );
} else {
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
  for (const label of contract.badLabels ?? []) {
    add(`bad label ${label} is not published as an entity`, !new RegExp(`\\d+\\.\\s*\\[${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'i').test(answer), answer);
  }
}

for (const label of contract.forbiddenLabels ?? []) {
  add(`forbidden page chrome ${label} is not rendered as an entity`, !new RegExp(`\\d+\\.\\s*\\[${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'i').test(answer), answer);
}

const passed = assertions.filter((assertion) => assertion.passed).length;
console.log(JSON.stringify({
  score: assertions.length === 0 ? 0 : passed / assertions.length,
  assertions,
  reasoning: `Passed ${passed}/${assertions.length} AgentEvals search-quality checks.`,
}));
