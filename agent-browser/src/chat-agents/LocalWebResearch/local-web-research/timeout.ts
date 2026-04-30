export async function withTimeout<T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  outerSignal?: AbortSignal,
): Promise<T> {
  if (outerSignal?.aborted) {
    throw abortError(outerSignal.reason);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException(`Operation timed out after ${timeoutMs}ms.`, 'TimeoutError'));
  }, timeoutMs);
  const onAbort = () => controller.abort(outerSignal?.reason);
  outerSignal?.addEventListener('abort', onAbort, { once: true });

  try {
    return await promiseFactory(controller.signal);
  } finally {
    clearTimeout(timeoutId);
    outerSignal?.removeEventListener('abort', onAbort);
  }
}

function abortError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  return new DOMException('Operation was aborted.', 'AbortError');
}
