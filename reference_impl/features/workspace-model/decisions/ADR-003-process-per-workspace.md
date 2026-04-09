# ADR-003: Process Per Workspace vs. Shared Process Pool

**Status**: **Recommended** | **Created**: 2026-04-04 | **Affected Components**: WorkspaceProcessHost, WorkspaceProcessManager, RenderProcessHostImpl

## Context

Chromium's traditional process model is:
- **Browser Process**: Handles UI, extensions, policy
- **Renderer Processes**: One or more per tab (or site-instance, depending on policy)

This is flat: no intermediate hierarchy between browser and renderer.

The question: Should workspaces be **first-class process entities** (one process per workspace, with child tab renderers), or should tabs remain in a **shared process pool** with workspace-aware policies?

## Decision Drivers

1. **Crash Isolation**: Preventing one workspace's malfunction from affecting others
2. **Resource Accounting**: Per-workspace memory budgets and quotas
3. **Process Complexity**: Introducing new process types should be justified
4. **Implementation Scope**: Workspace processes add one layer; too much?
5. **Performance Overhead**: Inter-process communication complexity vs. benefits

## Options Considered

### Option A: Shared Process Pool (Flat Model, No Workspace Processes)

**Description**: Keep the flat browser → renderer model. Workspaces are data concepts (in WorkspaceModel) but not process concepts. Workspace-aware policies in TabManager and MemoryCoordinator control which tabs are discarded during memory pressure.

**Process Model**:
```
Browser Process
├─ Renderer 1 (associated with Workspace A)
├─ Renderer 2 (associated with Workspace B)
├─ Renderer 3 (associated with Workspace A)
├─ GPU Process
└─ ...

Memory Management: TabManager queries workspace association before discard
```

**Strengths**:
- **Minimal changes to Chromium core**: Workspace is metadata on tabs; no new process type needed
- **Simpler IPC**: No intermediate process; direct browser ↔ renderer communication
- **Lower process overhead**: No workspace process PIDs, no process lifecycle management
- **Existing tooling works**: Task manager, chrome://extensions, chrome://processes show familiar flat view
- **Faster implementation**: No new process launcher, fewer subsystems to touch

**Weaknesses**:
- **No process isolation**: Crash in Renderer 3 (Workspace A) affects all tabs in that renderer, regardless of workspace separation
- **Workspace is invisible to Chromium**: Workspace is just an attribute; no process-level enforcement
- **Resource limits are soft**: Memory budgets are policy-based (TabManager checks), not kernel-enforced
- **Poor crash recovery**: If Renderer 1 crashes, recovery logic must know which workspaces were affected
- **Shared memory pools**: All renderers share process pool; high-memory workspace can starve others
- **No workspace-level control**: Can't restart a single workspace without restarting all affected renderers

**Tradeoffs**:
- **Advantage**: Minimal implementation effort; familiar to Chromium engineers
- **Cost**: Loses crash isolation and resource enforcement; workspace remains opaque to the browser

---

### Option B: Process-Per-Workspace (Hierarchy Model) (Recommended)

**Description**: Create a new `PROCESS_TYPE_WORKSPACE` in Chromium. Each workspace folder spawns a `WorkspaceProcessHost` (utility process), which supervises child tab renderers. Workspace processes handle lifecycle, memory enforcement, and crash recovery.

**Process Model**:
```
Browser Process
├─ Workspace Process (Workspace A, PID 2100)
│  ├─ Renderer 1 (Workspace A, Tab 1, PID 2101)
│  ├─ Renderer 2 (Workspace A, Tab 2, PID 2102)
│  └─ (Workspace process tracks memory, children)
├─ Workspace Process (Workspace B, PID 2200)
│  ├─ Renderer 3 (Workspace B, Tab 1, PID 2201)
│  └─ (Workspace process tracks memory, children)
├─ GPU Process
└─ ...

Memory Management: WorkspaceProcessHost enforces per-workspace budget
Crash Recovery: Workspace A crash doesn't affect Workspace B renderers
```

**Strengths**:
- **Process isolation**: Workspace process crash is isolated; child tabs in other workspaces unaffected
- **Resource accounting**: WorkspaceProcessHost can report per-workspace memory usage, enforce hard limits
- **Crash recovery**: Browser knows exactly which tabs were in crashed workspace; can respawn or migrate
- **Workspace-level control**: "Restart Workspace A" terminates only its process, not others
- **Memory enforcement**: Kernel-level process limits (ulimit, cgroups) can enforce per-workspace budgets
- **Natural hierarchy**: Mirrors user's mental model (workspace ← tabs)
- **Task manager clarity**: Users see workspace tree in task manager (workspace folder + child tabs)
- **Async memory management**: WorkspaceProcessHost can report memory pressure; browser coordinates recovery

**Weaknesses**:
- **New process type**: Requires modifying Chromium's process launcher, IPC routing, type definitions
- **Process overhead**: Each workspace process has baseline memory cost (~5-10 MB), PID cost (OS resource)
- **IPC complexity**: Child renderers must register with workspace process; workspace process relays to browser
- **Lifecycle complexity**: Workspace process creation/destruction must be coordinated with tab lifetime
- **Platform differences**: OS-level process grouping semantics vary (setpgid vs. Job Objects)
- **Longer implementation**: ~6 phases; touches many subsystems (RenderProcessHostImpl, SiteInstanceImpl, SessionService)

**Tradeoffs**:
- **Advantage**: True isolation; resource enforcement; workspace becomes first-class in Chromium
- **Cost**: Significant implementation effort; new process type complexity; learning curve for engineers

---

### Option C: Hybrid (Lightweight Broker Process)

**Description**: Create workspace processes, but they're lightweight "brokers" (not full utility processes). They don't have their own message queues; they're mostly metadata holders. Child renderers are still managed directly by the browser, but register with the broker for bookkeeping.

**Analysis**: This is a middle ground but doesn't clearly win:
- Still adds process overhead (lightweight process still has PID, memory, scheduler overhead)
- Removes the main benefit (isolation at process level)
- Adds complexity without clear payoff
- **Not recommended.**

---

## Decision

**Recommend Option B: Process-Per-Workspace (Hierarchy Model)**

### Rationale

1. **Crash isolation is critical for scale**: If users have 10 workspaces, and one crashes, they should not lose access to the other 9. A shared process pool makes crash recovery all-or-nothing.

2. **Process hierarchy matches user expectations**: Users think of workspaces as containers; having workspace processes makes that explicit in the OS and browser internals.

3. **Resource enforcement is feasible**: WorkspaceProcessHost can:
   - Report per-workspace memory consumption
   - Enforce hard limits via system APIs (cgroups, Job Objects)
   - Coordinate memory pressure responses autonomously
   - This is not possible with soft policies in a shared pool

4. **Task manager transparency**: Users can see workspace tree in chrome://memory (task manager). This is both a feature (transparency) and a testing tool (engineers can debug memory issues).

5. **Implementation is manageable**: Yes, it touches multiple subsystems, but Chromium already has precedent:
   - Extensions run in separate processes (ExtensionProcessHost)
   - GPU has its own process type
   - Plugin and Utility processes are long-established
   - Adding PROCESS_TYPE_WORKSPACE follows established patterns

6. **Performance overhead is acceptable**: Baseline cost per workspace:
   - Memory: ~5-10 MB per process (0.5% of 2GB budget)
   - Scheduler: One additional process per workspace (modern kernels handle thousands easily)
   - IPC: Extra hop (browser → workspace → renderer) adds <1ms latency
   - **Tradeoff**: Small cost for significant isolation benefit

7. **Enables future features**: Process hierarchy unlocks capabilities not possible with flat model:
   - Workspace snapshots (serialize entire process tree)
   - Workspace templates (clone process configuration)
   - Shared workspaces (one process, multiple browser instances)
   - Workspace resumption (restore from checkpoint)

### Consequences

#### Good

- **Crash isolation**: Workspace crash doesn't affect others; browser remains responsive
- **Resource accountability**: Per-workspace memory usage visible; hard limits enforceable
- **Simplified crash recovery**: Browser knows which tabs to respawn/migrate
- **Task manager transparency**: Users see workspace hierarchy; clarity for debugging
- **Autonomous management**: WorkspaceProcessHost can make local memory decisions without global coordination
- **Extensibility**: Workspace processes can be extended with custom policies (memory, CPU quotas)
- **Natural abstraction**: Matches user's mental model and enables future features

#### Bad

- **Implementation complexity**: New process type requires modifications to process launcher, IPC routing, type system
- **Process overhead**: ~5-10 MB per workspace × number of workspaces (10 workspaces = 50-100 MB)
- **Platform-specific code**: Process grouping (setpgid, Job Objects) differs per OS; requires platform-specific handling
- **Learning curve**: Chromium engineers new to the codebase face unfamiliar hierarchy
- **Testing burden**: More code paths (process creation, IPC, lifecycle) to test
- **Longer implementation timeline**: 6 phases; slower time-to-market

#### Neutral

- **IPC latency**: Extra hop (browser → workspace → renderer) negligible for UI operations (<1ms overhead)
- **Memory cleanup**: Process termination automatically cleans up resources (OS handles this)

---

## Implementation Strategy

1. **Phase 2**: Define PROCESS_TYPE_WORKSPACE, create WorkspaceProcessHost skeleton
2. **Phase 2**: Implement process launcher (spawn workspace process from utility process template)
3. **Phase 2**: RenderProcessHostImpl integration (workspace-aware assignment)
4. **Phase 2**: SiteInstanceImpl modification (carry workspace UUID)
5. **Phase 3**: WorkspaceProcessManager implementation (process registry and lifecycle)
6. **Phase 3**: IPC message definitions (RegisterTab, UnregisterTab, MemoryUsage)
7. **Phase 3**: Crash detection and recovery logic
8. **Phase 5-6**: Integration with SessionService and task manager

**Phasing rationale**: Data model first (Phase 1), then processes (Phase 2), then memory management (Phase 3). Allows each layer to be tested before next layer depends on it.

---

## Mitigations for Downsides

| Downside | Mitigation |
|---|---|
| Process overhead | Measure baseline cost; optimize process startup time; lazy-create processes (don't spawn until first tab) |
| Platform differences | Abstract OS-specific APIs into `workspace_process_utils_{win,mac,linux}.cc` |
| Learning curve | Document workspace process architecture in design docs; code comments; pair programming during implementation |
| Testing complexity | Unit tests for process lifecycle; integration tests for crash scenarios; fuzzing for IPC messages |

---

## Related Decisions

- **ADR-001**: Unified tree (enables process hierarchy)
- **ADR-002**: Four-tier memory (WorkspaceProcessHost enforces budgets)
- **ADR-004**: Dual flags (activeMemory affects whether workspace process is pre-spawned)

---

## References

- **Process Architecture**: chromium-implementation-notes.md § Phase 2
- **Workspace Process Host**: chromium-implementation-notes.md § 2.2
- **Crash Recovery**: chromium-implementation-notes.md § 2.6 (Risks)
- **Prior Art**:
  - Chrome Extensions (process isolation): [Chromium design docs](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/design/)
  - GPU Process: Similar hierarchy (Browser → GPU)
  - Utility Process: Base class for lightweight sandbox isolation

---

**Document Version**: 1.0
**Last Updated**: 2026-04-04
**Decision Maker**: Architecture Review Board
**Related Issues**: #workspace-003 (process-architecture)
