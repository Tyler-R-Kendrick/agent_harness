# @agent-harness/agent-sandbox

Capability-based browser sandbox provider for generated agent skill files.

```ts
import { BrowserSandboxProvider } from '@agent-harness/agent-sandbox';

const sandbox = new BrowserSandboxProvider();

await sandbox.uploadFiles([
  ['/skills/hello/src/index.js', new TextEncoder().encode('console.log("hello from sandbox")')],
]);

const result = await sandbox.execute('node /skills/hello/src/index.js');
console.log(result.output);

await sandbox.close();
```

The QuickJS provider creates one dedicated module Worker per sandbox instance. Generated JavaScript is executed by QuickJS compiled to WebAssembly inside that worker, with a scoped in-memory virtual filesystem and a narrow command set: `ls`, `cat`, `write`, `rm`, `node`, and `run`.

For generated skills that need a real Node runtime, TypeScript builds, package scripts, or test runners, use `WebContainerBrowserSandboxProvider`. It implements the same `AgentSandbox`/`SkillSandbox` shape but boots WebContainer compute and still avoids a generic shell by tokenizing a command string and spawning only allowed executables such as `node`, `npm`, `npx`, `yarn`, `pnpm`, `tsc`, and `vitest`.

Network access stays off by default. When enabled for QuickJS, `fetch` is a real policy-enforced host bridge: it accepts only absolute HTTP(S) URL strings, requires HTTPS except explicitly allowed localhost development URLs, strips credential-bearing headers, forces `credentials: "omit"` and `redirect: "manual"`, applies method/origin allowlists, and enforces request, response, and timeout limits.

Recommended CSP when this package is used by a PWA:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  worker-src 'self' blob:;
  connect-src 'self';
  frame-src 'self' blob:;
  object-src 'none';
  base-uri 'none';
```

The implementation intentionally does not expose the host DOM, privileged storage, app state, auth tokens, or arbitrary shell execution to generated skill code.

## Package boundary

Use the package root as the stable public import path:

```ts
import { BrowserSandboxProvider } from '@agent-harness/agent-sandbox';
```

The root export list is intentionally explicit so new implementation exports do not become public API by accident. Treat `@agent-harness/agent-sandbox/src/*` deep imports as private implementation modules; they may change without a migration path.

Published package contents are limited to `README.md`, `package.json`, and runtime `src/**/*.ts` files. Tests and package-local configuration are development-only.
