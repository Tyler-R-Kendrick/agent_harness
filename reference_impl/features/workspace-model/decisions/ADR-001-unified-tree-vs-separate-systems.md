# ADR-001: Unified Workspace Tree vs. Separate Tab/Bookmark Systems

**Status**: **Recommended** | **Created**: 2026-04-04 | **Affected Components**: WorkspaceModel, SessionService, UI Sidebar

## Context

Traditional browsers maintain three separate information systems:
1. **Tabs**: Ephemeral, session-scoped, in-memory browser contexts
2. **Bookmarks**: Persistent, hierarchical saved references (usually in a separate UI layer)
3. **Tab Groups** (recent addition): Organizational grouping over tabs, often lost on restart

These systems create cognitive friction for users:
- Users manually duplicate information between tabs and bookmarks ("Should I save this as a bookmark?")
- Bookmarks are physically separated from open tabs (different UI, different mental models)
- Tab groups don't persist by default, forcing re-creation
- No unified hierarchy (bookmarks are nested folders, tabs are flat groups)
- Memory management is implicit and invisible (users don't know which tabs consume RAM)

The question: Should we continue this three-system approach, or unify them into a single tree?

## Decision Drivers

1. **User Mental Model**: Users think in projects/contexts, not "tabs vs. bookmarks"
2. **Cognitive Load**: Unification reduces decision points (one tree, not three places to organize)
3. **Persistence Flexibility**: Independent control over persistence and active-memory caching
4. **Extensibility**: A single tree model is easier to extend (nesting, templates, sharing)
5. **Implementation Complexity**: Unification simplifies session restore and memory management logic

## Options Considered

### Option A: Keep Separate Systems (Status Quo + Incremental Improvements)

**Description**: Enhance existing tabs, bookmarks, and tab groups independently. Add memory hints (like Safari/Vivaldi) without structural unification.

**Strengths**:
- Minimal breaking changes; existing workflows continue
- Bookmarks still work for users who rely on them
- Tab groups remain a lightweight feature
- Shorter implementation timeline (no migration required)

**Weaknesses**:
- Users still duplicate information (tabs ↔ bookmarks)
- Bookmarks remain visually separated from tabs
- No unified persistence strategy (tab groups need special handling)
- Memory management remains implicit
- Tab groups still don't persist by default

**Tradeoffs**:
- **Advantage**: Quick to ship; preserves compatibility
- **Cost**: Misses the opportunity to simplify user experience; doesn't address the root problem

---

### Option B: Hybrid Approach (Tab Groups ++ with Memory Hints)

**Description**: Extend tab groups to support deeper nesting, add memory tier indicators (color-coded icons), keep bookmarks separate but allow bidirectional migration.

**Strengths**:
- Less disruptive than full unification
- Users still have bookmarks as a safety net
- Memory tiers become visible (red=hot, yellow=warm, etc.)
- Shorter migration path (no existing workflows break)

**Weaknesses**:
- Still maintains two information systems (groups + bookmarks)
- Nesting is optional and retrofitted; doesn't feel native
- Bookmarks remain a separate "save" action
- Session restore logic still needs to handle multiple paths (tab group persistence vs. bookmark restoration)
- Intermediate complexity without full benefit

**Tradeoffs**:
- **Advantage**: Incremental improvement; less risk than full rewrite
- **Cost**: Half-measures don't fully solve user pain; still requires migration later

---

### Option C: Unified Workspace Tree (Recommended)

**Description**: Replace tabs, bookmarks, and groups with a single `WorkspaceNode` tree. Every item (folder, tab, bookmark) is a node with independent `persisted` and `activeMemory` flags. Single sidebar tree (VS Code explorer paradigm).

**Strengths**:
- **Single mental model**: Users organize in one place; tabs and bookmarks are not separate
- **Flexible persistence**: `persisted=true` + `activeMemory=true` = always-ready project; `persisted=true` + `activeMemory=false` = saved-but-dormant project
- **Explicit memory control**: Users see memory tier of each tab; can drag to promote/demote
- **Unified session restore**: One serialization format; simpler logic
- **Extensibility**: Single tree supports templates, sharing, snapshots naturally
- **Clean codebase**: WorkspaceModel replaces TabStripModel, TabGroupModel, BookmarkModel (eventually)

**Weaknesses**:
- **Migration burden**: Existing bookmarks and tab groups need import/migration
- **User retraining**: New mental model ("everything is a node") requires education
- **UI redesign**: Sidebar replaces tab bar and bookmark bar; visual regression risk
- **Implementation complexity**: Touches core Chromium subsystems (TabStripModel, SessionService, RenderProcessHost)
- **Coexistence window**: Must support both old and new systems during rollout (adds code complexity)

**Tradeoffs**:
- **Advantage**: Solves the root problem; enables new capabilities (memory tiers, process isolation)
- **Cost**: Significant engineering effort; migration risk; user education required

---

## Decision

**Recommend Option C: Unified Workspace Tree**

### Rationale

1. **User pain is real and solvable**: Users today struggle with scattered organization (bookmarks vs. tabs). The unified tree directly addresses this.

2. **The design is implementable**: All necessary Chromium subsystems (process model, session restore, RenderProcessHost) can support workspace awareness. The implementation is phased (6 phases) to manage complexity.

3. **New capabilities emerge**: Process-per-workspace isolation and explicit memory tiers are only possible with a unified model. These enable unique value propositions vs. competitors.

4. **Cleaner long-term codebase**: Maintaining three separate systems (tabs, bookmarks, groups) increases cognitive load for engineers. A single tree is easier to reason about, test, and extend.

5. **Migration is manageable**: Existing bookmarks auto-import into a "Imported Bookmarks" workspace. Tab groups auto-convert to persisted workspaces. Users can opt into the new UI incrementally via feature flags.

### Consequences

#### Good

- Users have one place to organize (cognitive load reduced)
- Independent control over persistence and active-memory caching enables four distinct lifecycle states
- Memory tier visibility improves user understanding of browser resource usage
- Process-per-workspace isolation creates stability benefits (crash isolation)
- Single serialization format simplifies session restore and sync
- Foundation for future capabilities (templates, sharing, snapshots)

#### Bad

- Existing bookmarks must be imported/migrated (potential confusion or lost data if not handled carefully)
- Tab groups are deprecated; users relying on them must understand the transition
- Visual redesign (tab bar → sidebar tree) may confuse existing users
- Implementation touches core Chromium subsystems, increasing regression risk during rollout
- Feature flag complexity during migration period (both systems coexist, increasing code paths)

#### Neutral

- Performance characteristics change: Sidebar tree rendering vs. tab bar rendering (should be similar)
- Process model becomes slightly more complex (workspace process + child renderers vs. flat renderer pool)
- Memory overhead of tree node metadata (mitigated by lazy allocation)

---

## Implementation Strategy

To mitigate downsides:

1. **Phased rollout**:
   - Phase 1-2 (Data Model + Process): Foundation, no UI changes yet
   - Phase 3-4 (Memory + UI): Sidebar appears alongside tab bar during coexistence
   - Phase 5-6 (Persistence + Integration): Full migration; tab bar deprecated

2. **Feature flag gating** (`kWorkspaceModel`):
   - New code paths guarded by flag
   - Gradual rollout: Early adopters → power users → general population
   - Rollback possible if needed

3. **Migration tooling**:
   - Auto-import existing bookmarks into "Imported Bookmarks" workspace
   - Auto-convert tab groups to persisted workspaces
   - Clear documentation and in-UI guidance

4. **Backward compatibility**:
   - TabStripModel coexists during transition (deprecated but functional)
   - Existing tab group creation still works (delegated to WorkspaceModel internally)
   - Bookmarks API unchanged (queries routed to workspace tree)

5. **User education**:
   - In-UI tutorial/onboarding for new users
   - Blog post explaining migration from bookmarks/tab groups
   - Keyboard shortcuts and context menu hints

---

## Related Decisions

- **ADR-002**: Why four memory tiers (not two or three)
- **ADR-003**: Why process-per-workspace (not shared process pool)
- **ADR-004**: Why dual persistence flags (independent control)

---

## References

- **Problem Space**: workspace-architecture.md § 1 (Core Concept)
- **Implementation**: chromium-implementation-notes.md § Phase 1-6
- **Competitors**: CAPABILITIES.md (Tab groups, Arc, Firefox containers)
- **User Research**: [Internal] Browser organization survey (2026-03)

---

**Document Version**: 1.0
**Last Updated**: 2026-04-04
**Decision Maker**: Architecture Review Board
**Related Issues**: #workspace-001 (workspace-model epic)
