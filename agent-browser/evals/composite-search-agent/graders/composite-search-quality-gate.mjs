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

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
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

function textFromMessageValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((entry) => (
      typeof entry?.content === 'string' ? entry.content : JSON.stringify(entry)
    )).join('\n');
  }
  return value ? JSON.stringify(value) : '';
}

function collectToolCalls(messages) {
  return messages.flatMap((message) => Array.isArray(message?.tool_calls) ? message.tool_calls : []);
}

const data = readStdinJson();
const contract = parseJsonObject(data.expected_output);
const messages = outputMessages(readFileBackedOutput(data));
const answer = messages.map((message) => textFromMessageValue(message?.content ?? message)).join('\n');
const toolCalls = collectToolCalls(messages);
const toolNames = toolCalls.map((call) => call.tool ?? call.name).filter(Boolean);
const registryCall = toolCalls.find((call) => (call.tool ?? call.name) === 'search-provider-registry');
const fanInCall = toolCalls.find((call) => (call.tool ?? call.name) === 'search-fan-in-merger');
const registryOutput = parseJsonObject(registryCall?.output);
const expectedToolIds = contract.expectedToolIds ?? messages[0]?.metadata?.expectedToolIds ?? [];
const prompt = String(registryOutput.prompt ?? answer);
const selectedToolIds = Array.isArray(registryOutput.selectedToolIds) ? registryOutput.selectedToolIds : [];
const policy = parseJsonObject(registryOutput.policy);
const assertions = [];

function add(text, passed, evidence) {
  assertions.push({ text, passed, ...(evidence ? { evidence } : {}) });
}

add('provider registry tool is called', Boolean(registryCall), toolNames.join(' -> '));
add('fan-in merger is called', Boolean(fanInCall), toolNames.join(' -> '));
add(
  'provider registry feeds fan-in merger',
  Boolean(registryCall && fanInCall && toolCalls.indexOf(registryCall) < toolCalls.indexOf(fanInCall)),
  toolNames.join(' -> '),
);

for (const toolId of expectedToolIds) {
  add(`selected tools include ${toolId}`, selectedToolIds.includes(toolId), selectedToolIds.join(', '));
}

add('provider registry policy is active', /provider registry/i.test(prompt) && /provider adapters/i.test(prompt), prompt);
add('crawler depth policy is active', /crawler depth/i.test(prompt) && /content extraction/i.test(prompt), prompt);
add('dynamic reranking policy is active', /dynamic reranking/i.test(prompt) && /provider weights/i.test(prompt), prompt);
add('recoverable provider errors are preserved', /recoverable provider error/i.test(prompt) && /structured errors/i.test(prompt), prompt);
add('ad hoc shell HTML parser fallback is forbidden', !/node -e|generic CLI HTML parser/i.test(answer), answer);
add('composite policy gate passes', policy.passed === true && Number(policy.score) >= 1, JSON.stringify(policy));

const passed = assertions.filter((assertion) => assertion.passed).length;
console.log(JSON.stringify({
  score: assertions.length === 0 ? 0 : passed / assertions.length,
  assertions,
  reasoning: `Passed ${passed}/${assertions.length} AgentEvals composite search checks.`,
}));
