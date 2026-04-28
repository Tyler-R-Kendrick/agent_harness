import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const results = Object.entries(input.results ?? {});
const assertions = results.map(([name, result]) => ({
  text: `${name} must pass`,
  passed: (result?.score ?? 0) >= 0.8 && result?.verdict !== 'fail',
  evidence: result?.reasoning ?? JSON.stringify(result),
}));
const passed = assertions.filter((assertion) => assertion.passed).length;

console.log(JSON.stringify({
  score: assertions.length === 0 ? 0 : passed / assertions.length,
  verdict: passed === assertions.length ? 'pass' : 'fail',
  assertions,
  reasoning: `Hard gate passed ${passed}/${assertions.length} child evaluators.`,
}));
