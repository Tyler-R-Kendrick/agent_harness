---
feature: dns-ad-blocking
status: architecture
created: 2026-04-04
updated: 2026-04-04
---

# DNS-Level Ad Blocking

## Problem Statement

Users loading ad-heavy websites experience 3-6x slower page loads and wasted bandwidth compared to privacy-focused browsers. The custom Chromium browser currently has no built-in ad blocking — users must either tolerate ads and trackers or install third-party extensions, which are constrained by Manifest V3's limitation to declarativeNetRequest and operate post-request (already too late for large ad/tracker payloads).

This creates a performance gap against competitors like Brave (which blocks ads before network requests are made) and leaves users vulnerable to tracker fingerprinting and surveillance.

## Proposed Solution

Integrate **adblock-rust** — Brave's battle-tested, open-source Rust ad-blocking engine — directly into the browser's network layer via Chromium's ContentBrowserClient API. This approach intercepts and evaluates every network request against filter lists (EasyList + community sources) before it loads, achieving 3-6x faster page loads on ad-heavy sites and ~21% average improvement across all sites.

The feature operates in three phases:

1. **Phase 1 (MVP)**: adblock-rust integration + EasyList filter lists + basic enable/disable toggle
2. **Phase 2**: Hickory DNS resolver for DoH/DoT privacy + domain-level fast-path blocking
3. **Phase 3**: Benchmarking dashboard, per-site allowlist UI, automated filter list updates

## Core Concept

Ad blocking in a modern browser can operate at three levels:

| Level | Mechanism | Use Case | Trade-offs |
|-------|-----------|----------|-----------|
| **DNS-only** | Domain sinkholing (e.g., Pi-hole) | Block known ad domains network-wide | Cannot handle path-based blocking; misses first-party ads; limited cosmetic filtering |
| **Extension-based** | WebRequest API (deprecated) or declarativeNetRequest (V3) | Manifest V3 compatible but post-request evaluation | Sub-millisecond latency cost; Manifest V3 limits rule count; cannot reliably block before load |
| **Network layer (native)** | ContentBrowserClient URLLoaderFactory proxy | Intercept before request leaves browser; per-request sub-millisecond matching | Requires fork-level integration; significant engineering effort but maximum compatibility with all request types |
| **Hybrid (recommended)** | Network layer + embedded DNS | Fast-path domain blocking + full URL matching + cosmetic filtering | Combines DNS caching/privacy + efficient blocking; adds Rust FFI complexity |

This feature implements the **Hybrid** approach: Phase 1 uses network-layer interception (Level 3), Phase 2 adds Hickory DNS (Level 1) as an optimization.

## Key Abstractions

**AdblockEngine**: The in-process Rust instance that wraps adblock-rust's `Engine`. Loads filter lists at startup, caches compiled rules in FlatBuffers, and exposes `check_network_request(url, request_type)` → `BlockDecision`.

**BlockDecision**: Enum representing the evaluation outcome: `Allow` (request proceeds), `Block` (request cancelled), `Block + HideCss` (request cancelled + CSS rule injection to hide placeholder). Returned per-request with microsecond latency.

**FilterList**: A curated collection of blocking rules in Adblock Plus (ABP) format. The default list is EasyList (dual-licensed GPLv3 / CC BY-SA 3.0). Community lists (AdGuard, EasyPrivacy, uBlock defaults) can be added as subscriptions.

**PerSiteAllowlist**: User-configurable set of domains or URL patterns exempt from ad blocking. Stored in browser prefs, evaluated before the main adblock-rust engine.

**URLLoaderFactory Proxy**: The integration point in Chromium's network service where requests are intercepted, evaluated, and either allowed to proceed or cancelled. Chromium's content embedder API exposes this as `ContentBrowserClient::CreateNetworkDelegateForAPIHandler()` or related hooks.

## Relationship to Existing Architecture

- **Extends**: Chromium's content embedder API layer (used by Vivaldi, Brave, others)
- **Depends on**: Chromium's URLLoaderFactory proxy pattern; ContentBrowserClient customization; Rust FFI bridge into Chromium's C++ network stack
- **Complements**: DNS layer (Phase 2 integration with Hickory)
- **Does NOT replace**: Extension system; web request debugging tools; per-origin policies (Content-Security-Policy remains user's responsibility)

## Success Criteria

1. **Performance**: Average page load time improves by ~21% across Alexa top-100 sites (matching Brave baseline); 3-6x improvement on ad-heavy sites (>50% ad content by byte weight)
2. **Compatibility**: Zero false positives on top-500 websites; allowlist UX allows one-click per-site override
3. **Memory**: AdblockEngine + filter lists consume ≤25MB resident memory at runtime (adblock-rust + FlatBuffers baseline is ~15MB)
4. **Latency**: Per-request evaluation adds <1ms latency (sub-millisecond matching from compiled FlatBuffers)
5. **Licensing**: All dependencies (adblock-rust MPL-2.0, EasyList CC BY-SA 3.0) are commercially viable; proper attribution displayed in browser settings

## Document Index

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Technical architecture, component design, data flow, integration points
- **[CAPABILITIES.md](./CAPABILITIES.md)** — Feature comparison against Brave, Chrome, uBlock Origin, Pi-hole, Firefox, Ungoogled-Chromium, Cromite, Safari
- **[ADR-001](./decisions/ADR-001-engine-selection.md)** — Why adblock-rust over uBlock Origin or custom engine
- **[ADR-002](./decisions/ADR-002-integration-approach.md)** — Why ContentBrowserClient API vs DNS-only vs extension-based
- **[ADR-003](./decisions/ADR-003-filter-list-strategy.md)** — Filter list curation (EasyList baseline + community + custom)
- **[ADR-004](./decisions/ADR-004-per-site-bypass.md)** — Per-site allowlist UX and persistence model
