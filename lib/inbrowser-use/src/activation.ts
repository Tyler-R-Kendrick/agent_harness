import type { UserActivationBroker } from './types.js';
import { ActivationRequiredError } from './errors.js';

export class DefaultActivationBroker implements UserActivationBroker {
  isActive(): boolean {
    if (
      typeof navigator !== 'undefined' &&
      'userActivation' in navigator
    ) {
      return (
        navigator as unknown as { userActivation: { isActive: boolean } }
      ).userActivation.isActive;
    }
    // Conservative fallback: assume not active
    return false;
  }

  requireActivation(): void {
    if (!this.isActive()) {
      throw new ActivationRequiredError();
    }
  }
}
