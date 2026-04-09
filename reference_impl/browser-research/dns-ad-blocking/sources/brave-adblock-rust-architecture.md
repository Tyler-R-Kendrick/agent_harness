# Brave's adblock-rust Engine Architecture

## Overview

`adblock-rust` is Brave's open-source, Rust-based ad and tracker blocking engine. It ships as a standalone crate (`adblock` on crates.io) and can be integrated into any application — it is not Brave-specific. Licensed under **MPL-2.0**, which makes it commercially friendly and compatible with most browser forks.

**Repository**: https://github.com/brave/adblock-rust
**Crate**: https://crates.io/crates/adblock

## Core Architecture

### Engine Struct

The primary interface is the `Engine` struct, which provides three main methods:

- `check_network_request` — determines whether a network request should be blocked, redirected, or allowed based on loaded filter rules
- `url_cosmetic_resources` — determines page-level cosmetic actions (element hiding, style injection) for a given URL
- `hidden_class_id_selectors` — determines additional elements to hide dynamically based on class/ID selectors observed in the DOM

### Filter Processing Pipeline

1. **Parsing**: Filters in ABP (Adblock Plus) syntax are parsed into structured filter objects. The engine supports both network filters (URL matching) and cosmetic filters (CSS selectors for hiding elements).

2. **Compilation**: Parsed filters are compiled into an optimized internal representation using FlatBuffers — a zero-copy serialization format that allows the engine to operate directly on serialized data without deserializing into heap-allocated Rust objects.

3. **Matching**: At request time, the engine tokenizes the request URL and uses the token index to narrow down candidate filters, then performs full pattern matching only on candidates. Sub-millisecond decision time per request.

### FlatBuffers Overhaul (2025-2026)

Brave overhauled the engine in v1.85-1.86 to migrate ~100,000 default filters from standard Rust heap structures into a FlatBuffers-based zero-copy format:

- **Memory reduction**: 75% decrease (~45 MB savings per browser instance across all platforms)
- **Data structures**: `FlatMapView`, `FlatMultiMapView`, `HashMapStringView`, `HashSetView` replace standard HashMap/HashSet
- **Stack allocation**: Hot-path vectors use stack-allocated buffers to eliminate heap allocation overhead during filter matching
- **Regex optimization**: Common regex patterns are tokenized and pre-compiled for faster matching
- **Shared resources**: Multiple adblock engine instances (e.g., per-profile or per-component) share underlying filter data where possible

### Filter List Compatibility

The engine parses and matches filters in:
- **ABP syntax** (Adblock Plus format) — the de facto standard
- **uBlock Origin extended syntax** — partial support for UBO-specific filters
- **AdGuard syntax** — partial support

It can also parse resource files directly from uBlock Origin's repository format.

## Browser Integration Model

Unlike extension-based ad blockers that operate through the webRequest or declarativeNetRequest APIs, `adblock-rust` runs **inside the browser's main process**:

- No IPC overhead between extension sandbox and browser process
- Filter matching happens synchronously in the network request path, before DNS resolution or connection setup
- Cosmetic filtering can be applied earlier in the page lifecycle
- No Manifest V3 limitations — the engine has full access to request metadata

### Integration Surface

For a Chromium fork, integration involves:

1. **Network layer hook**: Intercept URL requests at the `URLLoaderFactory` or equivalent network service proxy layer. Before the request proceeds, call `engine.check_network_request()` with the request URL, source URL, and resource type.

2. **Cosmetic filtering**: After page navigation, query `engine.url_cosmetic_resources()` and inject the returned CSS/JS into the page's renderer process.

3. **Dynamic hiding**: As the DOM mutates, call `engine.hidden_class_id_selectors()` with newly observed class names and IDs to get additional selectors to inject.

### Waterfox Precedent

Waterfox announced in March 2026 that it will integrate `adblock-rust` as its native content blocker:
- Chosen over uBlock Origin partly due to **licensing** (MPL-2.0 vs GPLv3 — MPL is more compatible with browser distribution)
- Runs in-process, same model as Brave
- Coexists with extension-based ad blockers if users have them installed
- Waterfox plans to allow search-partner text ads by default as a revenue model

This is a strong precedent for using `adblock-rust` in a Chromium-family fork.

## Performance Characteristics

- **Decision time**: Sub-millisecond per request (all ad blockers except DuckDuckGo achieve this)
- **Memory footprint**: ~15 MB after FlatBuffers overhaul (down from ~60 MB)
- **CPU usage**: Lower than JS-based extensions during page loads due to compiled Rust + zero-copy data access
- **Startup time**: FlatBuffers format allows near-instant deserialization (memory-mapped, no parsing phase)

## Sources

- https://brave.com/privacy-updates/36-adblock-memory-reduction/
- https://brave.com/blog/improved-ad-blocker-performance/
- https://docs.rs/adblock/latest/adblock/
- https://crates.io/crates/adblock
- https://github.com/brave/adblock-rust
- https://cyberinsider.com/waterfox-browser-to-add-braves-adblock-engine-allow-search-ads-for-revenue/
