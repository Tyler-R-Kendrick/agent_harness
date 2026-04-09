---
adr: 001
title: Ad-Blocking Engine Selection
status: Decided
created: 2026-04-04
updated: 2026-04-04
---

# ADR-001: Ad-Blocking Engine Selection

> Status: **Decided** | Created: 2026-04-04

## Context

A custom Chromium-based browser fork needs native ad blocking to achieve the same performance improvements (3-6x faster on ad-heavy sites) that Brave demonstrates. Three main options exist:

1. **adblock-rust** (Brave's open-source engine, MPL-2.0)
2. **uBlock Origin** (comprehensive extension-based blocking, GPLv3)
3. **Custom in-house engine** (proprietary, full control)

The choice determines:
- Performance characteristics (latency, memory)
- Licensing and commercial viability
- Maintenance burden (updates, bug fixes, community support)
- Feature parity with competitors (EasyList vs custom rulesets)
- Integration complexity with Chromium's network stack

## Decision Drivers

1. **Performance at scale**: Engine must handle 120k+ filter rules with <1ms per-request latency
2. **Licensing commercial viability**: MPL-2.0 and CC BY-SA 3.0 acceptable; GPLv3 not compatible with fork's business model
3. **Battle-tested reliability**: Should have real-world validation (90M+ users) before integration
4. **Maintenance sustainability**: Should not require ongoing ad-hoc patching; prefer upstream ecosystem
5. **Rule language compatibility**: Must support EasyList (ABP format) and ideally AdGuard syntax for filter list ecosystem

## Options Considered

### Option A: adblock-rust (Brave's Engine)

**Description**: Integrate Brave's open-source adblock-rust crate (MPL-2.0) via Rust FFI bridge into Chromium's URLLoaderFactory.

**Pros**:
- Battle-tested at scale (90M+ Brave users since 2018)
- FlatBuffers overhaul (2024) reduces memory to 15MB with <1ms per-request matching
- MPL-2.0 is commercially compatible (weak copyleft)
- Active maintenance by Brave devs; recent adoption by Waterfox (March 2026) signals broad applicability
- Parses ABP (EasyList), AdGuard, and uBO extended syntax
- Sub-millisecond per-request evaluation (O(1) string matching for most rules)
- Relatively small codebase (~5k LoC Rust) easy to audit and integrate

**Cons**:
- Dependency on Brave ecosystem for updates (not owned by our project)
- Rust FFI adds build complexity (GN integration, Rust toolchain)
- Learning curve for Chromium C++ developers unfamiliar with FFI bridges
- If Brave abandons the project, we inherit maintenance

**Competitive context**: Waterfox (another Chromium fork) announced adoption of adblock-rust in March 2026, indicating strong validation.

### Option B: uBlock Origin (Extension-Based)

**Description**: Package uBlock Origin as a built-in extension, distributed with the browser and not removable by default.

**Pros**:
- Already comprehensive ad-blocking engine (20+ years of development)
- Massive community (5M+ users, active development)
- Supports ABP, uBO extended syntax, AdGuard syntax
- Can hook into Manifest V3 declarativeNetRequest API
- Well-documented codebase

**Cons**:
- **GPLv3 licensed**: Incompatible with any commercial browser distribution; licensing conflict if browser is proprietary or dual-licensed
- Post-request evaluation (WebRequest deprecated; V3 uses declarativeNetRequest): requires ad to load before decision
- Manifest V3 limits: 30k static rules per extension (EasyList is 120k rules; requires filtering)
- 5-10ms per-request latency (extension overhead); worse than native implementation
- ~25MB memory footprint (vs adblock-rust's 15MB)
- Cannot integrate into network layer (extension sandbox limits access to URLLoaderFactory)
- Requires distributing extension binaries; harder to update than built-in engine

**Why licensing fails**: Our browser may be distributed commercially or under dual-license. GPLv3's copyleft clause requires all derivative works to be open-source. If we integrate uBlock Origin, the entire browser becomes GPLv3 (not compatible with custom closed/commercial components).

### Option C: Custom In-House Engine

**Description**: Build a proprietary ad-blocking engine from scratch.

**Pros**:
- Full control over features and implementation
- Can optimize specifically for our architecture
- No external dependencies or licensing constraints

**Cons**:
- **Massive engineering effort**: adblock-rust took Brave 3+ years to build and optimize
- Unproven at scale: no validation on millions of users
- Maintenance burden: filter list parsing, rule compilation, bug fixes (team responsibility)
- Rule language complexity: ABP format has 20+ features; easy to implement 80%, hard to get last 20% right (regex, domain exceptions, etc.)
- Performance risk: custom matching algorithm may not achieve <1ms latency at 120k rule scale
- No community ecosystem: custom rule syntax has zero adoption
- Opportunity cost: engineering resources diverted from agentic browser features (core differentiation)

## Decision

**Recommended: Option A (adblock-rust)**

### Rationale

1. **Performance proven at scale**: Brave's 90M users provide real-world validation that adblock-rust achieves 3-6x performance improvement on ad-heavy sites with <1ms latency. FlatBuffers overhaul (2024) demonstrates active optimization.

2. **Licensing compatibility**: MPL-2.0 (weak copyleft) is commercially viable for distribution. Waterfox's March 2026 adoption confirms this approach is mainstream for Chromium forks.

3. **Maintenance sustainability**: Brave's ongoing investment in adblock-rust reduces risk. Waterfox adoption creates a secondary ecosystem; if Brave drops support, community can maintain it.

4. **Rule language ecosystem**: EasyList + AdGuard + uBO syntax support means users can import existing filter lists without friction.

5. **Opportunity cost alignment**: Integrating battle-tested engine focuses engineering on our unique differentiator (agentic browser features, isolated profiles, workspace memory) rather than reimplementing ad-blocking from first principles.

### Implementation Approach

1. Add adblock-rust crate to `//third_party/rust/adblock` (via DEPS)
2. Create Rust FFI wrapper: `//brave/components/adblock_rust_ffi/`
3. Integrate URLLoaderFactory proxy into `//chrome/browser/net/adblock_proxy.cc`
4. Wire PerSiteAllowlist + filter list updates into browser prefs
5. Benchmark on Alexa top-100; validate <1ms latency and 3-6x speedup on ad-heavy sites

## Consequences

### Good
- Accelerated feature delivery: 6-8 weeks to MVP (Phase 1) vs 6-12 months for custom engine
- Community credibility: using the same engine as Brave and Waterfox signals quality
- Future-proof: adblock-rust updates are free (just update crate version)
- Risk distribution: Brave + Waterfox ecosystem shoulders maintenance burden

### Bad
- Rust FFI complexity: requires Rust expertise on team; build system integration takes time
- External dependency: breaking changes in adblock-rust could require fork-level patches (unlikely but possible)
- Less control: cannot easily customize matching logic for agentic use cases (e.g., agent-specific filtering rules)

### Neutral
- Crate size: adblock-rust + FlatBuffers adds ~5-15MB to browser binary (acceptable tradeoff for performance)
- Documentation: fewer examples online than for uBlock Origin; community knowledge is smaller
