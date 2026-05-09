# Competition Research

Generated for automation `document-competition` on 2026-05-06.

This directory tracks competitors for `agent-browser`, split between end-user AI browsers and developer-facing browser-agent infrastructure.

## Directory Contract

Each product uses this layout:

```text
competition/<product-slug>/
  product.yml
  design/design.md
  features/<product-slug>.feature
  marketing/marketing.md
  gossip/gossip.md
```

`product.yml` is the parseable index. Markdown files provide structured notes. Gherkin files capture differentiating user flows.

## Products Covered

| Product | Segment | Product path |
|---|---|---|
| ChatGPT Atlas | End-user AI browser | `competition/chatgpt-atlas` |
| Perplexity Comet | End-user AI browser | `competition/perplexity-comet` |
| Dia | End-user AI browser | `competition/dia` |
| BrowserOS | Open-source AI browser | `competition/browseros` |
| Browserbase + Stagehand | Developer browser-agent platform | `competition/browserbase-stagehand` |
| Browser Use Cloud | Developer browser-agent platform | `competition/browser-use-cloud` |
| Airtop | Cloud browser automation platform | `competition/airtop` |
| Steel.dev | Open-source browser-agent infrastructure | `competition/steel` |
| Kernel | Serverless browser infrastructure | `competition/kernel` |
| Skyvern | Developer browser-agent workflow platform | `competition/skyvern` |
| Hyperbrowser | Developer browser-agent infrastructure | `competition/hyperbrowser` |
| Notte | Developer browser-agent platform | `competition/notte` |
| Anchor Browser | Authenticated browser-agent infrastructure | `competition/anchor-browser` |
| Fellou | End-user agentic productivity browser | `competition/fellou` |
| Opera Neon | End-user agentic AI browser | `competition/opera-neon` |
| Gemini in Chrome | Incumbent browser AI assistant | `competition/gemini-in-chrome` |
| Microsoft Edge Copilot Mode | Incumbent browser AI assistant | `competition/microsoft-edge-copilot-mode` |

## Cross-Market Takeaways

- End-user browsers are converging on a sidecar assistant plus agent mode, but the best-positioned products differentiate through trust controls, memory controls, and low-friction handoff between manual and agent browsing.
- Developer platforms differentiate on reliability scaffolding: session replay, logs, CDP access, deterministic scripts, identity/CAPTCHA/proxy support, and the ability to mix AI actions with Playwright-level control.
- Cloud browser infrastructure is splitting into three buying motions: no-code or low-code automations for operators, open/self-hostable browser APIs for AI engineers, and serverless browser primitives for teams that already own their agent loop.
- The most repeated negative signal across the category is not "AI cannot browse"; it is that autonomous browsing widens the security, privacy, and verification surface. Prompt injection, wrong clicks, hidden page instructions, logged-in account access, and opaque billing/time costs are recurrent complaints.
- `agent-browser` can compete by being visibly inspectable: explicit agent traces, local-first state, regression/eval artifacts, user-controlled approvals, and first-class developer extension surfaces.
- Incumbent browsers are now absorbing the same sidecar, cross-tab, history, voice, and autonomous-action patterns. They will capture mainstream distribution, but their AI-first UI pressure creates a wedge for products that feel less intrusive and more auditable.

