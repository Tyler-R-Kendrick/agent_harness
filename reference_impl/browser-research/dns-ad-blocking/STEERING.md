# Steering: DNS-Level Ad Blocking

## Current Priority
Move to implementation planning. The research strongly supports integrating `adblock-rust` via Chromium's content embedder API as Phase 1. The next step is prototyping the integration: setting up a minimal Chromium build with a content embedder hook that calls into adblock-rust's `Engine::check_network_request()`.

## Open Questions
1. What is the exact ContentBrowserClient method signature for intercepting network requests in the current Chromium version? (Need to inspect Chromium source — Vivaldi's approach is documented but their fork is not fully open)
2. How does Brave wire adblock-rust into its Chromium fork at the build system level? (GN build files, Rust FFI bridge)
3. What's the cold-start time for loading filter lists into the adblock-rust engine? (Impacts browser launch time)
4. Should filter list updates be handled by a background service worker or a dedicated native thread?
5. How should the user-facing toggle (per-site ad blocking on/off) be implemented in the UI?

## Decided
- **Primary engine**: `adblock-rust` (not uBlock Origin, not DNS-only, not extension-based)
- **Integration point**: Chromium content embedder API / URLLoaderFactory proxy layer
- **Licensing strategy**: adblock-rust (MPL-2.0) + EasyList (CC BY-SA 3.0 with attribution)
- **DNS complement**: Hickory DNS for embedded DoH/DoT resolver + domain-level fast-path blocking (Phase 2, not Phase 1)
- **DNS-only blocking is insufficient**: Must have full URL matching + cosmetic filtering to be competitive with Brave

## Constraints
- Must work cross-platform (Windows, macOS, Linux at minimum)
- Should not require elevated/root permissions
- Must be open-source compatible
- Rust in Chromium builds is supported (Chromium has Rust toolchain integration)

## Suggested Approach
1. **Phase 1 prototype**: Minimal Chromium build → add ContentBrowserClient network hook → call adblock-rust engine → measure page load improvement on top-100 sites
2. **Phase 2**: Integrate Hickory DNS as in-process resolver with DoH/DoT and domain blocklist
3. **Phase 3**: Benchmarking suite, per-site toggle UI, filter list update mechanism

Reference Brave's source (brave-core repo) and Vivaldi's blog posts for implementation patterns.
