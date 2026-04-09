# DNS-Level Ad Blocking for Browser Performance

## Status
Active

## Question
Can a custom Chromium-based browser achieve Brave-level page load performance by integrating DNS-level ad blocking (or equivalent pre-request filtering), and what are the best open-source approaches to implement this?

## Context
Benchmarks show Brave consistently outperforming Chrome on page load times, largely because Brave's built-in ad/tracker blocking prevents resource-heavy ad scripts from loading in the first place. Chrome lacks native ad blocking — it relies on extensions (which operate post-request or at best at the webRequest API level) and has been further constrained by Manifest V3's shift to declarativeNetRequest.

For this custom browser project, integrating ad blocking at the network layer (DNS sinkholing, filter-list-based request blocking, or a hybrid) could be a high-impact performance optimization that Chrome can't easily replicate due to its business model.

### Related Research
- `../build-guide/` — Chromium build and fork strategies (existing)

## Key Findings

- **Performance gap is real and significant**: Brave loads pages 3-6x faster on ad-heavy sites and ~21% faster overall. The gap is entirely from blocking ad/tracker requests — both browsers use the same V8/Blink engine. This is the single highest-impact performance optimization available.

- **adblock-rust is the clear primary solution**: Brave's open-source Rust ad-blocking engine (MPL-2.0 licensed) is battle-tested at scale (90M+ Brave users). Waterfox announced adoption in March 2026, validating it as a viable integration for other forks. Recent FlatBuffers overhaul cut memory 75% to ~15MB with sub-millisecond per-request matching.

- **Chromium's content embedder API is the integration point**: Vivaldi demonstrated that Chromium exposes a proxy layer at the network service where embedders can intercept, examine, and block requests — the same internal API behind webRequest and declarativeNetRequest. No deep network stack modifications needed.

- **DNS-level blocking alone is insufficient**: Domain-level blocking (Pi-hole/AdGuard model) can't handle first-party ads, URL-path matching, or cosmetic filtering. However, an embedded Rust DNS resolver (Hickory DNS) adds value as a complement: privacy via DoH/DoT, local DNS caching, and fast-path domain blocking.

- **Filter list ecosystem is accessible**: EasyList (dual-licensed GPLv3 / CC BY-SA 3.0) and community lists are freely available. adblock-rust parses ABP syntax, uBlock Origin extended syntax, and partial AdGuard syntax.

- **Licensing is clean**: adblock-rust (MPL-2.0) + EasyList (CC BY-SA 3.0) is a commercially viable combination. This is explicitly why Waterfox chose adblock-rust over uBlock Origin (GPLv3).

## Conclusion
<!-- To be filled when status is Complete -->
