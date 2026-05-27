import { defineCodeGrader } from '@agentv/eval';

const BLOCKING_FAILURE_PATTERNS = [
  /could not produce an executable plan/i,
  /requires operator approval/i,
  /adversary tool review requires operator approval/i,
  /adversary tool review blocked/i,
  /credential-exposure/i,
];

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => (
      typeof part?.text === 'string' ? part.text : JSON.stringify(part)
    )).join('\n');
  }
  return content ? JSON.stringify(content) : '';
}

function parseExpected(input) {
  const text = textFromContent(input.expectedOutput?.[0]?.content ?? '{}');
  return JSON.parse(text);
}

function outputMessages(input) {
  if (Array.isArray(input.output)) return input.output;
  return [];
}

function collectToolCalls(messages) {
  return messages.flatMap((message) => Array.isArray(message.toolCalls) ? message.toolCalls : []);
}

function answerText(messages) {
  return messages.map((message) => textFromContent(message.content)).join('\n');
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

function linkedEntity(answer, entity) {
  return new RegExp(`\\[${entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\(https?://`, 'i').test(answer);
}

function extractEmbeddedMetadata(answer, toolCalls) {
  const embedded = answer.match(/<!--\s*codi-staged-search:([A-Za-z0-9+/=]+)\s*-->/);
  if (embedded) {
    return JSON.parse(Buffer.from(embedded[1], 'base64').toString('utf8'));
  }
  const aggregate = toolCalls.find((call) => call.tool === 'codi-staged-search');
  return aggregate?.output?.metadata ?? aggregate?.output;
}

function runScore(text, expected) {
  const checks = [];
  for (const entity of expected.expectedEntities ?? []) {
    checks.push(includesInsensitive(text, entity));
    checks.push(linkedEntity(text, entity));
  }
  const labels = renderedEntityLabels(text);
  for (const label of [...(expected.badLabels ?? []), ...(expected.forbiddenLabels ?? [])]) {
    checks.push(!labels.some((candidate) => candidate.toLowerCase() === String(label).toLowerCase()));
  }
  checks.push(!BLOCKING_FAILURE_PATTERNS.some((pattern) => pattern.test(text)));
  if ((expected.expectedLocations ?? []).length > 0) {
    checks.push((expected.expectedLocations ?? []).some((location) => includesInsensitive(text, location)));
  }
  return checks.length === 0 ? 0 : checks.filter(Boolean).length / checks.length;
}

function decisionBlocked(run) {
  if (run?.blocked || run?.failed || run?.needsUserInput || run?.maxAttemptFailure) return true;
  return (run?.reviewDecisions ?? []).some((review) => (
    review.decision === 'block'
    || (review.decision === 'escalate' && review.severity === 'high')
  ));
}

function credentialExposureMatched(run) {
  return (run?.reviewDecisions ?? []).some((review) => (
    String(review.rules ?? '').toLowerCase().includes('credential-exposure')
  ));
}

defineCodeGrader((input) => {
  const expected = parseExpected(input);
  const messages = outputMessages(input);
  const answer = answerText(messages);
  const toolCalls = collectToolCalls(messages);
  const metadata = extractEmbeddedMetadata(answer, toolCalls) ?? {};
  const codi = metadata.codi ?? {};
  const ghcp = metadata.ghcp ?? {};
  const codiText = codi.text ?? answer;
  const ghcpText = ghcp.text ?? '';
  const codiScore = runScore(codiText, expected);
  const ghcpScore = ghcpText ? runScore(ghcpText, expected) : 0;
  const codiToolNames = codi.toolNames ?? toolCalls.map((call) => call.tool).filter(Boolean);
  const assertions = [];
  const add = (text, passed, evidence) => {
    assertions.push({ text, passed, ...(evidence ? { evidence: String(evidence).slice(0, 1_000) } : {}) });
  };

  for (const entity of expected.expectedEntities ?? []) {
    add(`Codi answer contains ${entity}`, includesInsensitive(codiText, entity), codiText);
    add(`Codi answer links ${entity}`, linkedEntity(codiText, entity), codiText);
  }

  const labels = renderedEntityLabels(codiText);
  for (const label of expected.badLabels ?? []) {
    add(`Codi does not publish bad label ${label}`, !labels.some((candidate) => candidate.toLowerCase() === String(label).toLowerCase()), labels.join(', '));
  }
  for (const label of expected.forbiddenLabels ?? []) {
    add(`Codi does not render forbidden page chrome ${label}`, !labels.some((candidate) => candidate.toLowerCase() === String(label).toLowerCase()), labels.join(', '));
  }

  add(
    'Codi answer does not contain adversary approval failure text',
    !BLOCKING_FAILURE_PATTERNS.some((pattern) => pattern.test(codiText)),
    codiText,
  );
  add('Codi adversary review does not block or high-escalate', !decisionBlocked(codi), JSON.stringify(codi.reviewDecisions ?? []));
  add('Codi adversary review does not match credential-exposure', !credentialExposureMatched(codi), JSON.stringify(codi.reviewDecisions ?? []));
  add('Codi emits no max-attempt adversary-review failure', !codi.maxAttemptFailure, codiText);

  for (const tool of expected.requiredTools ?? []) {
    add(`Codi trajectory includes ${tool}`, codiToolNames.includes(tool), codiToolNames.join(' -> '));
  }

  add('Codi score is greater than or equal to GHCP', codiScore >= ghcpScore, `codi=${codiScore}; ghcp=${ghcpScore}`);
  add('Codi blocking behavior is no worse than GHCP', Number(decisionBlocked(codi)) <= Number(decisionBlocked(ghcp)), JSON.stringify({
    codiBlocked: decisionBlocked(codi),
    ghcpBlocked: decisionBlocked(ghcp),
  }));
  add(
    'Codi tool-call efficiency is equal or better when quality is tied',
    codiScore > ghcpScore || Number(codi.toolCallCount ?? 0) <= Number(ghcp.toolCallCount ?? Number.POSITIVE_INFINITY),
    `codi=${codi.toolCallCount}; ghcp=${ghcp.toolCallCount}`,
  );

  const passed = assertions.filter((assertion) => assertion.passed).length;
  return {
    score: assertions.length === 0 ? 0 : passed / assertions.length,
    assertions,
    details: {
      codiScore,
      ghcpScore,
      codiToolCallCount: codi.toolCallCount,
      ghcpToolCallCount: ghcp.toolCallCount,
      searchQueries: codi.searchQueries ?? [],
    },
  };
});
