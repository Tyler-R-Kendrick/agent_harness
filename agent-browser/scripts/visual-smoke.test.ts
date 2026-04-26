import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('visual-smoke script', () => {
  it('does not wait for network idle before visible shell assertions', async () => {
    const script = await readFile(path.resolve(__dirname, 'visual-smoke.mjs'), 'utf8');

    expect(script).toContain("waitUntil: 'domcontentloaded'");
    expect(script).not.toContain("waitUntil: 'networkidle'");
  });
});
