# Agent360 Browser MCP Gossip

## Positive Signals

- The product copy directly acknowledges pain points visible across browser-agent forums: CAPTCHA, 2FA, session conflicts, CSP-protected sites, and lack of human correction.
- Feature claims are unusually concrete for a new MCP product, making it easy for developers to judge whether it fits their workflow.
- The local/no-telemetry story is well aligned with current suspicion of cloud browser vendors.

## Negative Signals

- The same differentiators are also attack surface: debugger, cookies, all URLs, provider token extraction, and CAPTCHA solving require unusually high user trust.
- The product leans on claims from its own comparison table; independent user-review evidence is still thin in the public search surface.
- CAPTCHA automation may conflict with site terms or internal compliance standards even when technically useful.

## Buggy Or Risky Areas

- Browser extension permission review and enterprise allowlisting.
- Misuse or accidental exposure of provider tokens.
- False confidence around CAPTCHA solving on adversarial or policy-sensitive sites.
- Debugger API behavior changes across Chrome releases.

## Sources

- `https://browsermcp.dev/`
