# Comparison of Ad-Blocking Approaches for a Chromium Fork

## Approaches Evaluated

| Approach | Implementation | Blocking Granularity | Cosmetic Filtering | Licensing | Maturity |
|----------|---------------|---------------------|-------------------|-----------|----------|
| **adblock-rust (native)** | Rust library, in-process | Full URL + params | Yes | MPL-2.0 | Production (Brave, Waterfox) |
| **Embedded DNS sinkhole** | Hickory DNS + blocklist | Domain-level only | No | Apache-2.0/MIT | Library mature, not proven in browsers |
| **Extension-based (uBO)** | JS extension via MV3 API | Full URL + params | Yes | GPLv3 | Production, but MV3-constrained |
| **External DNS (AdGuard DNS)** | DNS server change | Domain-level only | No | N/A (service) | Production, but external dependency |
| **Hybrid: adblock-rust + Hickory DNS** | Both integrated | Full URL + DNS-level | Yes | MPL-2.0 + Apache/MIT | Novel combination |

## Recommendation: adblock-rust as Primary, Hickory DNS as Complement

### Why adblock-rust is the clear primary choice

1. **Battle-tested**: Powers ad blocking in Brave (90M+ users) and will power Waterfox. This isn't experimental.

2. **Performance proven**: Sub-millisecond per-request decision time. The recent FlatBuffers overhaul reduced memory to ~15 MB with zero-copy deserialization. This is as optimized as ad blocking gets.

3. **Full-spectrum blocking**: URL-level matching + cosmetic filtering covers the cases that DNS blocking cannot (first-party ads, path-specific rules, element hiding).

4. **Clean licensing**: MPL-2.0 means modifications to the adblock-rust files themselves must be shared, but the license doesn't extend to the browser's own code. Waterfox chose this explicitly over uBlock Origin's GPLv3 for this reason.

5. **Chromium integration path exists**: Vivaldi demonstrated that Chromium's content embedder API provides a clean hook point for native ad blocking. The embedder proxy intercepts requests at the network service layer — the same internal API that webRequest and declarativeNetRequest use. No deep network stack modifications required.

6. **Filter list ecosystem**: Compatible with EasyList (CC BY-SA 3.0), AdGuard lists, and uBlock Origin resource formats. The entire existing filter list ecosystem is available.

### Why add Hickory DNS as a complement

An embedded Rust DNS resolver adds value beyond ad blocking:

1. **Privacy layer**: Native DNS-over-HTTPS (DoH) and DNS-over-TLS (DoT) without relying on OS-level configuration or Chrome's built-in DoH (which is tied to Google's implementation choices)

2. **DNS caching**: Local, in-process DNS cache reduces repeated lookups. Every navigation to a previously-resolved domain becomes faster.

3. **First-pass domain blocking**: Before adblock-rust even sees the request, the DNS resolver can return null for known ad domains. This is marginally faster for the obvious cases (pure domain-level blocking is a simpler operation than full URL matching).

4. **Independence from OS resolver**: The browser controls its own DNS resolution, making behavior consistent across platforms and network configurations.

5. **Future extensibility**: An embedded DNS resolver opens the door for features like DNS-based parental controls, malware domain blocking, and custom DNS routing rules.

### What DNS-level blocking alone can't do

DNS blocking is necessary but insufficient:

- **Can't block first-party ads**: If `example.com` serves ads from `example.com/ads/banner.js`, DNS blocking sees the same domain as the main content. Only URL-path matching catches this.
- **Can't do cosmetic filtering**: Even if an ad is blocked, the placeholder element (empty iframe, reserved space) remains visible. Cosmetic filters hide these elements with CSS injection.
- **Can't handle anti-adblock scripts**: Many sites detect ad blockers and show nag screens. Scriptlet injection (supported by adblock-rust via UBO resource format) can neutralize these scripts.

## Proposed Architecture

```
┌─────────────────────────────────────────────┐
│              Browser Process                 │
│                                              │
│  ┌──────────────┐    ┌───────────────────┐  │
│  │ Hickory DNS   │    │  adblock-rust     │  │
│  │ Resolver      │    │  Engine           │  │
│  │               │    │                   │  │
│  │ • DoH/DoT     │    │ • URL matching    │  │
│  │ • Local cache  │    │ • Cosmetic filter │  │
│  │ • Domain block │    │ • Scriptlet inj.  │  │
│  └──────┬───────┘    └────────┬──────────┘  │
│         │                     │              │
│         │    ┌────────────────┘              │
│         │    │                               │
│  ┌──────▼────▼──────────────────────────┐   │
│  │  Content Embedder API / Network Hook  │   │
│  │  (URLLoaderFactory proxy layer)       │   │
│  └──────────────┬───────────────────────┘   │
│                 │                            │
│  ┌──────────────▼───────────────────────┐   │
│  │  Chromium Network Service             │   │
│  │  (unmodified)                         │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Request Flow

1. Renderer initiates a URL request
2. Request hits the content embedder proxy
3. **DNS check** (Hickory DNS): Is this domain on the blocklist? If yes → block immediately
4. **URL check** (adblock-rust): Does this URL match any network filter? If yes → block/redirect
5. If allowed → proceed to Chromium's network service normally
6. **Post-navigation** (adblock-rust): Query cosmetic resources for the page, inject CSS/JS into renderer

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| adblock-rust API stability | Low | Actively maintained by Brave; crate follows semver |
| Filter list updates | Low | Standard mechanism: periodic HTTP fetch of list URLs |
| Site breakage from over-blocking | Medium | Exception rules in filter lists; user-facing toggle per site |
| Anti-adblock escalation | Medium | Scriptlet injection support; community-maintained counter-lists |
| Build complexity (Rust in Chromium) | Medium | Chromium already supports Rust; Brave demonstrates this works at scale |
| Hickory DNS integration complexity | Medium | Well-documented Rust library; can be added incrementally after adblock-rust |

## Implementation Priority

**Phase 1**: Integrate adblock-rust via content embedder API. This alone gets 90%+ of Brave's performance advantage.

**Phase 2**: Add Hickory DNS as the browser's DNS resolver with DoH/DoT and domain-level blocklist. This adds privacy, caching, and a fast-path for domain blocking.

**Phase 3**: Tune and optimize. Profile the request path, measure real-world page load improvements, build a benchmarking suite against top-1000 sites.
