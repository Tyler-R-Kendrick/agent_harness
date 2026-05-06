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

## Cross-Market Takeaways

- End-user browsers are converging on a sidecar assistant plus agent mode, but the best-positioned products differentiate through trust controls, memory controls, and low-friction handoff between manual and agent browsing.
- Developer platforms differentiate on reliability scaffolding: session replay, logs, CDP access, deterministic scripts, identity/CAPTCHA/proxy support, and the ability to mix AI actions with Playwright-level control.
- The most repeated negative signal across the category is not "AI cannot browse"; it is that autonomous browsing widens the security, privacy, and verification surface. Prompt injection, wrong clicks, hidden page instructions, logged-in account access, and opaque billing/time costs are recurrent complaints.
- `agent-browser` can compete by being visibly inspectable: explicit agent traces, local-first state, regression/eval artifacts, user-controlled approvals, and first-class developer extension surfaces.

