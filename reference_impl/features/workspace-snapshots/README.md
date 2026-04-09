# Workspace Snapshots

## Problem Statement

Today, workspace state is ephemeral and fragile. When a user closes the browser or navigates away from a workspace, all context — tab positions, form data, scroll offsets, MCP app states, memory tier assignments — is lost. Even with "session restore," the experience is limited:

- **Lost intermediate work**: Form data, search results, and scroll positions disappear
- **Single-machine binding**: A workspace can't move across devices; restoring on a different machine (different OS, screen resolution, browser version) often breaks
- **Team collaboration gaps**: No way to share a complete workspace with a teammate; they can't see "this is what the customer support workflow looked like when I was working on it"
- **Unreliable recovery**: Browser crashes, extensions, or OS updates can corrupt session state
- **No time-travel**: Users can't compare "what the interface looked like 2 hours ago" vs "now"

The workspace architecture already has `WorkspaceSnapshot` and `TabSnapshot` interfaces (defined but unused). Snapshots should be a first-class feature: users can save named snapshots, restore them anytime (same device or cross-device), share them with teammates, and build a history of workspace evolution.

## Proposed Solution

**Workspace Snapshots**: A capture-and-restore system that freezes the entire workspace state — all tabs, scroll positions, form data, cookies, localStorage, MCP app states, memory tier assignments, and workspace tree structure — into a portable, timestamped artifact. Users can:

1. **Capture**: Click "Save Snapshot" to freeze current workspace → generates a `snapshot-{name}-{timestamp}.zip`
2. **Name & Tag**: Assign a human-readable name and optional tags for searching
3. **Restore**: Open the snapshot file → browser reconstructs the workspace tree and re-hydrates all tabs
4. **Cross-device restore**: Snapshot adjusts for different screen sizes, browser versions, and OS
5. **Share**: Export snapshot as a `.snapshot` file (signed, optionally encrypted) → teammate imports and restores
6. **History**: Keep snapshots indefinitely or auto-prune old ones; optionally track all snapshots in a timeline UI

**Core fidelity spectrum** (captured state richness vs snapshot size):

| Level | What's Captured | Size | Restore Latency | Use Case |
|-------|---|---|---|---|
| **Minimal** | Workspace tree + URLs only | <1KB | <500ms | Share a reading list, cross-device project setup |
| **Standard** | URLs + scroll, form data, localStorage | 10-100KB | 1-3s | Typical user snapshot, share work-in-progress |
| **Rich** | Standard + MCP app cache, DOM snapshots | 100KB-2MB | 3-10s | Complex multi-tab task, recovery after crash |
| **Complete** | All tabs' full network responses, media, cookies | 5MB-50MB | 10-30s | Archive mode, full audit trail |

## Key Abstractions

**Snapshot**: An immutable, timestamped capture of a workspace's complete state at a moment in time. Identified by `{name}-{timestamp}` and stored as a ZIP archive containing:
  - `manifest.json`: Metadata (captured browser version, memory tiers, timestamp)
  - `tree.json`: Workspace tree structure (WorkspaceNode hierarchy)
  - `tabs/`: Directory of per-tab snapshots
  - `mcp-apps/`: Serialized MCP app states (if applicable)
  - `cookies.json`, `storage.json`: Aggregated cookies/localStorage

**Fidelity Level**: An enum (minimal, standard, rich, complete) that controls what state is captured. Set globally or per-snapshot.

**Restore Intent**: When opening a snapshot, the browser infers what the user wants: read-only review, active restoration, or template duplication. Affects how missing/changed resources are handled.

**Cross-machine Bridge**: Logic that adapts snapshot data when restoring on a different OS, screen resolution, or browser version. Handles layout degradation gracefully.

**Snapshot Registry**: Optional persistent index of all snapshots (local or cloud-synced), enabling timeline UI, full-text search, and collaborative snapshot sharing.

## Relationship to Existing Architecture

**Builds on:**
- **Workspace model** (`WorkspaceNode`, `WorkspaceSnapshot` interfaces): Snapshot system is the consumer of these types; it makes them real and user-visible
- **Memory tier system** (hot/warm/cool/cold): Snapshots capture tier assignments; on restore, tiers are re-applied in order
- **Agent-first rendering** (MCP app state): Snapshots serialize MCP app cache so that composed views can be restored without re-parsing/re-reasoning
- **Tab storage** (cookies, localStorage, sessionStorage): Snapshots scope and serialize these to prevent auth leakage
- **Persistence layer** (disk I/O, format serialization): Snapshots use the same serialization infrastructure as workspace bookmarks

**Extends:**
- Browser session restore: Much richer (includes form data, scroll, memory tiers, MCP state; cross-device aware)
- Bookmark export/import: Snapshots include live tab state, not just URLs
- History system: Snapshots are explicit user-created checkpoints, not automatic

**Does NOT replace:**
- Auto-save/crash recovery: That continues to work; snapshots are complementary (intentional user checkpoints vs automatic recovery)
- Individual tab's form state recovery: HTML5 form autocomplete still works within a tab

## Success Criteria

1. **Capture latency**: A 10-tab workspace snapshot completes in <2s with "standard" fidelity
2. **Cross-device restore**: Snapshot captured on Mac/1920x1440 restores on Linux/1366x768 without hard crashes; layout degrades gracefully
3. **Sharing**: A teammate can import a snapshot from another user and immediately interact with tabs (subject to auth/permission constraints)
4. **Auth handling**: Session tokens are not leaked in exported snapshots; users are notified if a restored tab requires re-auth
5. **Storage efficiency**: Typical 10-tab workspace with "standard" fidelity compresses to <200KB; "complete" fidelity stays under 10MB
6. **User discoverability**: Snapshot feature is reachable in <2 clicks; new users understand "name/date/restore" model within 30 seconds
7. **Stability**: Snapshot save/restore does not crash or corrupt workspace tree; restore is always reversible (undo)

## Document Index

- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Technical design — components, data flow, storage format, restore algorithm, cross-machine logic
- **[CAPABILITIES.md](CAPABILITIES.md)**: Competitive positioning — comparison to Chrome/Firefox/Arc/Safari session restore, unique advantages
- **[ADR-001: Snapshot Format](decisions/ADR-001-snapshot-format.md)**: ZIP + JSON vs binary blob vs SQLite database
- **[ADR-002: Auth & Credential Handling](decisions/ADR-002-auth-credentials.md)**: How to handle session tokens, passwords, API keys
- **[ADR-003: MCP App State Capture](decisions/ADR-003-mcp-state-capture.md)**: Interface contract vs best-effort serialization
- **[ADR-004: Cross-Machine Restore](decisions/ADR-004-cross-machine-restore.md)**: Resolution adaptation, version compatibility, missing resources
