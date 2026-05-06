export class SandboxClosedError extends Error {
  constructor(message = 'Sandbox is closed.') {
    super(message);
    this.name = 'SandboxClosedError';
  }
}

export class SandboxTimeoutError extends Error {
  constructor(message = 'Sandbox execution timed out.') {
    super(message);
    this.name = 'SandboxTimeoutError';
  }
}

export class SandboxPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxPathError';
  }
}

export class SandboxQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxQuotaError';
  }
}

export class SandboxExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxExecutionError';
  }
}
