# @agent-harness/sandbox-policy

OpenShell-style declarative sandbox policy for agent_harness. Parse one portable
YAML (or JSON) policy document and compile it to the existing browser sandbox
adapter configuration.

This is **Phase 1 (opt-in)** of
[`docs/adr/2026-07-02-sandbox-and-policy.md`](../../docs/adr/2026-07-02-sandbox-and-policy.md):
a single policy artifact describes network, limits, storage, and (server-tier)
enforcement scopes, and compiles to whatever enforcement the host tier provides.

- **Browser tier** enforces the network / limits / storage subset via the
  compiled `SandboxBrowserOptions` (structural match of
  `BrowserSandboxOptions` in `lib/agent-sandbox`), a derived `NetworkPolicy`
  (`deny | restricted`), and `RunLimits`-shaped limits.
- **Server tiers** enforce `enforcement.*` (filesystem, process, seccomp,
  landlock, inference routing, ...) natively. The browser cannot honor those, so
  `compileSandboxPolicy` returns them in `unsupportedDirectives` (sorted) rather
  than silently dropping them.

This package deliberately has **no dependency on `agent-browser`**
(agent-browser depends on the libs, not vice-versa): the `NetworkPolicy` union
and `RunLimits` shape are redeclared locally as `SandboxNetworkPolicyKind` and
`SandboxRunLimits`.

## The `SandboxPolicy` contract

Every top-level field is optional; an empty policy compiles to safe,
network-denied defaults.

```ts
interface SandboxPolicy {
  network?: {
    allow?: boolean;
    allowedOrigins?: string[];
    allowedMethods?: string[];
    allowLocalhostHttp?: boolean;
    policy?: 'deny' | 'restricted';
    maxRequestBytes?: number;
    maxResponseBytes?: number;
    timeoutMs?: number;
  };
  limits?: {
    // RunLimits-shaped (compiled into CompiledSandboxPolicy.limits)
    maxRuntimeMs?: number;
    maxStdoutBytes?: number;
    maxStderrBytes?: number;
    maxLogBytes?: number;
    maxEventCount?: number;
    maxArtifactBytes?: number;
    maxWorkspaceBytes?: number;
    // Browser-adapter ceilings (compiled into browserOptions)
    maxOutputBytes?: number;
    maxFileBytes?: number;
    maxTotalBytes?: number;
    defaultTimeoutMs?: number;
  };
  storage?: 'none' | 'skill-local';
  dom?: false;
  enforcement?: Record<string, unknown>; // server-tier-only directives
}
```

## YAML example

```yaml
network:
  allow: true
  policy: restricted
  allowedOrigins:
    - https://api.example.com
  allowedMethods:
    - GET
    - POST
  allowLocalhostHttp: false
  maxRequestBytes: 65536
  maxResponseBytes: 262144
  timeoutMs: 10000
limits:
  maxRuntimeMs: 15000
  maxOutputBytes: 32768
  maxTotalBytes: 262144
  defaultTimeoutMs: 5000
storage: skill-local
dom: false
# Server-tier-only: the browser cannot enforce these; they surface in
# unsupportedDirectives.
enforcement:
  filesystem:
    readOnly:
      - /workspace
  seccomp: default
  inferenceRouting:
    model: local
```

## Usage

```ts
import { parseSandboxPolicy, compileSandboxPolicy } from '@agent-harness/sandbox-policy';

const policy = parseSandboxPolicy(yamlText); // format defaults to 'auto'
const compiled = compileSandboxPolicy(policy);

compiled.browserOptions;         // → pass to the browser sandbox adapter
compiled.networkPolicy;          // 'deny' | 'restricted'
compiled.limits;                 // RunLimits subset
compiled.permissions;            // { network, storage, dom: false }
compiled.unsupportedDirectives;  // ['filesystem', 'inferenceRouting', 'seccomp']
```

`parseSandboxPolicy(input, { format })` accepts `'yaml'`, `'json'`, or `'auto'`
(default: try JSON, then YAML). It strictly validates every field and throws a
clear `Error` on bad input, including unknown top-level keys.
