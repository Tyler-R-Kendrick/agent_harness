# ADR-004: Dual Persistence Flags (persisted + activeMemory) vs. Single Flag

**Status**: **Recommended** | **Created**: 2026-04-04 | **Affected Components**: WorkspaceNode, WorkspaceModel, SessionService, WorkspaceMemoryManager

## Context

A workspace's lifecycle has two independent concerns:

1. **Persistence**: Does this workspace survive browser restart?
   - Saved bookmarks (workspace) should persist
   - Ad-hoc browsing (workspace) should not

2. **Active Memory**: Is this workspace pre-loaded and cached?
   - Current project should be in warm/hot memory (fast activation)
   - Archived project should be cold/dormant (minimal memory cost)

The question: Should these be controlled by a **single boolean flag** (combining both concerns) or **two independent boolean flags** (giving users granular control)?

## Decision Drivers

1. **User control**: How much flexibility should users have over workspace lifecycle?
2. **Memory efficiency**: Can users save memory by unchecking "active memory"?
3. **Default behavior**: What should happen on restart? (Persistent-active-memory and temporary-active-memory are different)
4. **UI complexity**: How many settings should users configure?
5. **Conceptual clarity**: Are persistence and active-memory separate ideas or the same idea?

## Options Considered

### Option A: Single Flag (Combined State)

**Description**: One boolean flag controls both persistence and active-memory status. Flag name: `savedState`.

```typescript
interface WorkspaceNode {
  savedState: boolean;  // true = persisted AND pre-loaded; false = temporary AND dormant
}
```

**Semantics**:
- `savedState=true`: Workspace is a bookmark. On restart: restore in warm tier (pre-loaded).
- `savedState=false`: Workspace is temporary. On restart: discarded.

**Strengths**:
- **Simplicity**: One concept; users think "saved" or "temporary"
- **Fewer UI knobs**: Toggle button instead of two checkboxes
- **Defaults make sense**: Saved workspaces are ready; temporary are not
- **Less confusion**: Users aren't asked to pick two settings

**Weaknesses**:
- **No middle ground**: Can't have "saved but dormant" (persisted project that's currently inactive)
- **No flexibility**: Can't say "I want this temporary task active NOW but not saved"
- **Memory waste**: Saved workspaces must be kept in warm/active memory even if rarely used (memory bloat)
- **Poor for archives**: Projects you want to keep but not immediately access must either be "warm (memory cost)" or "lost on restart"
- **Conflates two ideas**: Persistence and memory state are orthogonal concerns; single flag doesn't capture that

**Example Problem**:
```
Alice has a "Research Project" workspace with 50 tabs.
- She wants to save it (doesn't want to lose it on restart)
- She won't touch it for weeks (wants it dormant to save memory)

With single flag:
- savedState=true: Workspace persists but is restored to WARM tier on restart (50 MB memory cost, every session)
- savedState=false: Workspace is not persisted (lost on restart, defeating the purpose)

Neither option is ideal.
```

---

### Option B: Dual Flags (Independent Control) (Recommended)

**Description**: Two independent boolean flags: `persisted` (persistence) and `activeMemory` (caching policy).

```typescript
interface WorkspaceNode {
  persisted: boolean;        // Survives restart?
  activeMemory: boolean;     // Pre-loaded into warm/hot tier?
}
```

**Semantics**:

| persisted | activeMemory | Lifecycle | Use Case | Memory Cost |
|---|---|---|---|---|
| FALSE | FALSE | Garbage collected after session or timeout | Ad hoc search, one-off browsing | Minimal |
| FALSE | TRUE | Ephemeral working context, active this session only | Current task, work-in-progress | Medium |
| TRUE | FALSE | Persistent bookmark, loaded on-demand | Project bookmark, archive, reference | Minimal |
| TRUE | TRUE | Persistent AND always-ready | Daily driver project, critical context | High |

**Strengths**:
- **Flexibility**: Users can create any of the four combinations based on their needs
- **Memory efficiency**: Saved but dormant workspaces don't consume memory unnecessarily
- **Clear semantics**: Persistence and active-memory are orthogonal concerns with clear meanings
- **Solves the problem**: Alice's research project can be `persisted=true, activeMemory=false`
- **Extensible**: Future features (e.g., selective pre-warming based on time of day) can use both flags
- **Matches user mental model**: Users think about "is this saved?" and "do I need this right now?" as separate questions

**Weaknesses**:
- **UI complexity**: Two checkboxes instead of one toggle; users must understand both
- **Confusion risk**: Users might not understand independence (might think persisted implies active)
- **Default management**: Need sensible defaults; should `persisted=true` imply `activeMemory=true` by default?
- **Settings bloat**: More knobs in the UI; more tooltips/documentation needed
- **Implementation complexity**: WorkspaceMemoryManager must handle all four states

**Example Confusion Points**:
- User saves a workspace (`persisted=true`) and expects it to be active next time. Default should be `activeMemory=true` on creation, but can be toggled later.
- User unchecks `activeMemory` and is surprised workspace disappears from sidebar on restart. This is incorrect; sidebar should always show persisted workspaces.

---

### Option C: Three-State Flag (Saved / Temporary-Active / Temporary-Dormant)

**Description**: Single flag with three states instead of two:
- `state: "active" | "saved" | "dormant"`

**Analysis**: This is essentially dual flags encoded as an enum. It preserves independence but makes it harder to reason about (single flag with hidden structure) vs. two explicit booleans.

**Not recommended**: Same complexity as dual flags, but less clear. Two explicit booleans are better.

---

## Decision

**Recommend Option B: Dual Flags (Independent Control)**

### Rationale

1. **Real use cases require both flags**:
   - Research project: `persisted=true, activeMemory=false` (saved but dormant)
   - Current task: `persisted=false, activeMemory=true` (unsaved but active)
   - These are common, and single flag can't express them

2. **Orthogonal concerns**: Persistence (long-term storage) and active memory (caching policy) are fundamentally different:
   - Persistence is about "do I want to keep this forever?"
   - Active memory is about "do I need this right now?"
   - Combining them conflates two independent decisions

3. **Power users benefit greatly**: Users managing many workspaces (10+) can have:
   - 2-3 daily-driver workspaces: `persisted=true, activeMemory=true`
   - 5-10 project workspaces: `persisted=true, activeMemory=false`
   - 1-2 temporary workspaces: `persisted=false, activeMemory=true`
   - This precision is impossible with a single flag

4. **Memory efficiency scales with workspace count**: As users accumulate workspaces:
   - Single flag: All saved workspaces must be active (memory bloat)
   - Dual flags: Users can save workspaces but keep them dormant (clean memory profile)

5. **Documentation and UI can mitigate confusion**:
   - Clear tooltip: "Persisted: Saved across restarts. Active Memory: Pre-loaded for fast access."
   - Visual grouping: Two checkboxes side-by-side with distinct labels
   - Progressive disclosure: Basic users see one toggle; advanced users see both
   - Defaults are sensible: New saved workspace defaults to `activeMemory=true`; can be toggled off

### Consequences

#### Good

- **Flexibility**: All four use cases directly expressible
- **Memory efficiency**: Dormant saved workspaces use minimal memory
- **Clear semantics**: Orthogonal concerns clearly separated
- **Scales with count**: Users can manage 10+ workspaces without memory pressure
- **Extensibility**: Future features can leverage both flags
- **User empowerment**: Advanced users can fine-tune behavior; casual users get reasonable defaults

#### Bad

- **UI complexity**: Two settings instead of one; more decision points for users
- **Confusion risk**: Users might misunderstand independence (think `persisted` implies `activeMemory`)
- **Documentation burden**: Need clear explanations of all four combinations
- **Implementation complexity**: Four states require testing all combinations; state machine logic in WorkspaceMemoryManager
- **Default management**: Must ship sensible defaults; wrong defaults will frustrate users

#### Neutral

- **Sidebar display**: Both saved (persisted=true) and active (activeMemory=true) should be visible; logic is straightforward
- **Session restore**: WorkspaceMemoryManager checks both flags during restore

---

## Implementation Strategy

### UI Presentation

**For basic users** (toggle view):
```
[ ] Save this workspace across restarts
```

**For advanced users** (checkbox view):
```
[ ] Persisted (saved across restarts)
[ ] Active Memory (pre-loaded for fast access)
```

**Contextual tooltips**:
- **Persisted**: "This workspace will be saved and restored when you restart the browser."
- **Active Memory**: "This workspace's content will be kept in memory for fast access. Uncheck to save memory."

### Defaults

- **New persistent workspace**: `persisted=true, activeMemory=true` (most common case)
- **New temporary workspace**: `persisted=false, activeMemory=true` (current task)
- **New bookmark folder**: `persisted=true, activeMemory=false` (archive/reference)

### Session Restore Logic

```cpp
void SessionService::RestoreSession() {
  auto workspace_tree = workspace_storage_->LoadWorkspaceTree();

  for (auto& workspace : workspace_tree) {
    if (workspace.persisted) {
      // Workspace was saved; restore it
      AddWorkspaceToModel(workspace);

      if (workspace.activeMemory) {
        // Pre-load to warm tier
        memory_manager->SetWorkspaceMemoryTier(workspace.id, WARM);
      } else {
        // Load to cold tier (on-demand)
        memory_manager->SetWorkspaceMemoryTier(workspace.id, COLD);
      }
    }
    // Non-persisted workspaces are discarded
  }
}
```

### Memory Management Logic

```cpp
void WorkspaceMemoryManager::EvaluateMemoryPressure() {
  // Demotion priority (least important first):
  // 1. Temporary + Cold (will be garbage collected anyway)
  // 2. Temporary + Active (user chose temporary, accept loss)
  // 3. Saved + Dormant (user chose to save, but doesn't need active memory)
  // 4. Saved + Active (last resort; user explicitly chose active memory)

  // Promotion triggers:
  // - User clicks on workspace → promote current workspace to HOT
  // - if activeMemory=true → pre-load to WARM on demand
  // - if activeMemory=false → remain COLD until user interaction
}
```

---

## Related Decisions

- **ADR-001**: Unified tree (enables flexible node lifecycle)
- **ADR-002**: Four-tier memory (dual flags determine tier on restore)
- **ADR-003**: Process-per-workspace (activeMemory flag affects whether workspace process is spawned on startup)

---

## References

- **Data Model**: workspace-architecture.md § 2.2 (Persistence Flags Semantics)
- **Memory Model**: workspace-architecture.md § 4 (Four-Tier Architecture)
- **Session Restore**: chromium-implementation-notes.md § Phase 5
- **Examples**: workspace-architecture.md § 2.2 (Combined States & Lifecycle)

---

**Document Version**: 1.0
**Last Updated**: 2026-04-04
**Decision Maker**: Architecture Review Board
**Related Issues**: #workspace-004 (persistence-flags)
