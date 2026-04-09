---
adr: 002
title: Ad-Blocking Integration Architecture
status: Decided
created: 2026-04-04
updated: 2026-04-04
---

# ADR-002: Ad-Blocking Integration Architecture

> Status: **Decided** | Created: 2026-04-04

## Context

adblock-rust is chosen as the engine. Now: where and how do we integrate it into Chromium's architecture to intercept and evaluate network requests?

Three primary approaches exist:

1. **Content embedder API / URLLoaderFactory proxy** (network layer)
2. **DNS-only approach** (Hickory DNS sinkholing)
3. **Extension-based** (Manifest V3 declarativeNetRequest)

Each approach has different latency, rule compatibility, and maintenance characteristics. The choice determines whether we achieve Brave-level performance (3-6x improvement on ad-heavy sites).

## Decision Drivers

1. **Latency target**: <1ms per-request overhead to avoid user-perceivable slowdown
2. **Rule compatibility**: Must support full URL matching (not just domains); must handle first-party ads
3. **Performance measurement**: Must be benchmarkable against Brave on standard test cases
4. **Cross-request state**: Must distinguish third-party vs first-party; must support per-site allowlist
5. **Manifest V3 compliance**: Should not rely on deprecated WebRequest API

## Options Considered

### Option A: Content Embedder API / URLLoaderFactory Proxy (Recommended)

**Description**: Subclass Chromium's `net::NetworkDelegate` or implement URLLoaderFactory proxy. Intercept every request in the network service before it's sent; evaluate against adblock-rust; allow or cancel.

**Integration point**: `ContentBrowserClient::CreateNetworkDelegate()` or `URLLoaderFactory` proxy pattern. Vivaldi has demonstrated this approach; Brave's implementation is similar.

**Data flow**:
```
Blink URLLoaderFactory::CreateLoaderAndStart()
  ↓
AdBlockProxy::OnBeforeURLRequest() [our code]
  ├─→ Check PerSiteAllowlist
  ├─→ Call adblock-rust Engine::check_network_request()
  └─→ Return Allow or net::ERR_BLOCKED_BY_CLIENT
  ↓
Network stack (request sent or cancelled)
```

**Pros**:
- **Full URL context**: Can match URL paths, query strings, fragments (EasyList supports `||` domain anchors, path patterns, etc.)
- **First-party detection**: Can determine if request is same-origin; blocks first-party ads (Pi-hole cannot)
- **Sub-millisecond latency**: Network stack is already async; synchronous evaluation doesn't block
- **Manifest V3 future-proof**: Not dependent on deprecated WebRequest API; works with declarativeNetRequest
- **Third-party detection**: Can inspect `Sec-Fetch-Site` header to determine third-party status (adblock-rust parameter: `is_third_party`)
- **Cosmetic filtering ready**: Can queue CSS selectors for renderer to inject
- **Proven approach**: Vivaldi, Brave, Chromium extensions (webRequest) all use similar patterns

**Cons**:
- **Requires ContentBrowserClient subclass**: Fork-level integration; not portable to unmodified Chromium
- **Synchronous evaluation in network thread**: Latency budgets are tight; if adblock-rust takes >5ms on any request, network thread stalls
- **Third-party determination complex**: Must inspect headers (Sec-Fetch-Site) or frame ancestry; not 100% reliable
- **Security boundary**: Network thread processes untrusted URLs; must validate inputs to adblock-rust

**Implementation notes**:
- Chromium v121+ exposes `URLLoaderFactory` as proxyable interface (better than older `NetworkDelegate` pattern)
- Vivaldi's source is not fully public, but blog posts document the approach
- Brave's source is available (brave-core repo); can reference their `AdBlockService`

### Option B: DNS-Only (Domain Sinkholing)

**Description**: Integrate Hickory DNS resolver (Rust) that sinkhole known ad domains at DNS resolution time. Block domains before any HTTP request is made.

**Data flow**:
```
getaddrinfo("ads.doubleclick.net")
  ↓
Hickory DNS resolver [our code]
  ├─→ Check domain blocklist (derived from EasyList)
  └─→ Return NXDOMAIN or 127.0.0.1 (sinkhole)
  ↓
Blink receives resolution failure
  ├─→ If NXDOMAIN: request not sent (fast path)
  └─→ If 127.0.0.1: connection timeout (slower, but blocks)
```

**Pros**:
- **No network layer changes needed**: Can implement as system-level resolver override (less Chromium modification)
- **DoH/DoT privacy**: Can forward non-blocked queries to encrypted DNS provider (Cloudflare, Quad9)
- **Very fast for known domains**: 1-2µs hash lookup vs 100-1000ms network request
- **Operating system integration**: Can replace system DNS at OS level; affects all apps

**Cons**:
- **Cannot match URL paths**: EasyList rules like `||ads.example.com/path/to/ad.js` become domain-only; must convert to domain blocklist
- **Loses 90% of rules**: Typical EasyList has 120k rules; domain-only version has 10-15k rules (most ads are path-based)
- **Cannot detect first-party ads**: If example.com serves its own ads from example.com/ads/, DNS approach cannot distinguish
- **No cosmetic filtering**: Cannot hide ad placeholders with CSS
- **CNAME cloaking vulnerability**: Attacker aliases `ads.example.com` → `cdn.legit.com` → legitimate domain; DNS blocklist doesn't catch it
- **Performance insufficient**: Loses 80%+ of ad blocking effectiveness vs Brave; fails performance target (3-6x improvement)
- **Cannot implement per-site allowlist**: Must block domain globally or not at all; cannot allow ads only on trusted sites

**Real-world validation**: Pi-hole and AdGuard Home use this approach; they achieve 40-60% ad blocking effectiveness (vs Brave's 90%+ with full URL matching).

### Option C: Extension-Based (Manifest V3 declarativeNetRequest)

**Description**: Package adblock-rust via Manifest V3's declarativeNetRequest API. Browser loads the extension at startup and enables it by default.

**Data flow**:
```
Blink URLLoaderFactory::CreateLoaderAndStart()
  ↓
Manifest V3 declarativeNetRequest rules engine
  ├─→ Static rule matching (compiled at extension load time)
  └─→ Return Allow or net::ERR_BLOCKED_BY_RESPONSE
  ↓
Network stack (request sent or cancelled)
```

**Pros**:
- **Future-proof**: Manifest V3 is the standard; V2 WebRequest is deprecated
- **Sandboxed**: Extension code is isolated; less risk of breaking core browser
- **Easier updates**: Extension can be updated separately from browser binary

**Cons**:
- **Rule count limits**: Manifest V3 limits static rules to 30k per extension (EasyList is 120k); requires splitting into multiple extensions
- **Rule language limitations**: Manifest V3 uses proprietary rule format; conversion from EasyList (ABP format) is lossy
- **Dynamic rules complexity**: Can support ~5k dynamic rules, but at performance cost
- **Still post-request**: WebRequest → declarativeNetRequest; addon still operates after request leaves browser
- **Memory inefficiency**: Each extension instance loads rules separately; 3 extensions with 30k rules each = 3x memory overhead
- **UX confusion**: Users think it's an "extension" (can uninstall, disable); cannot truly remove if built-in
- **Latency overhead**: Extension sandbox adds ~3-5ms latency per request (vs <1ms native)

**Real-world validation**: uBlock Origin's V3 "Lite" version achieves only 60% effectiveness vs Classic (pre-V3) due to rule limits.

## Decision

**Recommended: Option A (Content Embedder API / URLLoaderFactory Proxy)**

### Rationale

1. **Performance target achievable**: Full URL matching enables 3-6x improvement on ad-heavy sites (matching Brave baseline). DNS-only and extension approaches fall short.

2. **Rule compatibility**: EasyList has 120k rules; 90% are path-based. Option A supports all rules; DNS supports ~10% (only domains); extensions with V3 limits support ~25%.

3. **First-party ad blocking**: Many ad networks serve ads from first-party domains. Only Option A can distinguish and block these.

4. **Cosmetic filtering ready**: Option A architecture queues CSS selectors for renderer; enables Phase 1b feature without redesign.

5. **Per-site allowlist**: Can implement granular user exceptions (temporary, permanent, pattern-based). DNS and extension approaches are all-or-nothing.

6. **Proven at scale**: Brave, Vivaldi, and Chromium's own webRequest implementation all use URLLoaderFactory proxy pattern. Cromite (Bromite successor) reports similar approach.

### Hybrid Approach (Phase 1 + Phase 2)

- **Phase 1 (MVP)**: Option A (ContentBrowserClient URLLoaderFactory proxy)
- **Phase 2 (Enhancement)**: Add Option B (Hickory DNS) as **optimization layer**, not replacement
  - Fast-path domain blocking (1-2µs lookup) for known ad domains
  - DoH/DoT for privacy (encrypted DNS for non-blocked queries)
  - Still falls back to Option A (URLLoaderFactory) for path-based rules and first-party ads

## Consequences

### Good
- Achieves performance targets (3-6x on ad-heavy, ~21% average)
- Comprehensive rule matching (EasyList 120k rules fully supported)
- User control via per-site allowlist
- Cosmetic filtering ready for Phase 1b
- Clear upgrade path to Hickory DNS (Phase 2) without redesign

### Bad
- Requires fork-level ContentBrowserClient modifications (ongoing maintenance cost)
- Synchronous evaluation in network thread (latency budgets are tight; must profile carefully)
- Third-party detection requires header inspection (not 100% reliable; frame ancestry is complex)
- Larger engineering effort than DNS-only approach (6-8 weeks vs 2-3 weeks)

### Neutral
- No impact on extension ecosystem (built-in ad blocking complements, not replaces, third-party ad blockers)
- Manifest V3 compatibility achieved through native implementation (not via extension)
