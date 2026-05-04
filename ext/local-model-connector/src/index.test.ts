import { describe, expect, it } from 'vitest';

import { createLocalModelConnectorPlugin } from './index';

describe('local model connector harness plugin descriptor', () => {
  it('registers as a no-op asset extension for the built-in marketplace', async () => {
    const plugin = createLocalModelConnectorPlugin();
    await expect(plugin.register({} as never)).resolves.toBeUndefined();
    expect(plugin.id).toBe('local-model-connector');
  });
});
