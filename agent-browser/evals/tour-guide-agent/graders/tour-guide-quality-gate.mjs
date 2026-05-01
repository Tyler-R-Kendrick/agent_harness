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
const registryCall = toolCalls.find((call) => (call.tool ?? call.name) === 'tour-feature-registry');
const tourCall = toolCalls.find((call) => (call.tool ?? call.name) === 'driverjs-tour-plan');
const registryOutput = parseJsonObject(registryCall?.output);
const tourOutput = parseJsonObject(tourCall?.output);
const prompt = String(registryOutput.prompt ?? answer);
const plan = parseJsonObject(tourOutput.plan ?? tourOutput);
const targetIds = Array.isArray(plan.steps)
  ? plan.steps.map((step) => step.targetId ?? step.target_id).filter(Boolean)
  : [];
const expectedTargetIds = contract.expectedTargetIds ?? messages[0]?.metadata?.expectedTargetIds ?? [];
const assertions = [];

function add(text, passed, evidence) {
  assertions.push({ text, passed, ...(evidence ? { evidence } : {}) });
}

add('feature registry tool is called', Boolean(registryCall), toolNames.join(' -> '));
add('Driver.js tour plan tool is called', Boolean(tourCall), toolNames.join(' -> '));
add(
  'feature registry feeds Driver.js plan',
  Boolean(registryCall && tourCall && toolCalls.indexOf(registryCall) < toolCalls.indexOf(tourCall)),
  toolNames.join(' -> '),
);

for (const targetId of expectedTargetIds) {
  add(`tour includes ${targetId}`, targetIds.includes(targetId), targetIds.join(', '));
}

add('Driver.js policy is active', /driver\.js/i.test(prompt) && /structured tour plan/i.test(prompt), prompt);
add('known target registry is active', /known target registry/i.test(prompt), prompt);
add('AgentBus telemetry is required', /AgentBus/i.test(prompt), prompt);
add('unsafe selectors are rejected', !/querySelectorAll\('\*'\)|eval\(|document\.body\.innerHTML|free-form DOM|unsafe selector/i.test(answer), answer);
add('tour has at least two target-backed steps', targetIds.length >= 2, JSON.stringify(plan));

const passed = assertions.filter((assertion) => assertion.passed).length;
console.log(JSON.stringify({
  score: assertions.length === 0 ? 0 : passed / assertions.length,
  assertions,
  reasoning: `Passed ${passed}/${assertions.length} AgentEvals tour-guide checks.`,
}));
