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

const data = readStdinJson();
const contract = parseJsonObject(data.expected_output);
const messages = outputMessages(readFileBackedOutput(data));
const metadata = messages[0]?.metadata ?? {};
const toolCalls = Array.isArray(messages[0]?.tool_calls) ? messages[0].tool_calls : [];
const answer = messages.map((message) => textFromMessageValue(message?.content ?? message)).join('\n');
const actualPaths = Array.isArray(metadata.filePaths) ? metadata.filePaths : [];
const assertions = [];

function add(text, passed, evidence) {
  assertions.push({ text, passed, ...(evidence ? { evidence } : {}) });
}

for (const toolId of contract.expectedSelectedToolIds ?? []) {
  add(
    `selected tools include ${toolId}`,
    Array.isArray(metadata.selectedToolIds) && metadata.selectedToolIds.includes(toolId),
    JSON.stringify(metadata.selectedToolIds ?? []),
  );
}

for (const toolId of contract.forbiddenSelectedToolIds ?? []) {
  add(
    `selected tools do not include ${toolId}`,
    !Array.isArray(metadata.selectedToolIds) || !metadata.selectedToolIds.includes(toolId),
    JSON.stringify(metadata.selectedToolIds ?? []),
  );
}

if (typeof contract.expectedStepCount === 'number') {
  add(
    'step count matches expectation',
    metadata.stepCount === contract.expectedStepCount,
    `${metadata.stepCount ?? 'missing'} vs ${contract.expectedStepCount}`,
  );
}

if (typeof contract.expectedKind === 'string') {
  add(
    'artifact kind matches expectation',
    metadata.kind === contract.expectedKind,
    `${metadata.kind ?? 'missing'} vs ${contract.expectedKind}`,
  );
}

if (Array.isArray(contract.expectedPaths) && contract.expectedPaths.length > 0) {
  add(
    'artifact file layout matches expectation',
    contract.expectedPaths.every((expectedPath) => actualPaths.includes(expectedPath)),
    JSON.stringify(actualPaths),
  );
}

if ((contract.expectedStepCount ?? 0) > 0) {
  add(
    'create_artifact executes exactly once for artifact prompts',
    toolCalls.length === 1 && (toolCalls[0]?.tool ?? toolCalls[0]?.name) === 'webmcp:create_artifact',
    JSON.stringify(toolCalls),
  );
} else {
  add(
    'non-artifact regression keeps zero tool executions',
    toolCalls.length === 0,
    JSON.stringify(toolCalls),
  );
}

for (const phrase of contract.forbiddenContentPhrases ?? []) {
  add(
    `response does not leak ${phrase}`,
    !answer.toLowerCase().includes(String(phrase).toLowerCase()),
    answer,
  );
}

const passed = assertions.filter((assertion) => assertion.passed).length;
console.log(JSON.stringify({
  score: assertions.length === 0 ? 0 : passed / assertions.length,
  assertions,
  reasoning: `Passed ${passed}/${assertions.length} artifact-generation contract checks.`,
}));
