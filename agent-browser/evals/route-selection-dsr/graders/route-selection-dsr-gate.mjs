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

function add(assertions, text, passed, evidence) {
  assertions.push({ text, passed, ...(evidence ? { evidence } : {}) });
}

const data = readStdinJson();
const contract = parseJsonObject(data.expected_output);
const messages = outputMessages(readFileBackedOutput(data));
const answer = messages.map((message) => textFromMessageValue(message?.content ?? message)).join('\n');
const toolCalls = collectToolCalls(messages);
const toolNames = toolCalls.map((call) => call.tool ?? call.name).filter(Boolean);
const routeCall = toolCalls.find((call) => (call.tool ?? call.name) === contract.routeSelectorTool);
const familyCall = toolCalls.find((call) => (call.tool ?? call.name) === contract.selectedFamilyTool);
const metadata = messages[0]?.metadata ?? {};
const route = String(metadata.route ?? '');
const expectedRoute = String(metadata.expectedRoute ?? contract.expectedRoute ?? '');
const usedFallback = Boolean(metadata.usedFallback);
const latencyMs = Number(metadata.latencyMs ?? data.duration_ms ?? 0);
const assertions = [];

add(assertions, 'route-selection tool is called', Boolean(routeCall), toolNames.join(' -> '));
add(assertions, 'selected family tool is called', Boolean(familyCall), toolNames.join(' -> '));
add(
  assertions,
  'route-selection runs before the chosen family tool',
  Boolean(routeCall && familyCall && toolCalls.indexOf(routeCall) < toolCalls.indexOf(familyCall)),
  toolNames.join(' -> '),
);
add(assertions, 'DSR route matches expected route', route === expectedRoute, `${route} vs ${expectedRoute}`);
add(
  assertions,
  'selected family matches expected family',
  String(metadata.family ?? '') === String(contract.family ?? ''),
  `${String(metadata.family ?? '')} vs ${String(contract.family ?? '')}`,
);
add(
  assertions,
  'fallback behavior matches contract',
  usedFallback === Boolean(contract.expectFallback),
  `${usedFallback} vs ${Boolean(contract.expectFallback)}`,
);
add(
  assertions,
  'DSR latency stays within the case budget',
  Number.isFinite(latencyMs) && latencyMs <= Number(contract.maxLatencyMs ?? Number.POSITIVE_INFINITY),
  `${latencyMs}ms <= ${String(contract.maxLatencyMs ?? 'n/a')}ms`,
);
add(
  assertions,
  'DSR latency does not regress versus legacy',
  Number.isFinite(latencyMs) && latencyMs <= Number(contract.legacyLatencyMs ?? Number.POSITIVE_INFINITY),
  `${latencyMs}ms <= ${String(contract.legacyLatencyMs ?? 'n/a')}ms`,
);
add(
  assertions,
  'assistant summary names the expected route and family',
  answer.includes(expectedRoute) && answer.includes(String(contract.family ?? '')),
  answer,
);

const passed = assertions.filter((assertion) => assertion.passed).length;
console.log(JSON.stringify({
  score: assertions.length === 0 ? 0 : passed / assertions.length,
  assertions,
  reasoning: `Passed ${passed}/${assertions.length} route-selection DSR checks.`,
}));
