# Summary Diff For Linear Feature Generation

Updated: 2026-06-02
Baseline: `.features/Summary.md` refreshed through the 2026-06-01 OpenClaw corpus.
Diff type: additive updates after the 2026-06-02 Codex refresh

## Net new normalized features

### Added: Hotkey appshots that attach live window context to an agent thread
- Why now: the refreshed Codex corpus shows the harness moving from prompt-only context capture toward hotkey-based attachment of the active desktop window as structured agent input.
- Research delta:
  - Codex Appshots were introduced in the May 21, 2026 release as a one-hotkey capture flow in the macOS app
  - an Appshot carries both a screenshot and any available text from the target window into the thread
  - OpenAI positions Appshots as a faster way to give Codex context than manually writing a long setup prompt about what is already visible
  - the same May release framed Goal mode as generally available across the app, IDE, and CLI, which reinforces that Codex is optimizing for longer-running work where fast context attachment matters more
  - current Codex messaging treats the desktop window as a first-class context surface rather than an external artifact the user must translate into prose

## Expanded normalized features

### Expanded: Browser use and computer control
- Why now: the refreshed Codex corpus broadens browser and desktop control into a host-aware, cross-device supervision loop with richer browser inspection semantics.
- Research delta:
  - Codex added advanced browser annotation mode, faster asset extraction, a read-only JavaScript context, and browser reliability improvements in the May 21, 2026 release
  - eligible Mac users can keep Computer Use running remotely after the host locks
  - Codex added Windows Computer Use and Windows-host remote control in the May 29, 2026 release
  - the remote client can now stay attached to live host state while the underlying Mac or Windows machine remains the execution environment

### Expanded: Operator control consoles with blocked-state queues and durable usage ledgers
- Why now: Codex Profiles make identity, activity, usage, and token activity inspectable as an explicit product surface instead of leaving that information scattered across settings and billing UI.
- Research delta:
  - Codex Profiles were introduced in the May 29, 2026 release
  - OpenAI says profiles expose Codex identity, activity over time, profile details, usage stats, and token activity
  - the same release framed these surfaces alongside broader responsiveness and in-app browser stability work, which suggests they are part of the active operating surface rather than a passive account page

## Linear-ready feature payloads

### Proposed Linear feature: Add appshots for active-window context capture
- Linear issue title:
  - `Add appshots for active-window context capture`
- Suggested problem statement:
  - `agent-browser` is strongest when the user can steer from concrete evidence, but it still relies too heavily on the user manually restating what they see in another app, dashboard, document, or error state. Competitors are beginning to let users attach the active window itself as structured context, carrying both the visual state and any machine-readable text straight into the agent thread. Without a fast capture path, high-signal desktop context gets lost, setup prompts get longer and less precise, and longer-running threads miss the exact UI or document state that triggered the work. The product needs an appshot-style capture surface that turns the active window into reviewable agent context with clear provenance.`
- One-shot instruction for an LLM:
  - Implement appshots for `agent-browser`: let a user hotkey-capture the active window or a selected app surface into the current thread, store both a screenshot and extracted text with source metadata and timestamps, preview the capture before submission when feasible, keep the captured artifact separate from ordinary chat text so the agent can cite it explicitly, support follow-up reuse of the same capture across longer-running turns, and add permission plus audit controls so users can see what was captured, remove it, or restrict which apps may be attached to a thread.
