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

function judgePrompt(prompt) {
  const answer = extractCandidateAnswer(prompt);
  const markdownLinks = [...answer.matchAll(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g)];
  const rejectsBadResponse = /verification failed|rejected labels|response-ready blocked|insufficient evidence|could not find enough validated|did not contain source-backed entity names/i.test(answer);
  const hasActualLinkedEntities = markdownLinks.length >= 1 && !hasBadEntityLabel(answer);
  const semanticOnly = /"semanticOnly"\s*:\s*true/i.test(prompt);
  const expectsBlockedOrInsufficient = /"expectedResult"\s*:\s*"(?:verification_fail|insufficient-evidence-no-publish|blocked-no-publish)"/i.test(prompt);
  const passed = semanticOnly
    ? (hasActualLinkedEntities || rejectsBadResponse) && !hasBadEntityLabel(answer)
    : (expectsBlockedOrInsufficient ? rejectsBadResponse && !hasBadEntityLabel(answer) : hasActualLinkedEntities);
  const hits = [];
  const misses = [];

  if (hasActualLinkedEntities) hits.push('Final answer contains linked entity names.');
  else misses.push('Final answer does not contain enough linked entity names.');

  if (!hasBadEntityLabel(answer)) hits.push('Final answer does not render known page chrome labels as entities.');
  else misses.push('Final answer renders page chrome labels as entities.');

  if (!expectsBlockedOrInsufficient || rejectsBadResponse) hits.push('Verifier behavior matches the case expectation.');
  else misses.push('Reported bad answer was not rejected.');

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
