# VulpineOS Marketing

## Audience

- AI infrastructure engineers building browser agents that need lower token costs and stronger execution guarantees.
- Teams running many browser sessions where proxy/fingerprint management, crash recovery, cost budgets, and webhooks matter.
- Open-source users who want self-hostable browser-agent runtime primitives rather than a hosted browser farm.

## Positioning

- Core claim: standard browsers and automation libraries were built for humans or test bots; agents need a hardened runtime.
- Wedge against Playwright-style tools: JavaScript wrappers and accessibility snapshots cannot reliably solve hidden prompt injection, page mutation, or token bloat.
- Wedge against cloud browsers: self-hosted runtime, open source components, bring-your-own LLM/proxy/infra, and engine-level control.

## Customer Model

- Open-source adoption via MPL 2.0 runtime and related repos.
- Managed extraction/API messaging appears to create a hosted monetization path.
- Enterprise/support opportunity is strongest for teams that need repeatable browser-agent operations at scale.

## Who They Capture

- Developers frustrated by Playwright accessibility-tree verbosity and browser-agent wrong-click loops.
- Teams that want evidence that browser-agent security is handled below the prompt layer.
- Operators who prefer local or self-hosted infra over Browserbase/Browserless-style cloud browser sessions.

## Who They Miss

- Users looking for a polished consumer AI browser.
- Compliance-heavy buyers uncomfortable with stealth, anti-detect, proxy rotation, or trust-warming claims.
- Teams that want stable Chrome compatibility first and do not want to reason about Firefox/Camoufox patches.

## Sources

- https://vulpineos.com/
- https://github.com/VulpineOS/VulpineOS
