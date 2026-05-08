export class ClaimifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ClaimifyAbortError extends ClaimifyError {}

export class ClaimifyJsonError extends ClaimifyError {}

export class ClaimifyModelError extends ClaimifyError {}

export class ClaimifyValidationError extends ClaimifyError {}

export class ClaimifyWorkerError extends ClaimifyError {}

export function toClaimifyError(error: unknown): ClaimifyError {
  if (error instanceof ClaimifyError) {
    return error;
  }
  if (error instanceof Error) {
    return new ClaimifyError(error.message);
  }
  return new ClaimifyError(String(error));
}

export function serializeClaimifyError(error: unknown): { name: string; message: string } {
  const normalized = toClaimifyError(error);
  return {
    name: normalized.name,
    message: normalized.message,
  };
}
