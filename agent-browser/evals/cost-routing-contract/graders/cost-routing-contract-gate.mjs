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
const answer = messages.map((message) => textFromMessageValue(message?.content ?? message)).join('\n');
const assertions = [];

function add(text, passed, evidence) {
  assertions.push({ text, passed, ...(evidence ? { evidence } : {}) });
}

add(
  'route output declares the expected model class',
  metadata.selectedModelClass === contract.expectedModelClass,
  `${metadata.selectedModelClass ?? 'missing'} vs ${contract.expectedModelClass ?? 'missing'}`,
);
add(
  'route output includes the selected model ref',
  typeof metadata.selectedModelRef === 'string' && metadata.selectedModelRef.length > 0,
  metadata.selectedModelRef ?? 'missing',
);
add(
  'route output includes a task class',
  typeof metadata.taskClass === 'string' && metadata.taskClass.length > 0,
  metadata.taskClass ?? 'missing',
);
if (typeof contract.requiredReason === 'string' && contract.requiredReason.length > 0) {
  add(
    'route output explains the required escalation reason',
    String(metadata.reasonSummary ?? answer).toLowerCase().includes(contract.requiredReason.toLowerCase()),
    metadata.reasonSummary ?? answer,
  );
}

const passed = assertions.filter((assertion) => assertion.passed).length;
console.log(JSON.stringify({
  score: assertions.length === 0 ? 0 : passed / assertions.length,
  assertions,
  reasoning: `Passed ${passed}/${assertions.length} cost-routing contract checks.`,
}));
