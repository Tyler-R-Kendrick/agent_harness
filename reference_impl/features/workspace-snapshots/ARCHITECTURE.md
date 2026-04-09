# Architecture: Workspace Snapshots

> Status: **Draft** | Created: 2026-04-04

## System Overview

Workspace Snapshots implements a complete capture-and-restore pipeline for frozen workspace state. The system operates in two main flows: **capture** (user requests a snapshot, system freezes state) and **restore** (user opens a snapshot file, system reconstructs workspace).

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Workspace Process                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐         ┌──────────────┐      ┌──────────────┐  │
│  │   Active     │         │ Snapshot     │      │  Snapshot    │  │
│  │ Workspace    │────────▶│ Coordinator  │─────▶│  Storage &   │  │
│  │ (run state)  │         │ (capture)    │      │  Export      │  │
│  └──────────────┘         └──────────────┘      └──────────────┘  │
│                                                                      │
│  ┌──────────────┐         ┌──────────────┐      ┌──────────────┐  │
│  │ Snapshot     │         │ Restore      │      │  Workspace   │  │
│  │ File (.zip)  │────────▶│ Orchestrator │─────▶│  Rebuilder   │  │
│  └──────────────┘         │ (cross-dev)  │      │ (rehydrate)  │  │
│                           └──────────────┘      └──────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Snapshot Coordinator (Capture Path)

The capture path orchestrates the freezing of all workspace state. It runs synchronously on the main process when the user requests a snapshot.

**Responsibilities:**
- Walk the `WorkspaceNode` tree and serialize each node
- For each tab: call the renderer process to extract current state (scroll, form data, cookies, localStorage)
- Query the memory tier system to determine what state is cacheable vs what must be re-fetched
- Invoke MCP app serializer if agent-first rendering is active
- Aggregate all data into a manifest

**Input & Output:**

| Aspect | Description |
|--------|---|
| **Input** | Active workspace (tree + all tab processes) + fidelity level (minimal/standard/rich/complete) |
| **Output** | In-memory snapshot object with all serialized state |
| **Latency Target** | 10-tab workspace, standard fidelity: <2s |

**Fidelity Levels:**

| Level | Captured Data | Size | Latency |
|---|---|---|---|
| **minimal** | Tree + URLs only | <1KB | <100ms |
| **standard** | URLs + scroll, forms, localStorage | 50-200KB | 500ms-2s |
| **rich** | Standard + MCP cache, warm tier snapshots | 200KB-2MB | 2-10s |
| **complete** | Rich + full network responses, media blobs | 5MB-50MB | 10-30s |

**Algorithm:**

```
capture(workspace: WorkspaceNode, fidelity: FidelityLevel) -> SnapshotObject:
  1. serialize tree:
       walk(workspace) {
         for each node:
           - capture node metadata (id, name, type, memory tier, timestamps)
           - if type === "tab":
               - ask renderer: get current URL, title, scroll, form fields
               - ask storage: get cookies, localStorage scoped to domain
               - if fidelity >= rich and activeMemory: request MCP cache
           - add to serialized tree
       }
  2. capture per-tab state:
       for each tab in tree:
         - if fidelity >= standard:
             - scroll position from renderer
             - form data from DOM (if not already captured)
             - cookies from content storage
             - localStorage from content storage
         - if fidelity >= rich:
             - MCP app state (if active)
             - warm tier frozen DOM (if available)
  3. capture workspace metadata:
       - browser version
       - capture timestamp
       - memory tier assignments
       - user's fidelity preference
  4. aggregate into snapshot manifest
  5. compress (gzip or brotli)
```

### 2. Snapshot Serializer

Converts objects to a persistent format and vice versa. Works with the snapshot manifest to handle different fidelity levels.

**Snapshot File Format** (recommended: ZIP with JSON manifest; see ADR-001):

```
snapshot-task-2026-04-04T143000Z.zip
├── manifest.json
│   {
│     "version": "1.0",
│     "capturedAt": 1712250600000,
│     "browserVersion": "131.0.0.0",
│     "fidelityLevel": "standard",
│     "workspaceName": "task",
│     "tags": ["project-x", "urgent"],
│     "memoryTiers": {
│       "hot": ["tab-1", "tab-2"],
│       "warm": ["tab-3"],
│       "cool": ["tab-4"],
│       "cold": []
│     }
│   }
├── tree.json
│   [WorkspaceNode tree structure as JSON]
├── tabs/
│   ├── tab-1.json
│   │   {
│   │     "tabId": "tab-1",
│   │     "url": "https://example.com/project",
│   │     "title": "Project Dashboard",
│   │     "favicon": "data:image/png;base64,...",
│   │     "scrollPosition": { "x": 0, "y": 450 },
│   │     "formData": { "search": "query", "filter": "open" },
│   │     "localStorage": { "preferences": "compact-view" },
│   │     "cookies": ["session=xyz123", "user=alice"]
│   │   }
│   ├── tab-2.json
│   └── ...
├── cookies.json (shared cookies across tabs)
├── mcp-apps/
│   ├── composed-view-1.json (if MCP apps are active)
│   └── ...
└── media/ (if fidelity >= complete)
    └── [embedded images, videos, etc.]
```

**Serialization Strategy:**

- **Cookies**: Store as JSON array of `{ domain, name, value, secure, httpOnly, sameSite }`; filter out sensitive session tokens (see ADR-002)
- **Form data**: Plain JSON object; only for forms detected as "safe" (registration, search, filters; not payment forms)
- **localStorage/sessionStorage**: JSON object; scoped by domain; auto-purge tokens (see ADR-002)
- **MCP app state**: Call `serialize()` method on app object (see ADR-003)
- **Media**: For "complete" fidelity, base64-encode small images; larger blobs stored separately with checksums

### 3. Cross-Machine Bridge

Adapts snapshot data when restoring on a different OS, screen size, or browser version. Runs during the restore flow.

**Key Transformations:**

| Scenario | Adaptation |
|----------|---|
| **Different screen resolution** | Scale layout hints proportionally; reflow DOM if needed; degrade to passthrough if layout is unbearable |
| **Browser version mismatch** | Check manifest version vs current; warn user if skew is large; attempt fallback serialization |
| **OS differences** | Adjust paths in form data (e.g., `/home/user/` on Linux → `/Users/user/` on Mac); notify if file-upload fields are stale |
| **Missing external resources** | If media is not embedded and URL is unreachable, show placeholder + notice; don't block restore |
| **Expired auth tokens** | Detect session cookies; mark tabs requiring re-auth; provide hint to user |

**Algorithm (cross-machine hazard detection):**

```
detectHazards(manifest: SnapshotManifest) -> HazardReport:
  1. browser version:
       if manifest.browserVersion != currentBrowser.version:
         yield warning("Version skew: snapshot from {manifest.browserVersion},
                       restoring on {current}")
  2. screen resolution:
       manifestResolution = manifest.screenResolution or estimate from tab data
       currentResolution = currentScreen.size
       if different:
         yield warning("Resolution mismatch: {manifest} → {current}")
         scale factor = min(current.width / manifest.width, ...)
  3. auth tokens:
       for each tab:
         if hasSessionCookie(tab) and isExpired(tab.cookies):
           yield error("Re-authentication required for {tab.url}")
  4. external resources:
       if fidelityLevel < rich:
         for each tab URL:
           attempt HTTP HEAD request
           if fails:
             yield warning("Cannot reach {url}; will load on restore")

  return HazardReport { warnings, errors, scaleFactor }
```

### 4. Restore Orchestrator

Reconstructs the workspace from a snapshot file. Runs asynchronously, with progressive rendering (user sees trees/URLs immediately, state hydration in background).

**Responsibilities:**
- Read snapshot ZIP and parse manifest
- Run cross-machine bridge to detect hazards
- Rebuild the workspace tree in the tree model
- For each tab: create a new tab process, feed it snapshot data
- Restore scroll, form state, localStorage (scoped)
- Restore MCP app state if available
- Restore memory tier assignments (re-promote to hot/warm as needed)
- Display any hazard warnings (auth required, resolution mismatch, etc.)

**Restore Latency Profile:**

```
Phase 1 (Instant, <100ms):
  - Unzip and parse manifest
  - Rebuild tree UI (users see skeleton)

Phase 2 (Fast, 500ms-2s):
  - Create tab processes for URLs
  - Start Chromium page loads
  - Inject scroll positions

Phase 3 (Background, 2-10s):
  - Populate form data via JavaScript
  - Restore localStorage
  - Re-inject relevant cookies
  - Reconstruct MCP app cache

Phase 4 (Optional, 10s+):
  - Re-download missing media
  - Re-parse pages if fidelity < rich
  - Trigger agent reasoning for MCP composition
```

**Algorithm:**

```
restore(snapshotFile: File, restoreMode: "read-only" | "active" | "template") -> WorkspaceNode:
  1. read and parse:
       manifest = unzip(snapshotFile).manifest.json
       tree = unzip(snapshotFile).tree.json
       hazards = detectHazards(manifest, currentEnvironment)
       if hazards.errors.length > 0:
         throw RestoreError with hazard report

  2. show hazard warnings (UI modal if any warnings exist)

  3. rebuild tree:
       workspace = deserializeTree(tree, manifest)
       addWorkspaceToStore(workspace)

  4. create tabs (streaming):
       for each tab in manifest.tabs:
         - createTabProcess(tab.url)
         - enqueueStateRestore(tab.id, tabSnapshot)

  5. restore state (background):
       for each tab snapshot:
         - inject scrollPosition (JavaScript)
         - inject formData (JavaScript)
         - inject localStorage (JavaScript)
         - inject cookies (content API)
         - restore MCP app cache (if fidelity >= rich)

  6. restore memory tiers:
       for each tab in manifest.memoryTiers:
         setMemoryTier(tab.id, manifest.memoryTiers[tab])

  7. signal completion:
       emit "workspace restored" event
```

### 5. Storage Backend

Persistent storage for snapshots. Can be local (file system), cloud-synced, or both.

**Storage Options:**

| Backend | Pros | Cons | Use Case |
|---------|------|------|----------|
| **File system** (local) | Fast, private, no sync overhead | Manual export/import for sharing; no cross-device sync | Individual user, local archive |
| **IndexedDB** (browser) | Scoped to origin, good for <100MB | Sync not built-in; quota limits | Backup within same browser |
| **Cloud sync** (Dropbox, iCloud, OneDrive) | Cross-device, shareable, backed-up | Network latency, storage cost, privacy concerns | Team collaboration, backup |
| **Custom server** | Full control, querying, timeline UI | Engineering cost, hosting cost, privacy burden | Enterprise deployment |

**Recommended default: File system + manual export/import** (user controls what's shared).

### 6. MCP App Serializer (if Agent-First Rendering is Active)

Serializes MCP app state so that composed views can be restored without re-parsing.

**Inputs:** MCP app instance (from agent-first rendering system)

**Outputs:** JSON representation of app structure and state

**Strategy:**
- Call `toJSON()` method on app object (interface contract; see ADR-003)
- Store in `mcp-apps/` directory in snapshot
- On restore, deserialize and pass to MCP App Engine

**Error handling:** If MCP app cannot serialize, fall back to "re-compose on restore" (re-run agent reasoning when tab is accessed).

---

## Data Flow: Capture

```
User clicks "Save Snapshot"
  ↓
Snapshot Coordinator captures:
  - Workspace tree (walk WorkspaceNode)
  - Per-tab state (renderer → scroll, form, cookies, localStorage)
  - MCP app cache (if present)
  - Memory tier assignments
  ↓
Snapshot Serializer:
  - Filters/redacts sensitive data (tokens, passwords)
  - Compresses (gzip)
  - Creates ZIP archive with manifest + tabs/ + mcp-apps/ directories
  ↓
Export prompt:
  - "Save snapshot-{name}-{timestamp}.zip"
  - Or upload to cloud storage
  ↓
Snapshot file written to disk
```

---

## Data Flow: Restore

```
User opens snapshot file
  ↓
Restore Orchestrator reads ZIP:
  - Parse manifest
  - Run cross-machine bridge (detect hazards)
  ↓
User approves restore (see hazard warnings)
  ↓
Restore flow (streaming):
  Phase 1: Rebuild tree UI (immediate)
  Phase 2: Create tab processes, start page loads
  Phase 3: Inject scroll, form data, localStorage (background)
  Phase 4: Restore MCP app cache (if available)
  ↓
Workspace tree reconstructed with all tabs live
  ↓
User can interact immediately; state hydration continues in background
```

---

## Integration Points

### With Workspace Model

- Uses `WorkspaceNode` and `WorkspaceSnapshot` interfaces directly
- Respects `persisted` and `activeMemory` flags
- Preserves `memoryTier` assignments during capture/restore

### With Memory Tier System

- **Capture**: Reads the memory tier of each node to determine what state is cached vs must be re-fetched
- **Restore**: Restores tier assignments; e.g., `hot`-tier tabs are re-promoted before `cool`-tier tabs
- **Warm tier**: Leverages frozen DOM snapshots already present in warm tier to reduce re-parse cost

### With Agent-First Rendering

- **Capture**: Serializes MCP app state via app's `toJSON()` method
- **Restore**: Deserializes and injects back into MCP App Engine (skips re-parsing and re-reasoning for that tab)
- **Fidelity impact**: Rich and complete fidelity levels include MCP app cache

### With Persistence Layer

- Snapshots use the same serialization infrastructure as workspace bookmarks (cookies, form data scoping)
- Snapshots are optionally indexed in the bookmark library (discoverable in tree UI)

### With History System

- Snapshots can optionally create a "timeline" of workspace checkpoints
- Browser can auto-create snapshots on certain events (before major navigation, on browser close, etc.)

---

## Security Model

Snapshots introduce new security considerations:

**Auth Token Leakage:**
- Session cookies, localStorage tokens can be sensitive
- **Mitigations**: Filter tokens at capture time; encrypt snapshots in transit; mark snapshots as potentially sensitive; warn users before sharing (see ADR-002)

**Credential Harvesting:**
- Form data may include passwords or API keys if user entered them
- **Mitigation**: Do not capture form data by default; users must opt in to "complete" fidelity; warn before saving "complete" snapshots

**Cross-Origin Data Leakage:**
- Cookies and localStorage are scoped by domain; snapshots respect these boundaries
- **Mitigation**: Only include cookies/storage for domains present in snapshot tabs; validate scoping at restore time

**Malicious Snapshots:**
- A crafted snapshot file could exploit the unzip/deserialization process
- **Mitigations**: Validate ZIP structure and manifest schema before processing; sandboxed deserialization; limit file size (e.g., max 100MB)

**Privacy:**
- Snapshots contain user's browsing history (URLs) and activity (form input)
- **Mitigations**: Snapshots are stored locally by default; cloud sync is opt-in; users can delete snapshots anytime; no tracking of snapshot usage

---

## Open Questions

1. **Auto-snapshot frequency**: Should the browser auto-create snapshots before major navigations? At regular intervals? Only on user request?
   - **Note**: See ADR-002 (auth handling) for related discussion of sensitive snapshot content

2. **Snapshot naming**: Should users manually name snapshots, or auto-generate names from workspace content (e.g., "Project X - 3 tabs - 2026-04-04")?

3. **Cross-origin iframe state**: How do we capture state inside iframes that are cross-origin? Can't access their DOM/storage.
   - **Candidate solution**: Capture iframe URL and sandbox flags; on restore, re-load iframe (state lost but structure preserved)

4. **Network API state**: Should we capture in-flight network requests or async operations?
   - **Candidate solution**: Capture only completed state (not in-flight requests); re-trigger on restore if needed

5. **Snapshot diffing**: Can we show users a visual diff between two snapshots ("what changed since this checkpoint")?
   - **Candidate solution**: Keep a manifest history per snapshot; compute diffs on-demand

6. **Snapshot encryption**: Should snapshots be encrypted by default? Should users be able to password-protect snapshots for sharing?
   - **Related to ADR-002**: Encryption could mitigate credential leakage if snapshots are intercepted in transit

7. **Snapshot signing**: Should we cryptographically sign snapshots to prevent tampering? Needed for enterprise use cases?
   - **Candidate solution**: Optional; users can sign snapshots with their key for audit trail

8. **Snapshot collaboration**: Should multiple users be able to edit a snapshot together (real-time sync)? Or just import/export?
   - **Candidate solution**: Start with import/export; sync is future work
