/** Waits for UI to stabilise before performing an action. */
export class StabilityManager {
  /** Wait for stable UI by flushing microtasks, waiting animation frames,
   * and optionally waiting for a quiet DOM period. */
  async waitForStableUI(options?: {
    frames?: number;
    quietDomMs?: number;
    timeout?: number;
  }): Promise<void> {
    const frames = options?.frames ?? 2;
    const quietDomMs = options?.quietDomMs ?? 0;
    const timeout = options?.timeout ?? 5000;
    const deadline = Date.now() + timeout;

    // 1. Flush microtasks
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    // 2. Wait N animation frames (fallback to setTimeout in non-browser envs)
    for (let i = 0; i < frames; i++) {
      await new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => resolve());
        } else {
          // jsdom / node fallback
          setTimeout(resolve, 1);
        }
      });
    }

    // 3. Optional DOM quiet period
    if (quietDomMs > 0 && typeof MutationObserver !== 'undefined') {
      await this._waitForQuietDom(quietDomMs, deadline);
    }
  }

  private _waitForQuietDom(quietDomMs: number, deadline: number): Promise<void> {
    return new Promise<void>((resolve) => {
      let quietTimer: ReturnType<typeof setTimeout> | null = null;
      let observer: MutationObserver | null = null;

      const cleanup = () => {
        if (quietTimer !== null) clearTimeout(quietTimer);
        if (observer !== null) observer.disconnect();
      };

      const resetTimer = () => {
        if (quietTimer !== null) clearTimeout(quietTimer);
        if (Date.now() >= deadline) {
          cleanup();
          resolve();
          return;
        }
        quietTimer = setTimeout(() => {
          cleanup();
          resolve();
        }, quietDomMs);
      };

      observer = new MutationObserver(() => resetTimer());
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });

      resetTimer();
    });
  }
}
