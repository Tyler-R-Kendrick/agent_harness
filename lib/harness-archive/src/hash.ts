/**
 * Deterministic content-addressing helpers.
 *
 * Reused verbatim from the ADAS research scaffold
 * (`research/adas-2408.08435/experiments/experiment-01-harness-archive-search.ts`)
 * so archive ids match the offline experiments.
 */

/**
 * Normalize a harness definition for content-addressing: trim the ends and
 * collapse every internal whitespace run to a single space. Two definitions
 * that differ only in whitespace canonicalize to the same string (and thus the
 * same id).
 */
export function canonicalizeDefinition(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Deterministic djb2-style string hash, rendered as a base-36 id with a `g`
 * ("genome") prefix. Stable across runs and processes.
 */
export function hashString(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = (Math.imul(hash, 33) ^ text.charCodeAt(i)) >>> 0;
  }
  return `g${hash.toString(36)}`;
}
