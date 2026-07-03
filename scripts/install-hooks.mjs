#!/usr/bin/env node
/**
 * Fail-open git hook installer.
 *
 * Wires `core.hooksPath` to `.githooks` so the repo's pre-commit gate runs
 * locally for every contributor after `npm install`. It never blocks an
 * install: it no-ops on CI, when `SKIP_GIT_HOOKS` is set, or outside a git
 * checkout, and swallows any error.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const skip = process.env.CI || process.env.SKIP_GIT_HOOKS || !existsSync(".git");
if (!skip) {
  try {
    execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
  } catch {
    // Hook wiring is best-effort; never fail the install because of it.
    process.exitCode = 0;
  }
}
