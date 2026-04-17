/** Base class for all in-app automation errors. */
export class InAppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'InAppError';
  }
}

export class StrictModeViolationError extends InAppError {
  constructor(description: string, count: number) {
    super(
      'STRICT_MODE_VIOLATION',
      `strict mode violation: ${description} resolved to ${count} elements`,
    );
    this.name = 'StrictModeViolationError';
  }
}

export class TimeoutError extends InAppError {
  constructor(description: string, timeoutMs: number) {
    super(
      'TIMEOUT',
      `Timeout ${timeoutMs}ms exceeded while waiting for ${description}`,
    );
    this.name = 'TimeoutError';
  }
}

export class NotFoundError extends InAppError {
  constructor(description: string) {
    super('NOT_FOUND', `Element not found: ${description}`);
    this.name = 'NotFoundError';
  }
}

export class NotVisibleError extends InAppError {
  constructor(description: string) {
    super('NOT_VISIBLE', `Element is not visible: ${description}`);
    this.name = 'NotVisibleError';
  }
}

export class NotEnabledError extends InAppError {
  constructor(description: string) {
    super('NOT_ENABLED', `Element is not enabled: ${description}`);
    this.name = 'NotEnabledError';
  }
}

export class NotEditableError extends InAppError {
  constructor(description: string) {
    super('NOT_EDITABLE', `Element is not editable: ${description}`);
    this.name = 'NotEditableError';
  }
}

export class NotAttachedError extends InAppError {
  constructor(description: string) {
    super('NOT_ATTACHED', `Element is not attached to DOM: ${description}`);
    this.name = 'NotAttachedError';
  }
}

export class ObscuredError extends InAppError {
  constructor(description: string) {
    super('OBSCURED', `Element is obscured: ${description}`);
    this.name = 'ObscuredError';
  }
}

export class FrameNotFoundError extends InAppError {
  constructor(selector: string) {
    super('FRAME_NOT_FOUND', `Frame not found: ${selector}`);
    this.name = 'FrameNotFoundError';
  }
}

export class FrameNotCooperativeError extends InAppError {
  constructor(selector: string) {
    super(
      'FRAME_NOT_COOPERATIVE',
      `Cross-origin frame is not automation-enabled: ${selector}`,
    );
    this.name = 'FrameNotCooperativeError';
  }
}

export class RemoteRPCTimeoutError extends InAppError {
  constructor(frameSelector: string) {
    super('REMOTE_RPC_TIMEOUT', `RPC timeout waiting for frame: ${frameSelector}`);
    this.name = 'RemoteRPCTimeoutError';
  }
}

export class RemoteRPCError extends InAppError {
  constructor(code: string, message: string, details?: unknown) {
    super('REMOTE_RPC_ERROR', `Remote frame error [${code}]: ${message}`, details);
    this.name = 'RemoteRPCError';
  }
}

export class ActivationRequiredError extends InAppError {
  constructor() {
    super('ACTIVATION_REQUIRED', 'User activation is required for this action');
    this.name = 'ActivationRequiredError';
  }
}

export class UnsupportedError extends InAppError {
  constructor(message: string) {
    super('UNSUPPORTED', `Unsupported operation: ${message}`);
    this.name = 'UnsupportedError';
  }
}
