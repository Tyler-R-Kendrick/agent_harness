import { describe, it, expect } from 'vitest';
import {
  InAppError,
  StrictModeViolationError,
  TimeoutError,
  NotFoundError,
  NotVisibleError,
  NotEnabledError,
  NotEditableError,
  NotAttachedError,
  ObscuredError,
  FrameNotFoundError,
  FrameNotCooperativeError,
  RemoteRPCTimeoutError,
  RemoteRPCError,
  ActivationRequiredError,
  UnsupportedError,
} from '../errors.js';

describe('errors', () => {
  it('InAppError carries code and message', () => {
    const err = new InAppError('FOO', 'bar', { extra: 1 });
    expect(err.code).toBe('FOO');
    expect(err.message).toBe('bar');
    expect(err.details).toEqual({ extra: 1 });
    expect(err).toBeInstanceOf(Error);
  });

  it('StrictModeViolationError has correct message and code', () => {
    const err = new StrictModeViolationError('getByRole(button)', 3);
    expect(err.code).toBe('STRICT_MODE_VIOLATION');
    expect(err.message).toContain('3 elements');
    expect(err.message).toContain('getByRole(button)');
  });

  it('TimeoutError has correct message', () => {
    const err = new TimeoutError('click', 5000);
    expect(err.code).toBe('TIMEOUT');
    expect(err.message).toContain('5000ms');
  });

  it('NotFoundError', () => {
    const err = new NotFoundError('button');
    expect(err.code).toBe('NOT_FOUND');
  });

  it('NotVisibleError', () => {
    const err = new NotVisibleError('button');
    expect(err.code).toBe('NOT_VISIBLE');
  });

  it('NotEnabledError', () => {
    const err = new NotEnabledError('button');
    expect(err.code).toBe('NOT_ENABLED');
  });

  it('NotEditableError', () => {
    const err = new NotEditableError('div');
    expect(err.code).toBe('NOT_EDITABLE');
  });

  it('NotAttachedError', () => {
    const err = new NotAttachedError('span');
    expect(err.code).toBe('NOT_ATTACHED');
  });

  it('ObscuredError', () => {
    const err = new ObscuredError('button');
    expect(err.code).toBe('OBSCURED');
    expect(err.message).toContain('button');
  });

  it('FrameNotFoundError', () => {
    const err = new FrameNotFoundError('#frame');
    expect(err.code).toBe('FRAME_NOT_FOUND');
    expect(err.message).toContain('#frame');
  });

  it('FrameNotCooperativeError', () => {
    const err = new FrameNotCooperativeError('#frame');
    expect(err.code).toBe('FRAME_NOT_COOPERATIVE');
  });

  it('RemoteRPCTimeoutError', () => {
    const err = new RemoteRPCTimeoutError('iap-123-1');
    expect(err.code).toBe('REMOTE_RPC_TIMEOUT');
  });

  it('RemoteRPCError', () => {
    const err = new RemoteRPCError('NOT_FOUND', 'element missing', { a: 1 });
    expect(err.code).toBe('REMOTE_RPC_ERROR');
    expect(err.message).toContain('NOT_FOUND');
    expect(err.details).toEqual({ a: 1 });
  });

  it('ActivationRequiredError', () => {
    const err = new ActivationRequiredError();
    expect(err.code).toBe('ACTIVATION_REQUIRED');
  });

  it('UnsupportedError', () => {
    const err = new UnsupportedError('foo');
    expect(err.code).toBe('UNSUPPORTED');
  });
});
