# Hermes Workspace competitor analysis (as of 2026-05-14)

## Scope and sources

This analysis compares:

- **Competitor**: Hermes Workspace (`outsourc-e/hermes-workspace`) and its public marketing screenshots/docs.
- **Current state**: Agent Browser capabilities documented in this repository.

Primary sources:

- Hermes Workspace GitHub README and docs: <https://github.com/outsourc-e/hermes-workspace>
- Hermes Workspace screenshot page: <https://hermes-workspace.com/#screenshots>
- Agent Browser feature guide: `agent-browser/docs/features.md`
- Agent Browser architecture baseline: `reference_impl/workspace-architecture.md`

---

## 1) Screenshot-driven feature extraction (Hermes Workspace)

From the public screenshots section and feature copy, Hermes Workspace clearly presents six primary UI surfaces:

1. **Chat**
   - Multi-model conversation flow.
   - Real-time tool activity cards/streaming.
2. **Conductor**
   - Mission orchestration modal.
   - Role/task lanes (e.g., Research, Build, Review, Deploy).
3. **Dashboard**
   - High-level session/message/tool/token observability.
4. **Memory**
   - Browse/search/edit agent memory.
5. **Terminal**
   - Browser-native PTY experience.
6. **Settings**
   - Theme/provider/accent customization and setup workflow.

The website also claims:

- “Conductor + Operations” for parallel sub-agents and operations console.
- Mobile-first PWA parity.
- 100+ skills catalog and editable memory/skills.

### Screenshot inventory (public URLs)

- Chat: <https://hermes-workspace.com/_next/image?q=75&url=%2Fscreenshots%2Fchat.png&w=3840>
- Conductor: <https://hermes-workspace.com/_next/image?q=75&url=%2Fscreenshots%2Fconductor.png&w=3840>
- Dashboard: <https://hermes-workspace.com/_next/image?q=75&url=%2Fscreenshots%2Fdashboard.png&w=3840>
- Memory: linked on screenshots page (`/screenshots/memory.png` via Next image loader)
- Terminal: linked on screenshots page (`/screenshots/terminal.png` via Next image loader)
- Settings: linked on screenshots page (`/screenshots/settings.png` via Next image loader)

---

## 2) Current-state baseline (Agent Browser)

Agent Browser currently documents a broader “workspace-as-context” model with:

- Isolated **Research** and **Build** workspaces/projects with independent state.
- In-browser terminal mode (`just-bash`) with sandboxed, in-memory filesystems.
- Workspace-scoped Files tree combining persisted files and terminal filesystem nodes.
- Page overlays with integrated browsing controls and **AI Pointer** grounding.
- Local-model installation for Codi (browser-runnable ONNX) and GHCP ambient agent support.
- Plugin/extensions panel and channel-based sharing integration.
- Keyboard-first project switching, tree ops, omnibar behavior, and file editing.

---

## 3) Diff analysis: Hermes Workspace vs Agent Browser

## 3.1 Capability matrix

| Area | Hermes Workspace (public evidence) | Agent Browser current state | Net assessment |
|---|---|---|---|
| Chat + streaming tools | Strongly present | Present | Rough parity on core chat loop |
| Multi-model switching | Explicitly marketed | Present via agent/model pills | Parity |
| Mission orchestration UI | Strong Conductor surface | Not framed as central mission-control modal | Hermes messaging/UI advantage |
| Operations console / worker grid | Explicitly marketed | No equivalent documented as first-class “operations” console | Hermes advantage |
| Dashboard metrics | Explicit dashboard surface | History/observability exists but less dashboard-centric framing | Hermes advantage in observability UX packaging |
| Memory browsing/editing | Explicit memory surface | Workspace memory exists; editing is file/tree-centric | Hermes appears more explicit for memory UX |
| Skills catalog | Explicit 100+ skills browse/edit | Extensions/plugins and agent-skill patterns exist | Different approach; Hermes appears simpler for end users |
| Terminal integration | Present | Present with detailed sandbox model | Agent Browser technical-depth advantage (isolation semantics) |
| Workspace isolation model | Not primary in public copy | Core product mental model | Agent Browser architectural advantage |
| Browser/page overlay + pointer grounding | Not visible in public Hermes screenshots | First-class page overlays + AI Pointer | Agent Browser differentiator |
| Local browser-runnable model install | Not highlighted | First-class in Settings | Agent Browser differentiator |
| PWA/mobile parity | Explicitly marketed | Not foregrounded in feature messaging | Hermes go-to-market messaging advantage |

## 3.2 Positioning gap summary

Hermes Workspace appears to optimize for a **single command-center narrative** (“chat + conductor + operations + dashboard”) that is easy to grok from screenshots.

Agent Browser currently appears to optimize for **workspace-isolated execution contexts**, **in-browser compute surfaces**, and **grounded browser interaction (AI Pointer/page overlay)**.

Interpretation: Hermes is winning the “operations cockpit” story; Agent Browser is stronger on “browser-native, isolated, deeply interactive workspace semantics.”

---

## 4) Differentiators (documented)

## 4.1 Hermes Workspace differentiators (vs Agent Browser)

1. **Conductor-first orchestration UX**
   - Dedicated mission workflow surface with role lanes visible in marketing artifacts.
2. **Operations narrative clarity**
   - Clear promise of live worker grid/control plane from first-touch copy.
3. **Dashboard-forward observability packaging**
   - Easy executive/ops story around sessions/messages/tools/tokens.
4. **Low-friction value communication**
   - Public screenshots tightly map to user outcomes with minimal architecture jargon.

## 4.2 Agent Browser differentiators (vs Hermes Workspace)

1. **Workspace isolation as first-class architecture**
   - Separate workspace contexts with independent tabs/files/chats/terminals/view state.
2. **Browser-native execution boundaries**
   - `just-bash` + session-scoped in-memory filesystem + optional secure sandbox tool flow.
3. **AI Pointer and page-overlay grounding**
   - Structured capture of page coordinates/entities/references into actionable prompts.
4. **Local model lifecycle in-browser**
   - Built-in ONNX model discovery/loading flow for local inference via Codi.
5. **Developer-grade interaction model**
   - Rich keyboard, tree, file, and omnibar workflows with explicit reproducibility paths.

---

## 5) Strategic implications and recommended response

## 5.1 What to preserve

- Keep the strong workspace-isolation + browser-surface model; this is hard to copy quickly and technically defensible.
- Preserve the AI Pointer + page-overlay capabilities as a distinct “agent can act on what I point at” moat.

## 5.2 What to improve (priority)

1. **Add/foreground an “Operations” narrative layer**
   - Package existing telemetry/history/state into a dashboard/operations storyline.
2. **Improve first-impression screenshot storytelling**
   - Publish a curated six-surface sequence equivalent to chat/conductor/dashboard/memory/terminal/settings.
3. **Make memory/skills discoverability more explicit in UI copy**
   - Current power is present but comparatively less obvious from quick-glance artifacts.
4. **Lead with mobile/PWA parity claims only when backed by dedicated visual proof**
   - Hermes benefits from explicit parity language in public marketing.

## 5.3 Suggested near-term deliverables

- “Agent Browser Operations” screen concept (metrics + worker/session state + alerts).
- Public screenshots section mirroring a complete workflow narrative.
- One-page competitive positioning memo: “Why workspace isolation + AI pointer beats generic chat dashboards.”

---

## 6) Evidence confidence and caveats

- This is a **public-artifact analysis**, not a source-code deep audit of Hermes behavior.
- Claims are grounded in published README/site content and screenshot metadata as of **2026-05-14**.
- Any hidden/internal/experimental Hermes features outside public artifacts are out of scope.
