# Chat Channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Agent Browser delegate or continue chat sessions through plugin-contributed channels such as Slack, Telegram, SMS, and the built-in WebRTC peer flow.

**Architecture:** Extend the shared plugin manifest contract with `contributes.channels` and `channel` capabilities. Keep the first runtime slice deterministic in Agent Browser: resolve installed channel contributions into share-dialog options, always include the existing QR/WebRTC peer option, and create a copyable handoff payload for external channel plugins until they provide a concrete sender.

**Tech Stack:** TypeScript, Zod manifest validation, React 18, Vitest, Testing Library, Playwright visual smoke, existing `agent-browser/src/shared-chat` WebRTC implementation.

---

## Research Notes

- Notte research calls out sessions, identities, profiles, email/phone, OTP, 2FA, and vaults as trust primitives. Channel extensions must leave room for identity, verification, and secret-backed provider configuration.
- Opera Neon research highlights browser-local action and avoiding password handoff to cloud services. WebRTC remains the default local-first channel and external channels should be explicit handoffs, not silent remote control.
- Steel research emphasizes sessions, integrations, credentials, extensions, profiles, and session viewers. Channel contributions should expose transport kind, delegate/continue capabilities, and configuration needs.
- n8n research emphasizes workflow sharing, credential sharing, variables, templates, source-control environments, RBAC, and trigger/action nodes. Channel metadata should be extensible enough for future triggers, notification routing, and approval workflows.

## TDD Task Plan

### Task 1: Plugin Manifest Channel Contributions

**Files:**
- Modify: `harness-core/src/pluginManifest.ts`
- Modify: `harness-core/src/index.ts`
- Modify: `harness-core/src/__tests__/pluginManifest.test.ts`

- [ ] **Step 1: Write failing manifest tests**

Add a test with this channel contribution:

```ts
contributes: {
  channels: [{
    id: 'slack',
    label: 'Slack',
    kind: 'slack',
    capabilities: ['delegate', 'continue', 'notify'],
    configuration: { type: 'object' },
  }],
},
capabilities: [{ kind: 'channel', id: 'slack' }],
```

Run: `npm.cmd --workspace harness-core run test -- src/__tests__/pluginManifest.test.ts -t "channel contributions"`
Expected: FAIL because `channel` capability and `contributes.channels` are not accepted yet.

- [ ] **Step 2: Implement minimal schema/types**

Add `HarnessPluginChannelKind`, `HarnessPluginChannelCapability`, `HarnessPluginChannelContribution`, include `channels` in `HarnessPluginContributions`, validate known channel kinds, validate capability strings, and export the new types from `harness-core/src/index.ts`.

- [ ] **Step 3: Verify green**

Run: `npm.cmd --workspace harness-core run test -- src/__tests__/pluginManifest.test.ts -t "channel contributions"`
Expected: PASS.

### Task 2: Channel Option Resolver

**Files:**
- Create: `agent-browser/src/services/chatChannels.ts`
- Create: `agent-browser/src/services/chatChannels.test.ts`
- Modify: `agent-browser/src/services/defaultExtensions.test.ts`

- [ ] **Step 1: Write failing resolver tests**

Assert that `buildChatChannelOptions(null)` returns the default `WebRTC peer` option with `delegate` and `continue`, and that a runtime descriptor contributing Slack adds `Slack` after WebRTC.

Run: `npm.cmd --workspace agent-browser run test -- src/services/chatChannels.test.ts`
Expected: FAIL because `chatChannels.ts` does not exist.

- [ ] **Step 2: Implement resolver and handoff payload**

Create `DEFAULT_WEBRTC_CHAT_CHANNEL`, `buildChatChannelOptions`, `buildChatChannelHandoffPayload`, and `formatChatChannelHandoffMessage`. Dedupe by channel id and keep WebRTC first.

- [ ] **Step 3: Add bundled example channel extension metadata**

Add `ext/channel/external-channels/agent-harness.plugin.json`, register it in `ext/agent-harness.marketplace.json`, import it in `defaultExtensions.ts`, and test that the default catalog lists `agent-harness.ext.external-channels`.

- [ ] **Step 4: Verify green**

Run: `npm.cmd --workspace agent-browser run test -- src/services/chatChannels.test.ts src/services/defaultExtensions.test.ts`
Expected: PASS.

### Task 3: Share Dialog Options

**Files:**
- Modify: `agent-browser/src/shared-chat/SharedChatModal.tsx`
- Create: `agent-browser/src/shared-chat/SharedChatModal.test.tsx`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Write failing UI tests**

Test `SharedChatModal` with Slack and SMS channel options. Assert WebRTC start/join stays visible, Slack appears under `Channel share options`, and clicking Slack calls `onCopyToClipboard` with an `agent-harness.chat-channel-handoff` payload.

Run: `npm.cmd --workspace agent-browser run test -- src/shared-chat/SharedChatModal.test.tsx`
Expected: FAIL because the modal has no channel option props.

- [ ] **Step 2: Implement modal and App wiring**

Compute `const chatChannelOptions = buildChatChannelOptions(defaultExtensions)` in `ChatPanel`, pass them to `SharedChatModal`, and render non-WebRTC options as accessible action buttons that copy the handoff message and report status.

- [ ] **Step 3: Verify green**

Run: `npm.cmd --workspace agent-browser run test -- src/shared-chat/SharedChatModal.test.tsx src/App.smoke.test.tsx -t "shared chat|channel"`
Expected: PASS.

### Task 4: Standards Docs And Visual Smoke

**Files:**
- Modify: `docs/plugin-standards.md`
- Modify: `agent-browser/docs/features.md`
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] **Step 1: Document channel extensions**

Add manifest examples for Slack/SMS/Telegram style channels, explain `delegate`, `continue`, `notify`, `presence`, and `handoff-link`, and note that WebRTC is the built-in local-first channel.

- [ ] **Step 2: Add visual smoke assertion**

Seed `agent-harness.ext.external-channels` as installed, open the share dialog, assert `WebRTC peer`, `Slack`, `Telegram`, and `SMS` are visible, and save the regular visual smoke screenshot.

- [ ] **Step 3: Run full validation**

Run:

```powershell
npm.cmd --workspace harness-core run test -- src/__tests__/pluginManifest.test.ts -t "channel contributions"
npm.cmd --workspace agent-browser run test -- src/services/chatChannels.test.ts src/shared-chat/SharedChatModal.test.tsx src/services/defaultExtensions.test.ts
npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx -t "shared chat"
npm.cmd --workspace agent-browser run test:scripts
npm.cmd run visual:agent-browser
NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser
```

Expected: all pass; if Windows Vite/esbuild sandboxing blocks the full verifier, preserve the exact blocker and the passing focused gates.

## Self-Review

- Spec coverage: plugin extension type, default WebRTC channel, share-dialog channel options, external handoff payloads, competitor-research-derived extensibility, docs, and validation are covered.
- Placeholder scan: no TODO, TBD, or deferred behavior is required for the first slice.
- Type consistency: `channel`, `channels`, `ChatChannelOption`, and `agent-harness.chat-channel-handoff` are used consistently.
