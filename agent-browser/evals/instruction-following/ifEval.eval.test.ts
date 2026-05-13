import { describe, expect, it } from 'vitest';
import { compileValidationContract, evaluateAnswerAgainstValidationContract } from '../../src/services/constraintCompiler';
import type { ValidationContract } from '../../src/types';

function ifEvalContract(): ValidationContract {
  return {
    type: 'validation-contract',
    version: 1,
    taskGoal: 'Return only JSON on exactly one line and include the key status.',
    constraints: [
      {
        id: 'format:json-object',
        sourceText: 'Return only JSON.',
        type: 'format',
        operator: 'json_object',
        target: 'finalAnswer',
        value: true,
        required: true,
        confidence: 0.95,
        validationMethod: 'answer-text',
        failureMessage: 'Final answer must be a bare JSON object.',
      },
      {
        id: 'format:line-count',
        sourceText: 'Return exactly one line.',
        type: 'format',
        operator: 'exact_line_count',
        target: 'finalAnswer.lines',
        value: 1,
        required: true,
        confidence: 0.95,
        validationMethod: 'answer-text',
        failureMessage: 'Final answer must contain exactly one non-empty line.',
      },
      {
        id: 'format:required-json-key',
        sourceText: 'Include the key status.',
        type: 'format',
        operator: 'json_object_key',
        target: 'finalAnswer',
        value: 'status',
        required: true,
        confidence: 0.95,
        validationMethod: 'answer-text',
        failureMessage: 'Final answer must include the required status key.',
      },
    ],
    evidenceRequirements: [],
    impossibilityPolicy: { kind: 'none', askUserForHelp: false },
    clarificationTriggers: [],
    successSemantics: 'all-required',
    legacyCriteria: [],
  };
}

describe('IFEval-style AgentEvals', () => {
  it('fails outputs that answer semantically but violate explicit format instructions', () => {
    const result = evaluateAnswerAgainstValidationContract({
      contract: ifEvalContract(),
      answer: [
        'Sure, here is the result:',
        '{"state":"approved"}',
      ].join('\n'),
      acceptedCandidates: [],
    });

    expect(result.passed).toBe(false);
    expect(result.failures.map((failure) => failure.constraintId)).toEqual(expect.arrayContaining([
      'format:json-object',
      'format:line-count',
      'format:required-json-key',
    ]));
  });

  it('fails JSON objects that only contain the required key as a substring', () => {
    const result = evaluateAnswerAgainstValidationContract({
      contract: ifEvalContract(),
      answer: '{"notstatus":"approved"}',
      acceptedCandidates: [],
    });

    expect(result.passed).toBe(false);
    expect(result.failures.map((failure) => failure.constraintId)).toContain('format:required-json-key');
  });

  it('passes only when every explicit format instruction is satisfied', () => {
    const result = evaluateAnswerAgainstValidationContract({
      contract: ifEvalContract(),
      answer: '{"status":"approved"}',
      acceptedCandidates: [],
    });

    expect(result).toMatchObject({ passed: true, partial: false, failures: [] });
  });

  it('compiles IFEval-style natural language instructions into answer-text constraints', () => {
    const contract = compileValidationContract({
      taskText: 'Return only JSON on exactly one line, include the key status, and include the word APPROVED.',
    });

    expect(contract.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'format:json-object', type: 'format', operator: 'json_object' }),
      expect.objectContaining({ id: 'format:line-count', type: 'format', operator: 'exact_line_count', value: 1 }),
      expect.objectContaining({ id: 'format:required-json-key', type: 'format', operator: 'json_object_key', value: 'status' }),
      expect.objectContaining({ id: 'format:required-keyword', type: 'format', operator: 'must_include', value: 'APPROVED' }),
    ]));
  });
});
