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
| ChatGPT Agent | Model-owner computer-use agent | `competition/chatgpt-agent` |
| Perplexity Comet | End-user AI browser | `competition/perplexity-comet` |
| Dia | End-user AI browser | `competition/dia` |
| Gemini Agent | Model-owner browser agent | `competition/gemini-agent` |
| Claude Computer Use | Model-provider computer-use API | `competition/claude-computer-use` |
| BrowserOS | Open-source AI browser | `competition/browseros` |
| Nanobrowser | Open-source browser-agent extension | `competition/nanobrowser` |
| VibeBrowser Co-Pilot | Local browser-agent MCP | `competition/vibebrowser-copilot` |
| dassi | Consumer browser-agent extension | `competition/dassi` |
| Browserbase + Stagehand | Developer browser-agent platform | `competition/browserbase-stagehand` |
| Browser Use Cloud | Developer browser-agent platform | `competition/browser-use-cloud` |
| WebRun | Cloud desktop browser-agent infrastructure | `competition/webrun` |
| Browserless | Browser automation infrastructure | `competition/browserless` |
| Playwright MCP | Open-source browser automation MCP | `competition/playwright-mcp` |
| BrowserMCP | Local browser-control MCP | `competition/browsermcp` |
| Agent360 Browser MCP | Local browser-control MCP | `competition/agent360-browser-mcp` |
| BrowserStack MCP | Enterprise AI testing MCP | `competition/browserstack-mcp` |
| Scrapybara | Remote computer-use infrastructure | `competition/scrapybara` |
| Apify | Actor marketplace and agent web data platform | `competition/apify` |
| Airtop | Cloud browser automation platform | `competition/airtop` |
| Steel.dev | Open-source browser-agent infrastructure | `competition/steel` |
| Kernel | Serverless browser infrastructure | `competition/kernel` |
| Skyvern | Developer browser-agent workflow platform | `competition/skyvern` |
| Hyperbrowser | Developer browser-agent infrastructure | `competition/hyperbrowser` |
| Notte | Developer browser-agent platform | `competition/notte` |
| Anchor Browser | Authenticated browser-agent infrastructure | `competition/anchor-browser` |
| Simular | Frontier computer-use agent | `competition/simular` |
| Fellou | End-user agentic productivity browser | `competition/fellou` |
| Opera Neon | End-user agentic AI browser | `competition/opera-neon` |
| Gemini in Chrome | Incumbent browser AI assistant | `competition/gemini-in-chrome` |
| Microsoft Edge Copilot Mode | Incumbent browser AI assistant | `competition/microsoft-edge-copilot-mode` |
| UiPath Agentic Automation | Enterprise agentic automation/RPA platform | `competition/uipath-agentic-automation` |
| Automation Anywhere APA | Enterprise agentic process automation platform | `competition/automation-anywhere-apa` |
| Sema4.ai / Robocorp | Python-first RPA and AI action platform | `competition/sema4ai-robocorp` |
| WorkFusion AI Agents | Financial-crime compliance AI-agent platform | `competition/workfusion-ai-agents` |
| Devin | Autonomous software engineer | `competition/devin` |
| Cursor Background Agents | AI coding IDE and remote agents | `competition/cursor-background-agents` |
| Replit Agent | Prompt-to-app agent workspace | `competition/replit-agent` |
| GitHub Copilot Cloud Agent | Repository-native coding agent | `competition/github-copilot-cloud-agent` |
| Manus | General-purpose autonomous agent | `competition/manus` |
| Genspark Super Agent | No-code general agent workspace | `competition/genspark-super-agent` |
| MultiOn | Autonomous web-agent API | `competition/multion` |
| Lindy | AI assistant workflow automation | `competition/lindy` |

## Cross-Market Takeaways

- End-user browsers are converging on a sidecar assistant plus agent mode, but the best-positioned products differentiate through trust controls, memory controls, and low-friction handoff between manual and agent browsing.
- Developer platforms differentiate on reliability scaffolding: session replay, logs, CDP access, deterministic scripts, identity/CAPTCHA/proxy support, and the ability to mix AI actions with Playwright-level control.
- Cloud browser infrastructure is splitting into three buying motions: no-code or low-code automations for operators, open/self-hostable browser APIs for AI engineers, and serverless browser primitives for teams that already own their agent loop.
- Adjacent developer tooling is now just as competitive as full browser-agent platforms: Browserless sells stealth and replayable managed browsers, Playwright MCP makes local browser control a default assistant primitive, and Apify turns web automation into a marketplace of callable agent tools.
- Local browser MCPs are splitting away from headless automation. BrowserMCP and Agent360 Browser MCP compete on real-profile access, privacy, CAPTCHA/2FA handoff, and low setup, but also expose fragility around extension/server connectivity, tab state, and opaque prompt loops.
- Enterprise QA platforms are reframing browser automation as AI-assisted testing rather than generic agents. BrowserStack MCP is especially dangerous in quality-gated orgs because it combines real-device coverage, test management, accessibility, failure analysis, and self-healing under existing procurement.
- Computer-use infrastructure vendors such as Scrapybara compete with browser-only products by offering whole desktops, filesystems, code execution, authenticated browser states, and streaming control; that expands use cases but can make browser-specific UX and audit trails feel less focused.
- The most repeated negative signal across the category is not "AI cannot browse"; it is that autonomous browsing widens the security, privacy, and verification surface. Prompt injection, wrong clicks, hidden page instructions, logged-in account access, and opaque billing/time costs are recurrent complaints.
- `agent-browser` can compete by being visibly inspectable: explicit agent traces, local-first state, regression/eval artifacts, user-controlled approvals, and first-class developer extension surfaces.
- Incumbent browsers are now absorbing the same sidecar, cross-tab, history, voice, and autonomous-action patterns. They will capture mainstream distribution, but their AI-first UI pressure creates a wedge for products that feel less intrusive and more auditable.
- Newer local extension products such as VibeBrowser and dassi are attacking the "logged-in real browser" wedge directly. Their strength is low-friction authenticated context; their risk is that real-profile access makes audit, approval, secret handling, and prompt-injection recovery much more important.
- Fast cloud desktop products such as WebRun and whole-computer agents such as Simular broaden the competitive field beyond browser tabs. They make speed, filesystems, OS actions, and persistent environments table stakes, but they also create a stronger need for replayable evidence and policy boundaries.
- Model-owner agents such as ChatGPT Agent, Gemini Agent, and Claude Computer Use compete above the browser UI by making web action one tool inside a broader work assistant. Their weakness is inspectability: product surfaces often summarize progress better than they preserve deterministic, reviewable evidence.
- Open-source extension products such as Nanobrowser keep the user in their existing logged-in browser, which is a strong adoption wedge. The risk is that extension permissions, BYOK setup, and real-profile automation raise the bar for plain-language trust controls.
- Enterprise RPA incumbents are reframing "agents" as governed orchestration across robots, people, APIs, documents, and legacy UIs. They will capture compliance-heavy buyers that require audit, case management, and center-of-excellence controls, but their broad suites can feel overbuilt for developer-first browser agent workflows.
- Vertical AI-agent products such as WorkFusion show another wedge: package the whole process and domain model instead of selling generic browser control. This is powerful when the buyer wants outcomes in a known regulated workflow, but it leaves less room for local, inspectable, user-directed web work.
- Coding-agent workbenches are converging on the same delegation loop: scoped task, isolated environment, branch or session, progress log, pull request, and human review. Devin sells this as an AI engineer, Cursor sells it from the IDE, Replit sells it as a full app-builder workspace, and GitHub sells it through repository-native issue and PR distribution.
- The biggest opening for `agent-browser` against coding agents is evidence quality outside source code: browser session traces, screenshots, user approvals, visual regression artifacts, and local state that remain inspectable after the agent finishes.
- Variable agent pricing is becoming a category-wide UX problem. Replit credit burn, Devin ACUs, Cursor model-priced background work, and Copilot premium-request/Actions consumption all create anxiety when long-running agents take a wrong turn.
- General-purpose agents such as Manus and Genspark compete above the browser by selling broad delegation and finished artifacts. They can capture mainstream users quickly, but they leave a wedge for `agent-browser` when users need deterministic traces, local state, and exact browser evidence.
- Local-browser delegation is becoming a shared pattern. Manus Browser Operator and MultiOn local mode validate the logged-in-browser wedge, but they also increase demand for session authorization, action allowlists, and clear stop/recovery controls.
- Office-agent platforms such as Lindy pull browser/computer use into inbox, meeting, calendar, and CRM workflows. They will win buyers who want packaged work outcomes, while developer-first workbenches can still win on inspectability, reproducibility, and extension surfaces.
