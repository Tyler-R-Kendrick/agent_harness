# ADR-002: Four-Tier Memory Model (Hot/Warm/Cool/Cold) vs. Alternatives

**Status**: **Recommended** | **Created**: 2026-04-04 | **Affected Components**: WorkspaceMemoryManager, MemoryTierTransition, UI Tab Indicators

## Context

Modern browsers need to balance latency and memory efficiency. Users switch between multiple workspaces, and not all can be "hot" (full renderer process alive) simultaneously due to memory constraints.

The question: How many distinct memory tiers should the browser support?

- **Too few tiers**: Coarse tradeoffs; users lose flexibility
- **Too many tiers**: Complexity in tier transitions; harder to reason about
- **Just right**: Clear latency/memory spectrum with reasonable transition complexity

## Decision Drivers

1. **Latency Spectrum**: User expectations for activation time vary (immediate vs. "a few seconds is acceptable")
2. **Memory Efficiency**: Different tier costs range from ~150MB (hot) to ~200 bytes (cold)
3. **Transition Frequency**: Users should rarely need to manually promote/demote; system should auto-manage
4. **Visual Simplicity**: Users need to understand tier differences at a glance (fewer colors/icons = better)
5. **Implementation Complexity**: Tier transitions require specific technical handling (freeze renderer, serialize state, etc.)

## Options Considered

### Option A: Two-Tier Model (Hot/Cold)

**Description**: Tabs are either fully alive (hot) or fully dormant (cold). No in-between states.

**Technical Mapping**:
- **Hot**: Full renderer process; JS running; latency ~50ms
- **Cold**: URL-only; no process; latency ~2-5s (reload from network)

**Strengths**:
- **Simplicity**: Binary choice; easy to reason about
- **Clear to users**: "Active" vs. "saved" is intuitive
- **Fewer transitions**: Only two states; fewer edge cases
- **Low implementation complexity**: No DOM freezing or serialization logic needed

**Weaknesses**:
- **No middle ground**: 50ms jump to 2-5s gap is large; no graceful degradation
- **Harsh memory cliff**: Cannot partially unload a tab; goes from 150MB to 0.2MB
- **Unused memory**: Many dormant tabs never accessed again, but were fully loaded at some point
- **Activation experience poor**: Cold tabs require full reload (network request), even if only 1 minute away
- **User frustration**: No way to say "keep this cached but not fully alive"

**Tradeoffs**:
- **Advantage**: Minimal implementation complexity; clear mental model
- **Cost**: Poor user experience for workspaces accessed infrequently; wasted memory potential

---

### Option B: Three-Tier Model (Hot/Warm/Cold)

**Description**: Add a middle tier where tabs are frozen (DOM snapshot cached) but not fully alive.

**Technical Mapping**:
- **Hot**: Full renderer; JS running; latency ~50ms; memory ~100-150MB
- **Warm**: Frozen DOM snapshot; JS suspended; latency ~300-500ms; memory ~20-50MB
- **Cold**: URL-only; latency ~2-5s; memory ~0.2MB

**Strengths**:
- **Better tradeoff curve**: Three distinct memory/latency points
- **Warm as a bridge**: Not as expensive as hot, but much faster than cold
- **Covers common case**: Users can have "pre-cached but not live" tabs
- **Reasonable complexity**: DOM freezing is well-understood in browsers (similar to tab freezing in existing research)

**Weaknesses**:
- **Warm tier still memory-heavy**: ~20-50MB per tab is significant; large projects hit memory ceiling fast
- **Serialization overhead**: Going Warm → Cold requires serializing form data, localStorage, etc. (mitigated by async)
- **UI color naming**: Three tier colors (red/yellow/blue) is approaching cognitive load
- **Missing case**: No explicit "lightweight dormant" tier for very old tabs
- **Implementation still substantial**: Need DOM freezing + serialization logic

**Tradeoffs**:
- **Advantage**: Better tradeoff curve; reasonable complexity; covers most use cases
- **Cost**: Still doesn't address very old/rarely-accessed tabs efficiently; memory still climbs fast

---

### Option C: Four-Tier Model (Hot/Warm/Cool/Cold) (Recommended)

**Description**: Add a "cool" tier between warm and cold. Serialized state on disk (with metadata cache in RAM), but no process.

**Technical Mapping**:
- **Hot**: Full renderer; JS running; latency ~50ms; memory ~100-150MB per tab
- **Warm**: Frozen DOM; JS suspended; latency ~300-500ms; memory ~20-50MB per tab
- **Cool**: Serialized to disk; metadata cached in RAM; latency ~1-2s; memory ~1-5KB per tab (metadata only)
- **Cold**: URL-only; latency ~2-5s; memory ~200 bytes per tab

**Strengths**:
- **Optimal memory curve**: Clear exponential decrease (150MB → 40MB → 5KB → 0.2KB)
- **Handles scale**: Browsers with 100+ dormant tabs now feasible (100 × 5KB = 0.5MB, vs. 100 × 40MB = 4GB in warm-only model)
- **Cool tier is "sweet spot"**: Serialized state allows instant DOM restoration (no network), but minimal memory cost
- **Matches browser history patterns**: Cool tier similar to browser history (URL + metadata, not full page state)
- **Visual coding**: Four tier colors map naturally (red=active, yellow=cached, blue=disk, gray=URL)
- **Graceful degradation**: If memory exhausted, cascade is smooth: hot → warm → cool → cold
- **Transition logic is clear**: Each transition has one primary operation:
  - Hot → Warm: Freeze renderer
  - Warm → Cool: Serialize to disk
  - Cool → Cold: Delete serialized state

**Weaknesses**:
- **Serialization complexity**: Cool tier requires serializing form data, scroll position, localStorage (implementable, but non-trivial)
- **Disk I/O**: Cool tier uses disk; adds latency variability based on storage speed
- **UI complexity**: Four tier states; four colors/icons; potential user confusion
- **Implementation effort**: Requires coordination with TabRestoreService, RenderWidgetHost, storage APIs
- **Testing burden**: More tier combinations to test (3 transitions between 4 tiers)

**Tradeoffs**:
- **Advantage**: Optimal memory efficiency; supports massive workspace collections; graceful degradation
- **Cost**: Higher implementation complexity; more state combinations to test and reason about

---

### Option D: Five-or-More-Tier Model (Not Recommended)

**Description**: Add even more tiers (e.g., "warm-plus" or "cool-compressed").

**Analysis**: Diminishing returns. Each tier adds:
- UI complexity (more colors, more confusion)
- Transition logic (more state machines)
- Testing burden (combinatorial explosion)

Beyond four tiers, users can't visually distinguish in a sidebar, and engineering complexity exceeds the benefit. **Not recommended.**

---

## Decision

**Recommend Option C: Four-Tier Model (Hot/Warm/Cool/Cold)**

### Rationale

1. **Matches user expectations**: Latency spectrum (50ms → 500ms → 2s → 5s) aligns with how users perceive responsiveness
   - <100ms: Feels instant (hot)
   - ~500ms: Noticeable but acceptable (warm)
   - ~2s: Clearly delayed but not annoying (cool)
   - ~5s: Similar to page reload (cold, expected)

2. **Memory efficiency is exceptional**: Cool tier reduces per-tab memory by 10,000x vs. hot (150MB → 15KB). This enables scale:
   - Two-tier: 100 tabs → 15GB (hot) or 20MB (cold); no middle ground
   - Three-tier: 100 tabs → 15GB (hot) or 5GB (warm); can't hold both simultaneously
   - **Four-tier: 100 tabs → 15GB (hot) + 5GB (warm) + 500KB (cool) = feasible; natural scaling**

3. **Serialization is implementable**: Cool tier (serialize to disk) is a well-understood pattern:
   - Browser history already stores serialized state (similar approach)
   - TabRestoreService has infrastructure for this
   - Modern async I/O makes disk overhead acceptable

4. **Transition logic is manageable**: Four tiers have clear promotion/demotion triggers:
   - Timeout-based: hot → warm (5 min idle), warm → cool (30 min), cool → cold (24 hours temp)
   - Memory pressure-based: Cascade through tiers when budget exceeded
   - User-explicit: Drag tab to desired tier in sidebar

5. **Visual clarity is preserved**: Four tier colors (red/yellow/blue/gray) are distinct enough for sidebar icons without being overwhelming. Alternatives:
   - Two tiers: Boring (just colored vs. grayscale)
   - Three tiers: Confusion (is yellow "almost active" or "almost dormant"?)
   - **Four tiers: Clear spectrum; each tier has distinct character (active/cached/archived/bookmark)**

6. **Backwards-compatible**: Users unfamiliar with memory tiers can ignore them; system auto-manages tier transitions without user input

### Consequences

#### Good

- Memory scales linearly with workspace count; no cliff at transition points
- Warm tier provides "best of both worlds" (cached but not resource-intensive)
- Cool tier enables large workspace libraries (100+ dormant tabs) without bloat
- Natural mapping to browser history concepts (URL + metadata on disk)
- Tier transitions are visually clear (four distinct colors/icons)
- System can auto-manage tiers without user intervention, while still allowing explicit control

#### Bad

- Serialization logic is more complex than warm-only (requires form data capture, localStorage snapshot)
- Disk I/O adds latency variability; slow storage → slow cool-tier restore
- Four-tier mental model is harder for casual users to understand vs. two-tier; requires education
- Testing complexity increases (more combinations to cover)
- Implementation timeline slightly longer (serialization infrastructure takes engineering effort)

#### Neutral

- Cool tier memory cost is negligible; doesn't affect overall budget
- Transition triggers (timeouts) need tuning via telemetry
- Disk storage for cool-tier serializations needs cleanup policy (garbage collection)

---

## Implementation Strategy

1. **Phase 1**: Implement hot/warm tiers (DOM freezing); validate transition logic
2. **Phase 2**: Add cool tier (serialization); integrate with TabRestoreService
3. **Phase 3**: UI indicators (color-coded tabs); sidebar controls
4. **Phase 4**: Telemetry; tune timeout thresholds based on user behavior

---

## Related Decisions

- **ADR-001**: Why unify tabs/bookmarks (enables tier system)
- **ADR-003**: Why process-per-workspace (enables tier transitions)
- **ADR-004**: Why dual flags (persisted flag determines if tab survives cold → garbage collection)

---

## References

- **Memory Model Details**: workspace-architecture.md § 4
- **Tier Transitions**: chromium-implementation-notes.md § Phase 3
- **Prior Art**:
  - Chrome discarding: [Chromium Resource Coordinator](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/design/resource_coordinator.md)
  - Safari Intelligent Tracking Prevention (DOM snapshots)
  - Firefox Tab Unloader (memory savings per tab)

---

**Document Version**: 1.0
**Last Updated**: 2026-04-04
**Decision Maker**: Architecture Review Board
**Related Issues**: #workspace-002 (memory-tier-design)
