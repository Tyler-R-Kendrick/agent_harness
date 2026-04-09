# Memory Candidates: DNS-Level Ad Blocking

<!-- Each entry here is something non-obvious that future conversations should know.
     Format each as a memory candidate with enough context to be useful standalone.
     Mark entries as [PERSISTED] once saved to agent long-term memory. -->

## Insights

- **Brave's performance edge is primarily ad blocking**: Benchmark comparisons showing Brave outperforming Chrome on page loads are largely attributable to Brave's built-in ad/tracker blocking preventing resource-heavy scripts from loading, not fundamental engine differences. 3-6x on ad-heavy sites, ~21% average.

- **adblock-rust is MPL-2.0 and usable outside Brave**: The crate is designed as a standalone library, not Brave-specific. Waterfox (March 2026) is the first other browser to adopt it, choosing it explicitly over uBlock Origin due to MPL-2.0 vs GPLv3 licensing compatibility.

- **Chromium's content embedder API is the ad-blocking hook**: Vivaldi confirmed that Chromium exposes an internal API (the same one behind webRequest and declarativeNetRequest) that allows embedders to proxy network service requests through custom code. This is the intended mechanism for forks to add request interception — no need to modify the network service itself.

- **adblock-rust FlatBuffers overhaul (v1.85-1.86)**: The 2025-2026 overhaul migrated 100K+ filters to zero-copy FlatBuffers, cutting memory 75% (~45MB savings). Stack-allocated vectors, regex tokenization, and shared cross-engine resources were also added. This represents the current state of the art for in-browser filter matching.

- **DNS-level blocking is a complement, not a replacement**: Domain-level blocking (Pi-hole/AdGuard model) misses first-party ads, URL-path patterns, and cosmetic filtering. Hickory DNS (Rust, Apache/MIT, 100% in-process resolver) is the best candidate for an embedded DNS layer, but adblock-rust must be the primary blocking engine.

- **EasyList dual licensing**: EasyList is dual-licensed GPLv3 and CC BY-SA 3.0. For browser distribution, CC BY-SA 3.0 with attribution is the practical choice — avoids copyleft extending to browser code.
