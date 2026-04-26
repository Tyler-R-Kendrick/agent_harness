import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const steps = [
  ['validate-evals', [npmCommand, '--workspace', 'agent-browser', 'run', 'validate:evals']],
  ['test-evals', [npmCommand, '--workspace', 'agent-browser', 'run', 'test:evals']],
  ['lint', [npmCommand, '--workspace', 'agent-browser', 'run', 'lint']],
  ['coverage', [npmCommand, '--workspace', 'agent-browser', 'run', 'test:coverage']],
  ['build', [npmCommand, '--workspace', 'agent-browser', 'run', 'build']],
  ['audit', [npmCommand, 'audit', '--audit-level=moderate']],
  ['visual-smoke', [npmCommand, 'run', 'visual:agent-browser']],
];

const warningPatterns = [
  /npm warn/i,
  /\(!\)/,
  /\[plugin vite:reporter\]/i,
];

for (const [label, [command, ...args]] of steps) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const matchedWarning = warningPatterns.find((pattern) => pattern.test(output));
  if (matchedWarning) {
    console.error(`verify:agent-browser failed: ${label} emitted a warning matching ${matchedWarning}.`);
    process.exit(1);
  }
}
