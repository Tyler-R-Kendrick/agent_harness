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
const expectedSequence = [
  'request-complexity-router',
  'benchmark-objective-router',
  'routing-policy-guard',
  'final-route-decision',
];
const metadata = messages[0]?.metadata ?? {};
const expectations = { ...metadata, ...contract };
const finalCall = toolCalls.find((call) => (call.tool ?? call.name) === 'final-route-decision');
const benchmarkCall = toolCalls.find((call) => (call.tool ?? call.name) === 'benchmark-objective-router');
const guardCall = toolCalls.find((call) => (call.tool ?? call.name) === 'routing-policy-guard');
const finalOutput = parseJsonObject(finalCall?.output);
const benchmarkOutput = parseJsonObject(benchmarkCall?.output);
const guardOutput = parseJsonObject(guardCall?.output);
const reasoningText = [
  answer,
  String(finalOutput.reason ?? ''),
  String(finalOutput.mergedReason ?? ''),
  String(benchmarkOutput.reason ?? ''),
  Array.isArray(guardOutput.complexityReasons) ? guardOutput.complexityReasons.join(' ') : '',
].join('\n');
const assertions = [];

function add(text, passed, evidence) {
  assertions.push({ text, passed, ...(evidence ? { evidence } : {}) });
}

add(
  'routing stages execute in order',
  expectedSequence.every((tool, index) => toolNames[index] === tool),
  toolNames.join(' -> '),
);
add(
  'expected benchmark route is preserved before guard evaluation',
  benchmarkOutput.benchmarkRef === expectations.expectedBenchmarkRef,
  JSON.stringify(benchmarkOutput),
);
add(
  'expected final route is selected',
  finalOutput.selectedRef === expectations.expectedRouteRef,
  JSON.stringify(finalOutput),
);
add(
  'expected final model class is selected',
  finalOutput.selectedModelClass === expectations.expectedModelClass,
  JSON.stringify(finalOutput),
);
add(
  'expected task class is preserved',
  finalOutput.taskClass === expectations.expectedTaskClass,
  JSON.stringify(finalOutput),
);
add(
  'policy override state matches expectation',
  Boolean(guardOutput.overrideApplied) === Boolean(expectations.expectedOverrideApplied),
  JSON.stringify(guardOutput),
);

for (const phrase of expectations.expectedReasonIncludes ?? []) {
  add(`reasoning mentions ${phrase}`, reasoningText.includes(phrase), reasoningText);
}

if (expectations.requiresPolicyInvariants) {
  add(
    'policy invariants mention objective-weighted default routing',
    answer.includes('Objective-weighted routes stay active when no premium-safe override triggers.'),
    answer,
  );
  add(
    'policy invariants mention premium-safe escalation conditions',
    answer.includes('Security, critical, or low-confidence prompts escalate to a premium-safe candidate set.'),
    answer,
  );
  add(
    'policy invariants mention staged rollout gating before enforce mode',
    answer.includes('Enforce mode only activates after staged rollout eval coverage passes.'),
    answer,
  );
}

const passed = assertions.filter((assertion) => assertion.passed).length;
console.log(JSON.stringify({
  score: assertions.length === 0 ? 0 : passed / assertions.length,
  assertions,
  reasoning: `Passed ${passed}/${assertions.length} staged routing rollout checks.`,
}));
