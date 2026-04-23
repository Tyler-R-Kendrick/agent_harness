/**
 * Deterministic palette mapping for ProcessGraph branch rails.
 *
 * Branches are addressed by free-form `branchId` strings (e.g. "coordinator",
 * "breakdown-agent", "bus"). We hash the id into a fixed-size palette so
 * colors stay stable across renders without requiring a central registry.
 */

const PALETTE = [
  '#a78bfa', // purple — root / coordinator
  '#34d399', // green — bus
  '#f472b6', // pink — secondary subagent
  '#fbbf24', // amber — tertiary subagent
  '#60a5fa', // blue
  '#f87171', // red
] as const;

const FIXED: Record<string, string> = {
  coordinator: PALETTE[0],
  root: PALETTE[0],
  main: PALETTE[0],
  bus: PALETTE[1],
};

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function branchColor(branchId?: string): string {
  if (!branchId) return PALETTE[0];
  const fixed = FIXED[branchId];
  if (fixed) return fixed;
  return PALETTE[hashString(branchId) % PALETTE.length];
}
