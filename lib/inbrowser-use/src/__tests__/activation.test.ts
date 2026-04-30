import { describe, expect, it, vi } from 'vitest';

import { DefaultActivationBroker } from '../activation.js';
import { ActivationRequiredError } from '../errors.js';

function setUserActivation(isActive: boolean): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      userActivation: { isActive },
    },
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis, 'navigator', descriptor);
      return;
    }

    Reflect.deleteProperty(globalThis, 'navigator');
  };
}

describe('DefaultActivationBroker', () => {
  it('reports the browser user activation state when available', () => {
    const restoreNavigator = setUserActivation(true);

    try {
      expect(new DefaultActivationBroker().isActive()).toBe(true);
    } finally {
      restoreNavigator();
    }
  });

  it('falls back to inactive when user activation is unavailable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Reflect.deleteProperty(globalThis, 'navigator');

    try {
      expect(new DefaultActivationBroker().isActive()).toBe(false);
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'navigator', descriptor);
      }
    }
  });

  it('throws when activation is required but inactive', () => {
    const broker = new DefaultActivationBroker();
    vi.spyOn(broker, 'isActive').mockReturnValue(false);

    expect(() => broker.requireActivation()).toThrow(ActivationRequiredError);
  });

  it('does not throw when activation is required and active', () => {
    const broker = new DefaultActivationBroker();
    vi.spyOn(broker, 'isActive').mockReturnValue(true);

    expect(() => broker.requireActivation()).not.toThrow();
  });
});
