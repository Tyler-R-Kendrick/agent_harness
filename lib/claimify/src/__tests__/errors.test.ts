import { describe, expect, it } from 'vitest';
import {
  ClaimifyError,
  ClaimifyJsonError,
  serializeClaimifyError,
  toClaimifyError,
} from '../errors';

describe('error helpers', () => {
  it('preserves claimify errors and normalizes other thrown values', () => {
    const claimifyError = new ClaimifyJsonError('bad json');

    expect(toClaimifyError(claimifyError)).toBe(claimifyError);
    expect(toClaimifyError(new Error('boom'))).toMatchObject({
      name: 'ClaimifyError',
      message: 'boom',
    });
    expect(toClaimifyError('plain failure')).toMatchObject({
      name: 'ClaimifyError',
      message: 'plain failure',
    });
  });

  it('serializes normalized errors for worker messages', () => {
    expect(serializeClaimifyError(new ClaimifyError('nope'))).toEqual({
      name: 'ClaimifyError',
      message: 'nope',
    });
  });
});
