import { describe, expect, it } from 'vitest';
import { compileValidationContract, evaluateAnswerAgainstValidationContract } from './constraintCompiler';
import type { SearchTurnContext } from '../types';

const priorBarsContext: SearchTurnContext = {
  taskText: 'closest bars near Arlington Heights IL',
  resolvedTaskText: 'closest bars near Arlington Heights IL',
  subject: 'bars',
  answerSubject: 'bars',
  rankingGoal: 'closest',
  location: 'Arlington Heights IL',
  acceptedCandidates: [{ name: 'Sports Page Bar & Grill Arlington Heights', url: 'https://sportspagebar.com/' }],
  rejectedLabels: [],
  sourceQueries: ['closest bars Arlington Heights IL'],
  requestedCount: 1,
  timestamp: 1,
};

describe('compileValidationContract', () => {
  it('compiles follow-up count, inherited subject, location, exclusions, and partial-success semantics', () => {
    const contract = compileValidationContract({
      taskText: 'show me 3 more',
      resolvedTaskText: 'closest bars near Arlington Heights IL',
      context: priorBarsContext,
      requestedCount: 3,
      excludedCandidateNames: ['Sports Page Bar & Grill Arlington Heights'],
    });

    expect(contract.taskGoal).toBe('closest bars near Arlington Heights IL');
    expect(contract.successSemantics).toBe('allow-partial-with-acknowledgement');
    expect(contract.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'count:min-results', type: 'count', operator: 'at_least', value: 3 }),
      expect.objectContaining({ id: 'subject:entity-type', type: 'subject', operator: 'matches', value: 'bars' }),
      expect.objectContaining({ id: 'location:nearby', type: 'location', operator: 'near', value: 'Arlington Heights IL' }),
      expect.objectContaining({ id: 'exclude:prior-candidates', type: 'exclusion', operator: 'excludes' }),
    ]));
  });

  it('compiles arbitrary prefix constraints from natural language', () => {
    const contract = compileValidationContract({
      taskText: 'provide shops in the Vatican that start with the letter "A"',
    });

    expect(contract.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'subject', operator: 'matches', value: 'shops' }),
      expect.objectContaining({ type: 'location', operator: 'in', value: 'the Vatican' }),
      expect.objectContaining({ type: 'name_prefix', operator: 'starts_with', value: 'A' }),
    ]));
  });

  it('keeps likely-impossible arbitrary constraints instead of dropping them', () => {
    const contract = compileValidationContract({
      taskText: 'show 10 websites that rhyme with "cat" located in middle earth',
    });

    expect(contract.impossibilityPolicy.kind).toBe('likely-impossible');
    expect(contract.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'count', operator: 'at_least', value: 10 }),
      expect.objectContaining({ type: 'subject', operator: 'matches', value: 'websites' }),
      expect.objectContaining({ type: 'rhyme', operator: 'rhymes_with', value: 'cat' }),
      expect.objectContaining({ type: 'location', operator: 'in', value: 'middle earth' }),
    ]));
  });

  it('records contradictory constraints as an impossibility warning', () => {
    const contract = compileValidationContract({
      taskText: 'find shops in the Vatican outside the Vatican',
    });

    expect(contract.impossibilityPolicy.kind).toBe('contradictory');
    expect(contract.constraints.filter((constraint) => constraint.type === 'location')).toHaveLength(2);
  });
});

describe('evaluateAnswerAgainstValidationContract', () => {
  it('fails unmet required arbitrary constraints unless the answer acknowledges the shortfall', () => {
    const contract = compileValidationContract({
      taskText: 'provide shops in the Vatican that start with the letter "A"',
    });
    const result = evaluateAnswerAgainstValidationContract({
      contract,
      answer: 'Here are shops in the Vatican:\n\n1. [Vatican Gift Shop](https://example.com) - Why: listed in Vatican City.',
      acceptedCandidates: [{
        name: 'Vatican Gift Shop',
        entityLink: 'https://example.com',
        locationEvidence: ['Vatican City'],
        sourceEvidence: ['shop listing'],
        subjectMatch: true,
      }],
    });

    expect(result.passed).toBe(false);
    expect(result.failures.map((failure) => failure.constraintId)).toContain('name:prefix');
  });

  it('passes a partial impossible answer only when unmet constraints are named', () => {
    const contract = compileValidationContract({
      taskText: 'show 10 websites that rhyme with "cat" located in middle earth',
    });
    const result = evaluateAnswerAgainstValidationContract({
      contract,
      answer: 'I could not verify 10 websites located in middle earth that rhyme with cat. Please provide a source for Middle Earth websites if you want me to continue.',
      acceptedCandidates: [],
    });

    expect(result.passed).toBe(true);
    expect(result.partial).toBe(true);
  });
});
