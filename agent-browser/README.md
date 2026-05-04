# agent-browser

`agent-browser` is the primary runnable app in the `agent-harness` monorepo. It is a React + Vite prototype for the in-browser agent workspace described in the root [`README.md`](../README.md).

## Default workspace content

Each new workspace is pre-seeded only with memory files under `.memory/`.

- Optional formats such as AGENTS.md, agent-skills, and DESIGN.md are plugin-owned extension assets under [`../ext/`](../ext/).
- Repo-root [`../skills/`](../skills/) contains the broader bundled skill library used across the repository and by compatible agents outside the browser app.
- Runtime tests cover the default seeded memory files and generic tool, plugin, and hook manifest handling.

Use the `ext/*` plugin manifests when documenting optional runtime extension behavior. Use the repo-root skill library when documenting reusable checked-in skills for the wider repository.

## Commands

From `agent-browser/`:

- `npm run dev` starts the hot-reload server on port `5174`.
- `npm run dev:cucumber` starts the dedicated browser test server on port `4173`.
- `npm run build` produces the production bundle.
- `npm run lint` runs TypeScript in no-emit mode.
- `npm run test` runs the Vitest suite.
- `npm run test:coverage` runs Vitest with coverage.
- `npm run test:cucumber` starts the test server and runs the Cucumber suite.
- `npm run visual:smoke` runs the Playwright visual smoke check for the app workspace.

From the repository root:

- `npm run dev:agent-browser` runs the app without changing directories.
- `npm run visual:agent-browser` runs the repeatable smoke validation and writes `output/playwright/agent-browser-visual-smoke.png`.
- `npm run verify:agent-browser` runs the documented repo-level verification flow: lint, eval-manifest validation, coverage, production build, `npm audit --audit-level=moderate`, and the visual smoke check.

Prefer the repo-root wrapper scripts for contributor onboarding, CI parity, and repeatable validation.

## Custom providers

Agent Browser consumes config-backed custom providers through `harness-core`.
The app-specific `src/services/agentProvider.ts` only binds that core catalog to
AI SDK's OpenAI-compatible provider factory. To add a provider, load a catalog
with entries such as:

```json
{
  "activeModel": "openrouter:deepseek/deepseek-chat",
  "providers": [
    {
      "id": "openrouter",
      "kind": "openai-compatible",
      "baseURL": "https://openrouter.ai/api/v1",
      "apiKeyEnvVar": "OPENROUTER_API_KEY",
      "models": [
        {
          "id": "deepseek/deepseek-chat",
          "contextWindow": 64000,
          "maxOutputTokens": 8000,
          "supportsNativeToolCalls": true
        }
      ]
    }
  ]
}
```

Use `provider:model` refs when selecting models; the model id itself may contain
slashes. Secret values stay outside the catalog and are supplied by the host
through the `harness-core` secret resolver.

## Hot reload in Codespaces

Opening the repository in VS Code should start the Vite dev server automatically through `.vscode/tasks.json`. In Codespaces, the workspace also installs a small local helper extension that opens VS Code Simple Browser to the forwarded URL for port `5174`.

The browser-facing URL should always come from `../skills/agent-harness-context/scripts/codespaces-uri.sh 5174`. The preview helper first validates that forwarded URL, and if it is not yet browser-accessible it retries with `--public --check` before opening Simple Browser. Use `http://localhost:5174` only for tooling that runs inside the container, such as `curl`, Playwright, or local health checks.

If the helper extension was installed during the current session, reload the VS Code window once so the startup activation runs.

## Troubleshooting

- If the preview did not open automatically, run the `Agent Harness: Open Agent Browser Preview` command.
- If the forwarded preview URL fails in Codespaces, run `../skills/agent-harness-context/scripts/codespaces-uri.sh --public --check 5174` and retry the preview.
- If you want to start or debug the dev server manually, use `.vscode/launch.json`.

## Security Model

Shared chat uses QR codes only as untrusted signaling transport. Trust comes from locally generated WebCrypto ECDSA P-256 device identities, a user-confirmed pairing code derived from both device public keys and both SDP hashes, and signed append-only session events.

WebRTC encrypts the peer-to-peer DataChannel transport, but transport encryption is not treated as authorization. Every durable chat/control event is signed by the sending device and the receiver validates schema, session id, membership, monotonic sequence number, replay status, timestamp skew, payload limits, and signature before rendering or mutating session state. Pairing must be explicitly confirmed before durable chat events are accepted.

The QR invite/answer payloads can be substituted, replayed, or tampered with by an attacker. Answer payloads are signed, invite/answer SDP bodies are hashed, and the pairing code confirmation step is what detects QR substitution before the peer is approved.

Private signing keys are generated as non-extractable `CryptoKey` objects. The app attempts to store them in IndexedDB and falls back to memory-only keys with a warning if the browser cannot persist non-extractable keys. Private key material is never stored in localStorage.

Session end is a signed control event that closes the local connection, but it cannot retract messages already delivered to another device. This MVP supports only two devices, uses STUN-only WebRTC, and can fail on restrictive networks without TURN. QR pairing requires physical access to both devices.

XSS is the primary web-app compromise risk: if the origin is compromised, malicious JavaScript can invoke browser-held signing keys even when they are non-extractable. Production deployments must bundle scripts, avoid third-party runtime scripts, render chat text as text rather than HTML, and use the checked-in `public/_headers` CSP, referrer, content-type, and permissions policies or equivalent hosting configuration.
