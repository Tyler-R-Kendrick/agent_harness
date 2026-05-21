import { readFileSync } from 'node:fs';

function readStdinJson() {
  const input = readFileSync(0, 'utf8');
  return input.trim() ? JSON.parse(input) : {};
}

function readFileBackedOutput(data) {
  if (data.output !== null && data.output !== undefined) return data.output;
  if (typeof data.output_path !== 'string' || data.output_path.trim().length === 0) return data.output;
  try {
    return JSON.parse(readFileSync(data.output_path, 'utf8'));
  } catch {
    return data.output;
  }
}

function parseExpected(value) {
  if (!value) return {};
  if (Array.isArray(value)) {
    const last = value.at(-1);
    return parseExpected(last?.content ?? last);
  }
  if (typeof value === 'object') {
    if ('content' in value) return parseExpected(value.content);
    return value;
  }
  return JSON.parse(value);
}

function outputMessages(value) {
  if (Array.isArray(value)) return value;
  if (value?.output && Array.isArray(value.output)) return value.output;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return outputMessages(parsed);
    } catch {
      return [{ role: 'assistant', content: value }];
    }
  }
  return value ? [value] : [];
}

function textFromMessage(message) {
  const value = message?.content ?? message;
  if (typeof value === 'string') return value;
  return value ? JSON.stringify(value) : '';
}

function collectToolCalls(messages) {
  return messages.flatMap((message) => Array.isArray(message?.tool_calls) ? message.tool_calls : []);
}

function extractEmbeddedBus(answer) {
  const match = answer.match(/\n?\s*<!-- codi-agent-bus:([A-Za-z0-9+/=]+) -->\s*$/);
  if (!match) return { answer, metadata: null };
  try {
    return {
      answer: answer.slice(0, match.index).trim(),
      metadata: JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')),
    };
  } catch {
    return { answer, metadata: null };
  }
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function loadAutoevals() {
  const root = await import('autoevals');
  let json = {};
  try {
    json = await import('autoevals/json');
  } catch {
    json = {};
  }
  return { ...root, ...json };
}

function fallbackScore({ scorerName, output, expected }) {
  if (scorerName === 'ExactMatch') return output === expected ? 1 : 0;
  if (scorerName === 'JSONDiff') {
    return JSON.stringify(parseMaybeJson(output)) === JSON.stringify(expected) ? 1 : 0;
  }
  const outputText = String(output);
  const expectedText = String(expected);
  if (outputText === expectedText) return 1;
  const maxLength = Math.max(outputText.length, expectedText.length, 1);
  const distance = levenshtein(outputText, expectedText);
  return Math.max(0, 1 - distance / maxLength);
}

function levenshtein(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let priorDiagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const deletion = previous[j] + 1;
      const insertion = previous[j - 1] + 1;
      const substitution = priorDiagonal + (left[i - 1] === right[j - 1] ? 0 : 1);
      priorDiagonal = previous[j];
      previous[j] = Math.min(deletion, insertion, substitution);
    }
  }
  return previous[right.length];
}

async function scoreWithAutoevals({ scorerName, output, expected }) {
  const autoevals = await loadAutoevals();
  const scorer = autoevals[scorerName];
  if (typeof scorer !== 'function') {
    return {
      score: fallbackScore({ scorerName, output, expected }),
      metadata: { rationale: `${scorerName} unavailable; deterministic fallback scorer used.` },
    };
  }
  return scorer({ output: parseMaybeJson(output), expected });
}

const data = readStdinJson();
const expected = parseExpected(data.expected_output ?? data.reference_answer);
const messages = outputMessages(readFileBackedOutput(data));
const embedded = extractEmbeddedBus(messages.map(textFromMessage).join('\n'));
const answer = embedded.answer;
const toolCalls = collectToolCalls(messages);
const loopCall = toolCalls.find((call) => (call.tool ?? call.name) === 'codi-chat-loop');
const busTypes = Array.isArray(loopCall?.output?.agentBusTypes)
  ? loopCall.output.agentBusTypes
  : Array.isArray(embedded.metadata?.agentBusTypes)
    ? embedded.metadata.agentBusTypes
    : [];
const busEntries = Array.isArray(loopCall?.output?.agentBus)
  ? loopCall.output.agentBus
  : Array.isArray(embedded.metadata?.agentBus)
    ? embedded.metadata.agentBus
    : [];
const toolExecutions = Array.isArray(loopCall?.output?.toolExecutions)
  ? loopCall.output.toolExecutions
  : Array.isArray(embedded.metadata?.toolExecutions)
    ? embedded.metadata.toolExecutions
    : [];
const inferenceInputs = Array.isArray(loopCall?.output?.inferenceInputs)
  ? loopCall.output.inferenceInputs
  : Array.isArray(embedded.metadata?.inferenceInputs)
    ? embedded.metadata.inferenceInputs
    : [];
const assertions = [];

function add(text, passed, evidence) {
  assertions.push({ text, passed, ...(evidence !== undefined ? { evidence } : {}) });
}

const autoevalResult = await scoreWithAutoevals({
  scorerName: expected.autoevalScorer,
  output: expected.autoevalScorer === 'JSONDiff' ? parseMaybeJson(answer) : answer,
  expected: expected.expected,
});
const autoevalScore = autoevalResult.score ?? 0;
add(`${expected.autoevalScorer} score >= 0.95`, autoevalScore >= 0.95, autoevalResult.metadata?.rationale ?? autoevalScore);

for (const phrase of expected.mustMention ?? []) {
  add(`mentions ${phrase}`, answer.includes(phrase), answer);
}
for (const phrase of expected.mustNotMention ?? []) {
  add(`does not mention ${phrase}`, !answer.toLowerCase().includes(String(phrase).toLowerCase()), answer);
}
for (const busType of expected.requiredBusTypes ?? []) {
  add(`AgentBus includes ${busType}`, busTypes.includes(busType), busTypes.join(' -> '));
}
for (const phrase of expected.requiredIntentMentions ?? []) {
  add(
    `AgentBus intent mentions ${phrase}`,
    busEntries.some((entry) => entry.type === 'Intent' && String(entry.action ?? '').includes(phrase)),
    JSON.stringify(busEntries.filter((entry) => entry.type === 'Intent')),
  );
}
for (const phrase of expected.requiredPromptMentions ?? []) {
  add(
    `inference input includes ${phrase}`,
    inferenceInputs.some((messages) => JSON.stringify(messages).includes(phrase))
      || busEntries.some((entry) => entry.type === 'InfIn' && JSON.stringify(entry.messages ?? '').includes(phrase)),
    JSON.stringify(inferenceInputs),
  );
}
for (const toolId of expected.requiredToolIds ?? []) {
  add(
    `registered tool ${toolId} was executed`,
    toolExecutions.some((execution) => execution.toolId === toolId),
    JSON.stringify(toolExecutions),
  );
}
if (expected.minInfOutCount) {
  add(
    `AgentBus includes at least ${expected.minInfOutCount} InfOut entries`,
    busTypes.filter((type) => type === 'InfOut').length >= expected.minInfOutCount,
    busTypes.join(' -> '),
  );
}
if (expected.minResultCount) {
  add(
    `AgentBus includes at least ${expected.minResultCount} Result entries`,
    busTypes.filter((type) => type === 'Result').length >= expected.minResultCount,
    busTypes.join(' -> '),
  );
}
if (expected.minToolExecutionCount) {
  add(
    `at least ${expected.minToolExecutionCount} registered tool executions occurred`,
    toolExecutions.length >= expected.minToolExecutionCount,
    JSON.stringify(toolExecutions),
  );
}
if (expected.voterId) {
  add(
    `AgentBus includes voter ${expected.voterId}`,
    busEntries.some((entry) => entry.type === 'Vote' && entry.voterId === expected.voterId && entry.approve === true),
    JSON.stringify(busEntries),
  );
}
add('codi-chat-loop tool call is present', Boolean(loopCall), toolCalls.map((call) => call.tool ?? call.name).join(' -> '));

const passed = assertions.filter((assertion) => assertion.passed).length;
console.log(JSON.stringify({
  score: assertions.length === 0 ? 0 : passed / assertions.length,
  assertions,
  reasoning: `Passed ${passed}/${assertions.length} Codi general chat autoeval checks.`,
}));
