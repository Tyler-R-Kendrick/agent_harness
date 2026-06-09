import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const attributes = readFileSync(new URL('../.gitattributes', import.meta.url), 'utf8');

assert.match(attributes, /^\* text=auto$/m);

const requiredBinaryPatterns = [
  '*.png binary',
  '*.jpg binary',
  '*.jpeg binary',
  '*.gif binary',
  '*.webp binary',
  '*.ico binary',
  '*.pdf binary',
  '*.zip binary',
  '*.wasm binary',
  '*.exe binary',
  '*.dll binary',
  '*.node binary',
];

const attributeLines = new Set(attributes.split(/\r?\n/u));

for (const pattern of requiredBinaryPatterns) {
  assert.equal(attributeLines.has(pattern), true, `${pattern} should be declared`);
}

console.log('gitattributes hygiene checks passed');
