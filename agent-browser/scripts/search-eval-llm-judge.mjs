import { readFile, writeFile } from 'node:fs/promises';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const badEntityLabelPattern = /^(?:Moviefone TV|Sign In\/Join|FanClub|Fandango Ticketing Theaters My|Featured Movie Animal Farm|Movie Showimes|IL 60004 Update Zipcode Monday|At Home|Movie Charts|Movie News|Movies|Theaters|TV Shows|FanStore|Streaming|Coming Soon|Skip to Main Content|Showtimes|Tickets|Reviews|Menu|Directions)$/i;

function extractSection(prompt, title) {
  const agentvMarker = new RegExp(`\\[\\[ ## ${title} ## \\]\\]\\s*([\\s\\S]*?)(?=\\n\\[\\[ ## [^\\]]+ ## \\]\\]|$)`, 'i');
  const agentvMatch = prompt.match(agentvMarker);
  if (agentvMatch?.[1]?.trim()) {
    return agentvMatch[1].trim();
  }

  const markdownMarker = new RegExp(`## ${title.replace(/_/g, ' ')}`, 'i');
  const markdownMatch = markdownMarker.exec(prompt);
  if (!markdownMatch) {
    return undefined;
  }
  return prompt.slice(markdownMatch.index + markdownMatch[0].length).trim();
}

function extractCandidateAnswer(prompt) {
  return extractSection(prompt, 'answer')
    ?? extractSection(prompt, 'output')
    ?? extractSection(prompt, 'candidate_answer')
    ?? extractSection(prompt, 'Candidate Answer')
    ?? prompt;
}

function extractExpectedContract(prompt) {
  const raw = extractSection(prompt, 'expected_output')
    ?? extractSection(prompt, 'Expected Contract');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function renderedEntityLabels(answer) {
  const markdownLabels = [...answer.matchAll(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g)]
    .map((match) => match[1].trim());
  const listLabels = [...answer.matchAll(/^\s*\d+[.)]\s+([^-\n]+?)(?:\s+-|\n|$)/gm)]
    .map((match) => match[1].replace(/\[|\]|\([^)]*\)/g, '').trim())
    .filter(Boolean);
  return [...new Set([...markdownLabels, ...listLabels])];
}

function hasBadEntityLabel(answer) {
  return renderedEntityLabels(answer).some((label) => badEntityLabelPattern.test(label));
}

function normalizeComparable(value) {
  return String(value ?? '').replace(/^the\s+/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function rhymesWith(value, target) {
  const word = String(value ?? '').toLowerCase().match(/[a-z0-9]+(?=[^a-z0-9]*$)/i)?.[0] ?? '';
  const normalizedTarget = String(target ?? '').toLowerCase();
  if (!word || !normalizedTarget) return false;
  const tail = normalizedTarget.length <= 3 ? normalizedTarget.slice(-2) : normalizedTarget.slice(-3);
  return word.endsWith(tail);
}

function answerAcknowledgesConstraintShortfall(answer, validationContract = {}) {
  if (!/\b(?:could not|could only|unable to|insufficient|not enough|cannot verify|couldn't verify|unmet|shortfall)\b/i.test(answer)) {
    return false;
  }
  return (validationContract.constraints ?? [])
    .some((constraint) => {
      if (constraint.value === undefined) return answer.toLowerCase().includes(String(constraint.type ?? '').replace('_', ' '));
      if (Array.isArray(constraint.value)) {
        return constraint.value.some((entry) => answer.toLowerCase().includes(String(entry).toLowerCase()));
      }
      return answer.toLowerCase().includes(String(constraint.value).toLowerCase());
    });
}

function contractFailures(answer, expectedContract) {
  const validationContract = expectedContract.validationContract;
  if (!validationContract || !Array.isArray(validationContract.constraints)) return [];
  const labels = renderedEntityLabels(answer);
  const acknowledged = validationContract.successSemantics === 'allow-partial-with-acknowledgement'
    && answerAcknowledgesConstraintShortfall(answer, validationContract);
  if (acknowledged) return [];
  const failures = [];
  for (const constraint of validationContract.constraints.filter((item) => item.required !== false)) {
    const value = constraint.value;
    if (constraint.type === 'count' && labels.length < Number(value ?? 0)) {
      failures.push(`${constraint.id}: expected ${value} labels, got ${labels.length}`);
    }
    if (constraint.type === 'name_prefix' && !labels.every((label) => label.toLowerCase().startsWith(String(value ?? '').toLowerCase()))) {
      failures.push(`${constraint.id}: labels do not all start with ${value}`);
    }
    if (constraint.type === 'name_suffix' && !labels.every((label) => label.toLowerCase().endsWith(String(value ?? '').toLowerCase()))) {
      failures.push(`${constraint.id}: labels do not all end with ${value}`);
    }
    if (constraint.type === 'rhyme' && !labels.every((label) => rhymesWith(label, value))) {
      failures.push(`${constraint.id}: labels do not rhyme with ${value}`);
    }
    if (constraint.type === 'exclusion') {
      const excluded = Array.isArray(value) ? value.map(String) : [];
      if (labels.some((label) => excluded.some((excludedLabel) => normalizeComparable(label) === normalizeComparable(excludedLabel)))) {
        failures.push(`${constraint.id}: excluded label was rendered`);
      }
    }
    if (constraint.type === 'location' && value && !answer.toLowerCase().includes(String(value).toLowerCase())) {
      failures.push(`${constraint.id}: answer does not mention ${value}`);
    }
  }
  return failures;
}

function judgePrompt(prompt) {
  const answer = extractCandidateAnswer(prompt);
  const expectedContract = extractExpectedContract(prompt);
  const markdownLinks = [...answer.matchAll(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g)];
  const rejectsBadResponse = /verification failed|rejected labels|response-ready blocked|insufficient evidence|could not verify|could not find enough validated|could only verify|asked for \d+|did not contain(?: enough)?(?: additional)? source-backed entity names|unavailable|no search results found|search issue|please provide a search source/i.test(answer);
  const hasActualLinkedEntities = markdownLinks.length >= 1 && !hasBadEntityLabel(answer);
  const semanticOnly = /"semanticOnly"\s*:\s*true/i.test(prompt);
  const expectsBlockedOrInsufficient = /"expectedResult"\s*:\s*"(?:verification_fail|insufficient-evidence-no-publish|insufficient-follow-up-count|blocked-no-publish)"/i.test(prompt);
  const validationFailures = contractFailures(answer, expectedContract);
  const passed = semanticOnly
    ? (hasActualLinkedEntities || rejectsBadResponse) && !hasBadEntityLabel(answer) && validationFailures.length === 0
    : (expectsBlockedOrInsufficient
      ? rejectsBadResponse && !hasBadEntityLabel(answer) && validationFailures.length === 0
      : hasActualLinkedEntities && validationFailures.length === 0);
  const hits = [];
  const misses = [];

  if (hasActualLinkedEntities) hits.push('Final answer contains linked entity names.');
  else misses.push('Final answer does not contain enough linked entity names.');

  if (!hasBadEntityLabel(answer)) hits.push('Final answer does not render known page chrome labels as entities.');
  else misses.push('Final answer renders page chrome labels as entities.');

  if (!expectsBlockedOrInsufficient || rejectsBadResponse) hits.push('Verifier behavior matches the case expectation.');
  else misses.push('Reported bad answer was not rejected.');

  if (validationFailures.length === 0) hits.push('Final answer satisfies the emitted validation contract.');
  else misses.push(`Validation contract failures: ${validationFailures.join('; ')}`);

  const freeform = {
    score: passed ? 1 : 0,
    assertions: [
      {
        text: 'Final answer contains source-backed requested entities or blocks the known bad answer.',
        passed,
        evidence: passed ? hits.join(' ') : misses.join(' '),
      },
      {
        text: 'Final answer does not publish page chrome as requested entities.',
        passed: !hasBadEntityLabel(answer) || rejectsBadResponse,
        evidence: answer.slice(0, 500),
      },
    ],
    hits,
    misses,
    reasoning: passed
      ? 'The response satisfies the entity-search quality gate for this AgentEvals case.'
      : 'The response fails the entity-search quality gate.',
  };

  const rubricIds = [...prompt.matchAll(/^- \[([^\]]+)\]/gm)].map((match) => match[1]);
  if (rubricIds.length > 0) {
    return {
      checks: rubricIds.map((id) => ({
        id,
        satisfied: passed,
        reasoning: passed
          ? `The candidate satisfies ${id} for this deterministic AgentEvals case.`
          : `The candidate fails ${id}; it either rendered page chrome or missed requested entities.`,
      })),
      overall_reasoning: passed
        ? 'All rubric requirements are satisfied for this deterministic AgentEvals case.'
        : 'One or more rubric requirements fail because the candidate does not present verified requested entities.',
    };
  }

  return freeform;
}

const promptFile = argValue('--prompt-file');
const outputFile = argValue('--out') ?? argValue('--output');
if (!promptFile || !outputFile) {
  throw new Error('search-eval-llm-judge requires --prompt-file and --out.');
}

const prompt = await readFile(promptFile, 'utf8');
await writeFile(outputFile, JSON.stringify({ text: JSON.stringify(judgePrompt(prompt)) }, null, 2));
