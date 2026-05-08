#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const targetPath = path.join(
  path.dirname(scriptPath),
  'linear-list-canceled-active-issues.mjs',
);

const child = spawn(process.execPath, [targetPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`linear canceled issue helper exited by signal ${signal}.`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
