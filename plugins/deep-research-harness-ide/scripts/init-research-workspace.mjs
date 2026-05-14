import { mkdirSync, existsSync, writeFileSync } from 'node:fs';

const dirs = ['.research', '.research/wiki', '.research/reports'];
for (const dir of dirs) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

if (!existsSync('.research/claim-ledger.jsonl')) writeFileSync('.research/claim-ledger.jsonl', '');

console.log('Deep Research workspace initialized.');
