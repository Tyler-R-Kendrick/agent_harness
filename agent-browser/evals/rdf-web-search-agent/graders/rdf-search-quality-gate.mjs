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

function includesInsensitive(value, expected) {
  return String(value ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
}

const data = readStdinJson();
const contract = parseJsonObject(data.expected_output);
const messages = outputMessages(readFileBackedOutput(data));
const answer = messages.map((message) => textFromMessageValue(message?.content ?? message)).join('\n');
const toolCalls = collectToolCalls(messages);
const toolNames = toolCalls.map((call) => call.tool ?? call.name).filter(Boolean);
const semanticCall = toolCalls.find((call) => (call.tool ?? call.name) === 'webmcp:semantic_search');
const fanInCall = toolCalls.find((call) => (call.tool ?? call.name) === 'search-fan-in-merger');
const semanticOutput = parseJsonObject(semanticCall?.output);
const expectedToolIds = contract.expectedToolIds ?? messages[0]?.metadata?.expectedToolIds ?? [];
const prompt = String(semanticOutput.prompt ?? answer);
const selectedToolIds = Array.isArray(semanticOutput.selectedToolIds) ? semanticOutput.selectedToolIds : [];
const policy = parseJsonObject(semanticOutput.policy);
const assertions = [];

function add(text, passed, evidence) {
  assertions.push({ text, passed, ...(evidence ? { evidence } : {}) });
}

add('semantic search tool is called', Boolean(semanticCall), toolNames.join(' -> '));
add('fan-in merger is called', Boolean(fanInCall), toolNames.join(' -> '));
add(
  'semantic search feeds the fan-in merger after RDF search',
  Boolean(semanticCall && fanInCall && toolCalls.indexOf(semanticCall) < toolCalls.indexOf(fanInCall)),
  toolNames.join(' -> '),
);

for (const toolId of expectedToolIds) {
  add(`selected tools include ${toolId}`, selectedToolIds.includes(toolId), selectedToolIds.join(', '));
}

add('Wikidata public RDF endpoint policy is active', /Wikidata Query Service/i.test(prompt), prompt);
add('safe template policy is active', /safe SPARQL templates/i.test(prompt) && /escape user strings/i.test(prompt) && /validate QIDs/i.test(prompt), prompt);
add('bounded limit policy is active', /clamp LIMIT/i.test(prompt), prompt);
add('citation policy is active', /clickable citations/i.test(prompt) && /Wikidata IDs/i.test(prompt), prompt);
add('recoverable endpoint error policy is active', /timeout, CORS, non-2xx, parse, and endpoint errors/i.test(prompt) && /structured errors/i.test(prompt), prompt);
add('fan-in reranking policy is active', /fan-in merge/i.test(prompt) && /RDF semantic search/i.test(prompt) && /rerank/i.test(prompt), prompt);
add('RDF policy gate passes', policy.passed === true && Number(policy.score) >= 1, JSON.stringify(policy));
add('paid APIs are not required', !/Tavily API key|paid search APIs|Require an LLM API key/i.test(answer), answer);

if (contract.requiresFanIn) {
  add(
    'fan-in branch names web search and RDF semantic search',
    includesInsensitive(answer, 'web search') && includesInsensitive(answer, 'RDF semantic search'),
    answer,
  );
}

const passed = assertions.filter((assertion) => assertion.passed).length;
console.log(JSON.stringify({
  score: assertions.length === 0 ? 0 : passed / assertions.length,
  assertions,
  reasoning: `Passed ${passed}/${assertions.length} AgentEvals RDF web search checks.`,
}));
