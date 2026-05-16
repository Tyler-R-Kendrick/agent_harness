# MultiOn Gossip

## Positive Signals

- Older Reddit discussion singled out MultiOn as one of the few products aligned with the promise of "give it instructions and watch it go."
- More recent competitor discussions still mention MultiOn alongside Skyvern and other browser-agent products, suggesting category awareness remains.
- Public docs make reliability tradeoffs visible instead of hiding them entirely.

## Negative Signals

- Browser-agent threads repeatedly argue that real workflows break on session expiry, modal popups, layout changes, CAPTCHA, and missing stable APIs.
- Some builders say a bad API is still easier to maintain than a browser agent, which challenges MultiOn's core abstraction for many business workflows.
- Local extension mode creates another moving part: extension permissions, browser version, profile state, and user machine availability.

## Product Risks To Watch

- If automatic browsing is too opaque, developers will demand lower-level observability.
- If stepwise control is too hands-on, customers may conclude they are rebuilding their own agent runtime around MultiOn.
- Proxy support helps with bot defenses, but buyers may still hit policy and compliance issues when automating third-party sites.
