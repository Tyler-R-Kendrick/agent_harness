import { existsSync, readFileSync } from 'node:fs';

const path = '.research/claim-ledger.jsonl';
if (!existsSync(path)) {
  console.error('Missing claim ledger: .research/claim-ledger.jsonl');
  process.exit(1);
}

const lines = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean);
if (lines.length === 0) {
  console.error('Claim ledger is empty; run evidence mapping before final answer.');
  process.exit(1);
}

const invalid = lines.filter((line) => {
  try {
    const claim = JSON.parse(line);
    return !claim.claim_id || !claim.claim || !Array.isArray(claim.evidence_ids) || claim.evidence_ids.length === 0;
  } catch {
    return true;
  }
});

if (invalid.length > 0) {
  console.error(`Claim ledger has ${invalid.length} invalid entries.`);
  process.exit(1);
}

console.log('Claim coverage check passed.');
