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
| Warpsurf | Open-source local AI browser copilot | `competition/warpsurf` |
| VibeBrowser Co-Pilot | Local browser-agent MCP | `competition/vibebrowser-copilot` |
| dassi | Consumer browser-agent extension | `competition/dassi` |
| Browserbase + Stagehand | Developer browser-agent platform | `competition/browserbase-stagehand` |
| Browser Use Cloud | Developer browser-agent platform | `competition/browser-use-cloud` |
| WebRun | Cloud desktop browser-agent infrastructure | `competition/webrun` |
| Browserless | Browser automation infrastructure | `competition/browserless` |
| Playwright MCP | Open-source browser automation MCP | `competition/playwright-mcp` |
| BrowserMCP | Local browser-control MCP | `competition/browsermcp` |
| Agent360 Browser MCP | Local browser-control MCP | `competition/agent360-browser-mcp` |
| SideButton | Browser automation MCP with knowledge packs | `competition/sidebutton` |
| Browsaur | Real-Chrome MCP and CDP browser infrastructure | `competition/browsaur` |
| AgentsRoom Browser MCP | Embedded QA browser inside a multi-agent IDE | `competition/agentsroom-browser-mcp` |
| Scout | Extension-first MCP and CDP browser automation | `competition/scout-browser-automation` |
| VulpineOS | Hardened browser-agent runtime | `competition/vulpineos` |
| AlienMcp | Local real-Chrome MCP bridge | `competition/alien-mcp` |
| AgentSmith | Consumer Chrome browser agent | `competition/agentsmith` |
| webact | Token-efficient CDP browser control | `competition/webact` |
| Tandem Browser | Open-source local-first AI browser | `competition/tandem-browser` |
| Oculo | Open-source MCP AI browser | `competition/oculo` |
| BotBro | Consumer local browser automation agent | `competition/botbro` |
| Vibot | Self-hosted browser automation platform | `competition/vibot` |
| Rove | Hosted Playwright API for AI agents | `competition/rove` |
| BrowserStack MCP | Enterprise AI testing MCP | `competition/browserstack-mcp` |
| Octomind | AI-powered E2E testing platform | `competition/octomind` |
| Scrapybara | Remote computer-use infrastructure | `competition/scrapybara` |
| BrowserCat | Hosted headless browser automation API | `competition/browsercat` |
| AgentQL | Natural-language web query and automation layer | `competition/agentql` |
| Cloudflare Browser Run | Edge-hosted browser automation primitive | `competition/cloudflare-browser-run` |
| Bright Data Agent Browser | Web-unlocking browser infrastructure for agents | `competition/bright-data-agent-browser` |
| Firecrawl | Web context and browser data API for agents | `competition/firecrawl` |
| Apify | Actor marketplace and agent web data platform | `competition/apify` |
| Airtop | Cloud browser automation platform | `competition/airtop` |
| Owl Browser | Stealth browser automation engine | `competition/owl-browser` |
| BrowserCloud | Cloud browser automation infrastructure | `competition/browsercloud` |
| Steel.dev | Open-source browser-agent infrastructure | `competition/steel` |
| Kernel | Serverless browser infrastructure | `competition/kernel` |
| Skyvern | Developer browser-agent workflow platform | `competition/skyvern` |
| Hyperbrowser | Developer browser-agent infrastructure | `competition/hyperbrowser` |
| Notte | Developer browser-agent platform | `competition/notte` |
| Anchor Browser | Authenticated browser-agent infrastructure | `competition/anchor-browser` |
| Browserbeam | Structured browser API for AI agents | `competition/browserbeam` |
| Orbit Cloud | Local-to-cloud agentic browser runtime | `competition/orbit-cloud` |
| Reapre | Multi-surface AI automation control plane | `competition/reapre` |
| SurfAgent | Local dedicated Chrome for AI agents | `competition/surfagent` |
| LumaBrowser | Programmable browser with native MCP and LLM selector fallback | `competition/lumabrowser` |
| Vector AI Agent | Local no-code multi-profile browser automation | `competition/vector-ai-agent` |
| OpenOwl | Local desktop automation MCP | `competition/openowl` |
| Simular | Frontier computer-use agent | `competition/simular` |
| Runner H / Surfer H | Vision-language web agent and orchestration platform | `competition/runner-h` |
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
| moonrepo v2 | Developer build toolchain | `competition/moonrepo` |
| Manus | General-purpose autonomous agent | `competition/manus` |
| Genspark Super Agent | No-code general agent workspace | `competition/genspark-super-agent` |
| MultiOn | Autonomous web-agent API | `competition/multion` |
| Lindy | AI assistant workflow automation | `competition/lindy` |
| Gumloop | AI-native workflow automation platform | `competition/gumloop` |
| n8n AI Agents | Open-source workflow automation and AI agent builder | `competition/n8n-ai-agents` |
| Zapier Agents | App-integration AI teammate platform | `competition/zapier-agents` |
| Make AI Agents | Visual workflow AI-agent orchestration platform | `competition/make-ai-agents` |
| Notion Developer Platform | AI work automation platform | `competition/notion-developer-platform` |
| Bytebot | Self-hosted desktop agent | `competition/bytebot` |
| QWebBridge | Local browser bridge for AI agents | `competition/qwebbridge` |
| Chrome DevTools MCP | Official browser debugging MCP | `competition/chrome-devtools-mcp` |
| Agent Browser | Token-efficient browser-agent library | `competition/agent-browser-io` |
| Browser for AI Agent | Browser extension MCP agent host | `competition/browser-for-ai-agent` |
| Magnitude | Vision-first browser-agent library | `competition/magnitude` |
| LaVague | Open-source web-agent and QA generation framework | `competition/lavague` |
| Midscene.js | Vision-driven cross-platform UI automation | `competition/midscene` |

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
- Workflow-agent platforms are absorbing browser tasks into integration canvases. Gumloop, n8n, Zapier, and Make compete less by rendering a browser and more by making web search, app actions, approvals, knowledge sources, and logs feel like durable business automation.
- Their main advantage is operational fit: triggers, app credentials, reusable agents, quota controls, and team sharing are already shaped for sales, support, marketing, finance, and RevOps. Their weakness is that visual nodes and activity counters can obscure the actual page-level evidence a browser-first agent can preserve.
- Pricing anxiety is widening from coding agents into automation agents. Credits, activities, workflow executions, model calls, token usage, and per-step task counting all create a UX wedge for `agent-browser` if it can make cost, action history, and failure recovery clearer during long-running work.
- A new direct-control subcategory is forming around real Chrome plus MCP: SideButton, Browsaur, AgentsRoom Browser MCP, and Scout all sell agents a live browser surface without forcing a remote browser farm.
- The differentiator is shifting from "can click a page" to the quality of context and recovery: knowledge packs, selector memory, screenshots after every action, CDP events, console logs, short refs, and profile persistence.
- These products validate `agent-browser`'s evidence-first wedge, but also raise the bar for setup simplicity. Users increasingly expect a browser agent to connect to Claude Code, Codex, Cursor, or Gemini CLI in minutes.
- The risk in this subcategory is that extension access, authenticated profiles, residential IP claims, wallet/payment tools, and app-specific knowledge packs make privacy and abuse boundaries harder to explain than in a plain local test runner.
- Browser-agent infrastructure is now splitting by reliability philosophy: VulpineOS pushes safety and determinism into a patched browser runtime, while webact strips the stack down to raw CDP and compact page briefs.
- Local Chrome bridges such as AlienMcp and webact validate the real-session wedge, but they also raise the importance of visible scoping, durable logs, and permission boundaries around cookies, storage, console, network, and JavaScript execution.
- Consumer extension products such as AgentSmith show that browser agents can be sold as simple repetitive-work automation with clear action quotas. That packaging may capture mainstream users before developer workbenches do, but it leaves a wedge for stronger evidence, approvals, and replay.
- A newer local-first browser-agent wave is turning MCP into a daily-browser capability rather than a separate test runner. Tandem Browser and Oculo compete directly on real sessions, model-agnostic clients, compact perception, privacy, and explicit permission tiers.
- The same market is splitting by operator maturity: BotBro makes local browser agents feel like a paid consumer utility, Vibot packages self-hosted workflows and monitoring, and Rove sells hosted Playwright sessions with token-aware accessibility trees and video artifacts.
- The recurring wedge for `agent-browser` remains evidence quality. Competitors increasingly claim real Chrome, local credentials, compact context, and MCP setup; the differentiator has to be visible run history, clear authority boundaries, screenshots/video/traces, cost transparency, and recovery controls.
- Web-data infrastructure vendors are now explicitly repackaging headless browsers for AI agents. BrowserCat and Cloudflare Browser Run make browser capacity feel like a cheap utility, while Bright Data sells success through unlocking, proxies, CAPTCHAs, and MCP access.
- AgentQL shows a different wedge: reduce brittle selectors by making natural-language element queries and typed extraction the developer contract. That helps agent builders move faster, but it can hide uncertainty unless query confidence, screenshots, and fallback traces are preserved.
- Cloudflare's "well-behaved bot" framing is a meaningful design difference from stealth-first scraping vendors. It may win compliance-minded builders, while Bright Data captures buyers who measure success by access to difficult public sites.
- For `agent-browser`, the competitive answer is not just cheaper browser hours. The product has to make live authority, replayable evidence, local credential boundaries, and failure recovery clearer than generic browser farms and web-scraping stacks.
- Web-context APIs such as Firecrawl are turning browser work into clean Markdown, JSON, MCP tools, and hosted browser sessions. They will capture AI app teams that primarily need information extraction, while leaving a wedge for `agent-browser` where users need visible local authority, approvals, and replayable browser evidence.
- Specialized action-model vendors such as H Company are competing below the product UI by making web control a VLM/model quality problem. That raises the bar for click accuracy and self-healing, but still leaves room for simpler trace UX, product maturity, and deterministic recovery.
- AI E2E platforms such as Octomind validate that screenshots, traces, logs, visual diffs, and self-healing selectors are valuable browser-agent artifacts. Their QA focus is narrower than `agent-browser`, but their runtime-evidence design should influence any browser-workflow proof surface.
- Open-source local copilots such as Warpsurf are converging on `agent-browser`'s strongest wedge: real Chrome, BYO keys, URL firewalls, task estimates, trajectories, and emergency stop controls. The differentiator is shifting toward durable evidence, eval-backed reliability, and authority boundaries rather than merely "can drive my browser."
- A new local/runtime-control wave is splitting from hosted browser farms. SurfAgent, LumaBrowser, and Vector AI Agent sell persistent local browser ownership, while Reapre sells one governed command plane across browser, desktop, mobile, and app connectors.
- Their strongest UX lesson is that agent browsers need more than navigation tools: buyers expect health checks, crash recovery, reusable runs, screenshots, network logs, MCP/CDP/HTTP surfaces, selector recovery, and clear billing or ownership.
- Their weakness is trust framing. Products that claim bot-detection bypass, wallet automation, thousands of profiles, or broad device control can feel powerful but risky unless they expose narrow permissions, local data boundaries, and replayable evidence better than a generic dashboard.
- Stealth-first browser engines such as Owl Browser and low-cost browser clouds such as BrowserCloud show that AI-browser infrastructure is now being packaged around anti-detection, CAPTCHA solving, concurrency, and proxies as much as agent reasoning. This helps web-data buyers, but it creates a trust and abuse-positioning wedge for products that emphasize scoped authority and auditable evidence.
- Structured browser APIs such as Browserbeam are attacking token cost and selector drift by returning page state, refs, diffs, and stability signals instead of raw browser access. This validates `agent-browser`'s evidence-first direction, but raises the bar for compact, machine-readable state after every action.
- Local-to-cloud products such as Orbit Cloud and local desktop MCPs such as OpenOwl are reframing the browser as one surface in a larger automation runtime. They will capture multi-app workflows that browser-only tools miss; `agent-browser` needs clear boundaries, approvals, and durable traces when work crosses tabs, apps, files, and credentials.
- Desktop agents such as Bytebot are expanding the competitive frame from tab automation to full virtual computers with files, password managers, office apps, terminals, browser sessions, logs, and manual takeover. That broad compatibility is compelling, but it makes scope, approvals, redaction, and evidence even more important.
- Local Chrome bridges such as QWebBridge and Browser for AI Agent show that MCP users increasingly expect agents to use real authenticated tabs through extensions, native hosts, skills, and localhost daemons. The wedge is privacy and context reuse; the risk is prompt injection, cookie/storage exposure, and fragile extension health.
- Official browser tooling is entering the agent loop. Chrome DevTools MCP can become a default browser-control surface for coding agents because it carries DevTools depth, official trust, and many client install paths, but it still leaves product-level workflow history and approvals to the host agent.
- Token-efficient libraries such as Agent Browser are competing on page-state representation rather than browser hosting. ASCII wireframes and numeric refs can reduce context cost, but `agent-browser` should pair compact machine-readable state with screenshots, video, and durable human review artifacts.
- Vision-first automation libraries such as Magnitude and Midscene are pushing the opposite direction from compact DOM snapshots: they make screenshots the primary action substrate and keep Playwright or MCP as integration surfaces. This validates visual fallback and canvas/mobile coverage, but it also makes latency, model cost, replay reports, and mis-click review core UX requirements.
- BDD-to-agent frameworks such as LaVague show that browser agents can enter through the QA artifact pipeline rather than the browser UI. `agent-browser` should preserve Gherkin/scenario/run evidence cleanly enough that test-generation and browser-operation workflows can share the same trace language.
