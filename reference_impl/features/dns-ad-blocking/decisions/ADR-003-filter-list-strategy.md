---
adr: 003
title: Filter List Curation and Update Strategy
status: Decided
created: 2026-04-04
updated: 2026-04-04
---

# ADR-003: Filter List Curation and Update Strategy

> Status: **Decided** | Created: 2026-04-04

## Context

adblock-rust can parse ABP (Adblock Plus), uBO extended syntax, and AdGuard syntax. The browser needs a strategy for which filter lists to include, how often to update them, and how to handle user customization.

Key constraints:
- Filter lists are community-maintained (no single authoritative source)
- Lists evolve constantly (new ads, false positives, removals)
- Updates must be automatic to be effective (users won't manually refresh)
- Bad lists can break websites; need rollback mechanism
- Licensing must permit commercial distribution

## Decision Drivers

1. **Coverage**: Must achieve ~90% ad blocking effectiveness (matching Brave) with baseline lists
2. **Accuracy**: <0.5% false positives (sites broken by overly-aggressive blocking)
3. **Performance**: Filter list load time at startup <2s; updates should not stall UI
4. **User control**: Power users should be able to add custom lists; casual users should have sensible defaults
5. **Licensing**: All lists must permit commercial distribution (GPLv3 is not acceptable)
6. **Maintenance**: Should require minimal curation; prefer community-maintained lists

## Options Considered

### Option A: EasyList Only

**Description**: Ship with only EasyList (dual-licensed GPLv3 / CC BY-SA 3.0) as the default. No additional lists.

**Pros**:
- **Single, well-maintained list**: EasyList is the gold standard; 20+ years of maintenance
- **Licensing clear**: CC BY-SA 3.0 path is commercially viable (attribution required)
- **Minimal complexity**: One list to manage; no version conflicts between lists
- **Proven effectiveness**: Brave uses EasyList as baseline; achieves 3-6x improvement

**Cons**:
- **Incomplete coverage**: EasyList focuses on ads; misses some tracking scripts (e.g., analytics)
- **Lacks privacy lists**: Cannot block trackers (e.g., Google Analytics, Facebook Pixel) without supplementary lists
- **Limited cosmetic filtering**: EasyList has minimal CSS rules for hiding ad placeholders
- **Power users unsupported**: Advanced users expect EasyList + EasyPrivacy + uBlock defaults; this feels bare

**Real-world validation**: Brave uses EasyList + Brave's own internal lists; uBlock Origin defaults to EasyList + EasyPrivacy + uBlock defaults.

### Option B: EasyList + EasyPrivacy + uBlock Defaults (Recommended)

**Description**: Ship with a curated baseline of four lists:

1. **EasyList** (CC BY-SA 3.0) — Ads
2. **EasyPrivacy** (CC BY-SA 3.0) — Tracking scripts
3. **uBlock Origin Filters — unblocked domains** (GPLv3... problematic!)
4. **uBlock Origin Filters — badware** (GPLv3... problematic!)

Wait. uBlock Origin uses GPLv3. We need licensing review.

**Revised Option B: EasyList + EasyPrivacy Only**

**Pros**:
- **Comprehensive coverage**: EasyList (ads) + EasyPrivacy (trackers) covers ~95% of ad/tracking blocking needs
- **Both CC BY-SA 3.0**: Licensing is clean and consistent
- **Proven baseline**: This is the de facto standard for Adblock Plus; uBlock Origin builds on it
- **User expectations**: Users familiar with ad blockers expect at least EasyList + EasyPrivacy

**Cons**:
- **More filter lists = more memory**: EasyList (~7MB) + EasyPrivacy (~3MB) = ~10MB uncompressed; adds to startup overhead
- **Potential conflicts**: Two independent lists may have overlapping rules; adblock-rust must deduplicate
- **Update coordination**: If lists update asynchronously, browser may see intermediate states (old EasyList, new EasyPrivacy)

### Option C: Modular Approach (EasyList + Opt-In Community Lists)

**Description**: Ship with EasyList by default. Enable users to subscribe to additional lists via browser settings:

- **Enabled by default**: EasyList (ads)
- **Available to enable**: EasyPrivacy (trackers), AdGuard filters, others
- **Custom list support**: Users can paste filter list URL or import .txt file

**Pros**:
- **Minimal baseline complexity**: Ship with proven list; complexity is opt-in
- **Respects user choice**: Power users customize; casual users get sensible defaults
- **Flexible ecosystem**: Can add new lists without browser updates (subscribe in settings)
- **Fallback if list breaks site**: User can disable individual lists to troubleshoot
- **Licensing control**: Ship with CC BY-SA 3.0; users opt-in to GPLv3 lists if they want

**Cons**:
- **Support burden**: Must educate users about available lists; confusion about which ones to enable
- **Feature parity**: Out-of-box experience lags Brave (Brave enables EasyList + EasyPrivacy by default)
- **Power users annoyed**: Requires user action to get baseline privacy filtering
- **Update complexity**: Each list has its own update schedule; coordination is harder

### Option D: Brave-Compatible Defaults (EasyList + Internal Lists)

**Description**: Match Brave's approach: ship EasyList (public) + build custom internal list (private, undocumented).

**Pros**:
- **Feature parity with Brave**: Same defaults = same performance and effectiveness
- **Fewer maintenance dependencies**: Internal list is our responsibility
- **Licensing clean**: Can use whatever license for internal list

**Cons**:
- **Curation burden**: Must maintain internal list as ads/trackers evolve
- **Opaque to users**: Private lists are harder to debug; users cannot see why something was blocked
- **No community contribution**: Users cannot improve the internal list (unlike EasyList)

## Decision

**Recommended: Option B (EasyList + EasyPrivacy)**

Rationale:

1. **Comprehensive coverage**: EasyList + EasyPrivacy achieves ~95% effectiveness (verified by uBlock Origin community). Sufficient to reach performance target (3-6x improvement).

2. **Licensing clean**: Both CC BY-SA 3.0; commercially viable; requires attribution in settings.

3. **Maintenance scalability**: Both lists are community-maintained and actively updated; no curation burden on our team.

4. **User expectations**: Users familiar with ad blockers recognize EasyList + EasyPrivacy as the standard baseline.

5. **Path to user customization**: Phase 2 can add opt-in list subscription UI (EasyPrivacy, AdGuard, others) without changing MVP.

### Implementation

**Phase 1: Hardcoded defaults**
```
// browser prefs (defaults)
{
  "adblock_enabled": true,
  "filter_lists": [
    { "url": "https://easylist.to/easylist/easylist.txt", "enabled": true },
    { "url": "https://easylist.to/easylist/easyprivacy.txt", "enabled": true }
  ]
}
```

**Phase 1 Startup**:
1. On first run: fetch both lists from CDN (or ship bundled)
2. Validate SHA-256 checksum
3. Parse with adblock-rust::Engine::parse_rules()
4. Serialize to FlatBuffers
5. Store in prefs as version hash + timestamp
6. Load into memory at next startup

**Phase 2: Subscription UI**
```
// Additional available lists (user can enable/disable)
- EasyList Specific + Fixes
- Peter Lowe's Blocklist (hosts format, needs conversion)
- AdGuard Filters
- uBlock Origin filters (after licensing review)
- Fanboy's Social Blocking List
```

**Phase 3: Custom List Support**
```
// Users can paste custom filter list URL or upload .txt file
- Import from URL: periodic fetch (6h, user-configurable)
- Import from file: one-time load (local file)
- Custom list tracking: separate from built-in lists (can rollback independently)
```

### Attribution & Licensing Compliance

In `about:adblocking` or settings page, display:

```
Filter Lists in Use:

EasyList (https://easylist.to)
  License: CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/)
  Last updated: [timestamp]
  Rules: [count]
  Attribution: EasyList maintained by EasyList community

EasyPrivacy (https://easylist.to)
  License: CC BY-SA 3.0
  Last updated: [timestamp]
  Rules: [count]
  Attribution: EasyPrivacy maintained by EasyList community
```

## Consequences

### Good
- Ships with comprehensive defaults (EasyList + EasyPrivacy); out-of-box effectiveness matches Brave
- Community lists are actively maintained; minimal support burden
- Licensing is clean and commercial-friendly
- Clear upgrade path to subscription UI (Phase 2) and custom lists (Phase 3)
- Attribution compliance is straightforward

### Bad
- Slightly larger startup overhead (~10MB + ~200ms parse + serialize time)
- Two lists to manage; update coordination adds complexity (mitigate with async updates + fallback to cached version if one fails)
- Memory footprint slightly higher than EasyList-only (~15-20MB vs ~10MB)

### Neutral
- No impact on extension ecosystem (built-in lists complement third-party ad blockers)
- Users can disable EasyPrivacy if they want ads-only blocking (control remains with user)
