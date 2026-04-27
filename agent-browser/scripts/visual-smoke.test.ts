import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('visual-smoke script', () => {
  it('uses commit navigation with extended visible shell assertions', async () => {
    const script = await readFile(path.resolve(__dirname, 'visual-smoke.mjs'), 'utf8');

    expect(script).toContain("waitUntil: 'domcontentloaded'");
    expect(script).toContain('navigationTimeoutMs = 120_000');
    expect(script).toContain('shellTimeoutMs = 30_000');
    expect(script).not.toContain("waitUntil: 'networkidle'");
    expect(script).toContain('toBeVisible({ timeout: shellTimeoutMs })');
  });
});
