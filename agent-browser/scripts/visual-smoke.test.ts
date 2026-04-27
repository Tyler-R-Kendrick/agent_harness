import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('visual-smoke script', () => {
  it('uses commit navigation with extended visible shell assertions', async () => {
    const script = await readFile(path.resolve(__dirname, 'visual-smoke.mjs'), 'utf8');

    expect(script).toContain("waitUntil: 'commit'");
    expect(script).not.toContain("waitUntil: 'networkidle'");
    expect(script).toContain("toBeVisible({ timeout: 30_000 })");
  });
});
