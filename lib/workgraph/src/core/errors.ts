export class WorkGraphCommandError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'WorkGraphCommandError';
  }
}
