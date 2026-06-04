import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(appRoot, '..');

function subprocessEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.NODE_V8_COVERAGE;
  return env;
}

describe('search-quality entity links', () => {
  it('fails validation-contract answers that link entity names to generic search result URLs', () => {
    const grader = path.join(repoRoot, 'agent-browser/evals/search-fulfillment/graders/search-quality-gate.mjs');
    const input = {
      expected_output: JSON.stringify({
        expectedLocations: ['Arlington Heights, IL'],
        validationContract: {
          type: 'validation-contract',
          version: 1,
          taskGoal: 'show me 2 bars near me',
          constraints: [
            {
              id: 'count:min-results',
              sourceText: 'show me 2 bars near me',
              type: 'count',
              operator: 'at_least',
              target: 'acceptedCandidates',
              value: 2,
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Expected at least 2 accepted result(s).',
            },
            {
              id: 'link:entity-specific',
              sourceText: 'show me 2 bars near me',
              type: 'entity_link',
              operator: 'has_safe_entity_link',
              target: 'acceptedCandidates.entityLink',
              value: true,
              required: true,
              confidence: 0.9,
              validationMethod: 'structured-candidate',
              failureMessage: 'Each rendered result needs a safe source-backed entity link.',
            },
          ],
          evidenceRequirements: [],
          impossibilityPolicy: { kind: 'none', askUserForHelp: false },
          clarificationTriggers: [],
          successSemantics: 'all-required',
          legacyCriteria: [],
        },
      }),
      output: [{
        role: 'assistant',
        content: [
          'Here are bars near Arlington Heights, IL:',
          '',
          "1. [Peggy Kinnane's Irish Restaurant & Pub](https://www.peggykinnanes.com/) - Why: Peggy Kinnane's is a bar in Arlington Heights, IL.",
          "2. [Cortland's Garage](https://www.yelp.com/search?find_desc=Cortland%27s+Garage&find_loc=Arlington+Heights%2C+IL) - Why: Cortland's Garage is a bar in Arlington Heights, IL.",
        ].join('\n'),
      }],
    };

    const result = spawnSync(process.execPath, [grader], {
      cwd: path.join(repoRoot, 'agent-browser/evals/search-fulfillment'),
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: subprocessEnv(),
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      score: number;
      assertions: Array<{ text: string; passed: boolean; evidence?: string }>;
    };
    expect(parsed.score).toBeLessThan(1);
    expect(parsed.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: 'validation contract link:entity-specific',
        passed: false,
      }),
    ]));
    const linkAssertion = parsed.assertions.find((assertion) => assertion.text === 'validation contract link:entity-specific');
    expect(linkAssertion?.evidence).toBe("Cortland's Garage");
  });
});
