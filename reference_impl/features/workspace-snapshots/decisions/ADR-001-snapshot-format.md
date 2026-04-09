# ADR-001: Snapshot Format

> Status: **Proposed** | Created: 2026-04-04

## Context

Workspace snapshots need a persistent file format that is:
- **Shareable**: Can be sent via email, Slack, or version control without special tools
- **Portable**: Readable by different browsers/tools (not proprietary binary format)
- **Versionable**: Old snapshots remain readable as the browser evolves
- **Inspectable**: Users and developers can examine snapshot contents without specialized tools
- **Efficient**: Reasonable file size (10-200KB for typical snapshots, <10MB for "complete" fidelity)
- **Composable**: Can be merged, diffed, or inspected programmatically

Three primary options are under consideration:

1. **ZIP + JSON manifests** (recommended)
2. **Single binary blob** (SQLite or custom)
3. **Flat JSON file** (single JSON file, no directories)

---

## Decision Drivers

1. **User sharing & collaboration**: Snapshots should be email-attachable files that non-technical users understand
2. **Inspectability**: Developers should be able to `unzip` and read `manifest.json` without tools
3. **Extensibility**: Format must support future enhancements (signing, encryption, custom metadata) without breaking old readers
4. **Tool ecosystem**: ZIP + JSON plays well with existing CLI tools, version control, and diff tools
5. **Storage efficiency**: Gzip compression should keep typical snapshots under 200KB
6. **Tamper detection**: Should support optional cryptographic signing (for audit trails)

---

## Options Considered

### Option A: ZIP + JSON Manifests (Recommended)

**Description:**
A ZIP archive containing:
- `manifest.json`: Metadata (version, browser, timestamp, fidelity, tags)
- `tree.json`: Workspace tree structure (WorkspaceNode hierarchy)
- `tabs/`: Directory of JSON files (one per tab: `tab-{id}.json`)
- `mcp-apps/`: Serialized MCP app states (optional, if fidelity >= rich)
- `cookies.json`: Aggregated cookies (optional)
- `storage.json`: Aggregated localStorage (optional)
- `.signature` (optional): Cryptographic signature for tamper detection

**Example:**
```
snapshot-task-2026-04-04T143000Z.zip
├── manifest.json
├── tree.json
├── tabs/
│   ├── tab-1.json
│   ├── tab-2.json
│   └── ...
├── mcp-apps/
│   └── composed-view-1.json
└── .signature (optional)
```

**Pros:**
- **Inspectable**: `unzip` and read JSON directly; no special tools needed
- **Shareable**: `.zip` is universally supported; email, Slack, drive-share all work
- **Extensible**: Can add new directories or JSON files without breaking old readers
- **Versionable**: Git diff works on JSON; can see exactly what changed between snapshots
- **Efficient**: ZIP compression typically achieves 40-60% compression on JSON
- **Toolable**: Unix tools (unzip, jq, etc.) work out of the box
- **Signing-friendly**: Can add `.signature` file for optional cryptographic verification

**Cons:**
- **No native indexing**: If storing many snapshots, need separate index file (could use manifest registry)
- **Slight overhead**: ZIP structure adds ~1KB overhead per archive
- **Directory structure**: More files to manage (though this is also an advantage for inspectability)

**Latency:**
- Zip creation: ~100-500ms for 10-tab snapshot (depending on compression level)
- Zip reading: ~100-200ms (network latency dominates if snapshot is remote)
- Compression ratio: Typically 20-40% of uncompressed size

---

### Option B: Single Binary Blob (SQLite or Custom)

**Description:**
A single binary file (e.g., `.browser-snapshot` using SQLite or a custom binary format) containing all snapshot data in a database or packed structure.

**Example structure (SQLite):**
```
snapshot.browser-snapshot (SQLite database)
├── tables:
│   ├── metadata (capturedAt, browserVersion, fidelityLevel, tags)
│   ├── workspace_nodes (id, parentId, name, type, url, etc.)
│   ├── tab_snapshots (tabId, scroll, formData, cookies, localStorage)
│   ├── mcp_apps (appId, appState)
│   └── media (if fidelity >= complete, embedded blobs)
└── indexes on tabId, parentId for fast queries
```

**Pros:**
- **Atomic**: Single file, no risk of partial unzip
- **Queryable**: Can directly query snapshots without full deserialization
- **Efficient**: Binary format can be more compact than JSON + ZIP
- **Transaction safety**: SQLite guarantees ACID properties (snapshot writes can't corrupt partially)
- **Media-friendly**: Large binary blobs (videos, images) stored efficiently
- **Database tools**: SQLite viewers (DB Browser, command-line) available for inspection

**Cons:**
- **Not inspectable by default**: Users can't `unzip` and read; requires SQLite tools
- **Not shareable**: Binary format is opaque; harder to reason about file integrity
- **Not versionable**: Binary diffs are useless; can't use Git to compare snapshots
- **Tool friction**: Not all systems have SQLite installed; extra dependency
- **Format fragility**: Binary format is more fragile to corruption; malformed snapshots fail completely
- **No signing standard**: Signing binary blobs is non-trivial; need custom code
- **Compatibility risk**: SQLite schema changes require migration logic

**Latency:**
- SQLite write: ~50-200ms (very fast, ACID compliant)
- SQLite read: ~50-100ms (fast queries if indexed)
- Compression ratio: Better than ZIP for large binary media (but less applicable here)

---

### Option C: Flat JSON File

**Description:**
A single large JSON file containing all snapshot data (no ZIP, no directories).

**Example:**
```json
{
  "version": "1.0",
  "manifest": { ... },
  "tree": [ ... ],
  "tabs": [
    { "id": "tab-1", "url": "...", "scrollPosition": { ... }, ... },
    { "id": "tab-2", ... }
  ],
  "mcpApps": [ ... ],
  "storage": { ... }
}
```

Then optionally gzipped to `.snapshot.gz`.

**Pros:**
- **Simple**: No ZIP or binary overhead; single file
- **Inspectable**: `cat snapshot.json | jq` works; users can inspect
- **Versionable**: JSON diffs work with Git
- **Toolable**: jq, grep, sed all work
- **Human-readable**: Easier to understand at a glance

**Cons:**
- **Uncompressed size**: 50-100KB for typical snapshot (bloated vs ZIP)
- **Memory overhead**: Entire snapshot must be parsed into JSON tree at once (no streaming)
- **Streaming complexity**: Adding/removing tabs requires re-parsing entire JSON
- **Media handling**: Embedding large binary media (videos) as base64 is inefficient (~33% size overhead)
- **Directory confusion**: Single file seems simpler but has less structure for future expansion
- **Git performance**: Large JSON files can slow down Git (though typically not an issue for <10MB)

**Latency:**
- JSON serialization: ~200-500ms (slower than ZIP due to no compression)
- JSON parsing: ~200-300ms for 100KB file
- Compression ratio: gzip achieves 60-70% compression (better than ZIP but slightly larger uncompressed)

---

## Decision

**Recommended: Option A (ZIP + JSON Manifests)**

### Rationale

1. **Inspectability is critical**: Snapshots are shareable files; users need confidence they're not black boxes. `unzip` + `cat manifest.json` builds trust.

2. **Collaboration beats efficiency**: 50KB extra (vs SQLite) is negligible cost for vastly better shareability and Git compatibility. Snapshots are collaborative artifacts.

3. **Tooling ecosystem**: ZIP + JSON has the broadest ecosystem (every platform, every language). SQLite is powerful but adds a dependency; Option C (flat JSON) is less structured.

4. **Future extensibility**: Snapshots will evolve (signing, media blobs for "complete" fidelity, custom MCP app formats). ZIP structure accommodates these without breaking old readers.

5. **Signing & tamper detection**: ZIP can include optional `.signature` file for cryptographic verification without modifying the core format.

6. **User confidence**: When sharing a snapshot with a teammate, they can inspect the contents before opening it (unzip locally, vet the URLs and metadata).

### Implementation Details

**File naming convention:**
```
snapshot-{workspace-name}-{timestamp}.zip
e.g., snapshot-project-x-2026-04-04T143000Z.zip
```

**Manifest schema (manifest.json):**
```json
{
  "version": "1.0",
  "capturedAt": 1712250600000,
  "browserVersion": "131.0.0.0",
  "fidelityLevel": "standard",
  "workspaceName": "Project X",
  "tags": ["project-x", "urgent"],
  "screenResolution": { "width": 1920, "height": 1200 },
  "memoryTiers": {
    "hot": ["tab-1", "tab-2"],
    "warm": ["tab-3"],
    "cool": [],
    "cold": []
  },
  "checksum": "sha256:abc123..." (for integrity verification)
}
```

**Fidelity level metadata:**
Manifest includes `fidelityLevel` ("minimal", "standard", "rich", "complete") so that readers know what data to expect.

**Optional signing:**
If user chooses to sign snapshot, add `.signature` file:
```
.signature
{
  "algorithm": "rsa-sha256",
  "signature": "base64-encoded-signature",
  "certificate": "base64-encoded-public-key-or-cert"
}
```

Readers can optionally verify signature; unverified snapshots are still readable.

**Compression:**
Use gzip or brotli compression (ZIP standard) at level 6 (good balance of speed and size).

---

## Consequences

### Good
- **User confidence**: Snapshots are inspectable and shareable; users trust the format
- **Tooling**: `unzip`, `jq`, `git diff` all work natively
- **Extensibility**: New snapshot versions can add directories without breaking old readers (forward/backward compatibility)
- **Audit trail**: Snapshots can be versioned in Git; history is preserved
- **Collaboration**: Snapshots work well with cloud storage, email, and version control
- **Signing**: Optional cryptographic verification adds security for enterprise use cases

### Bad
- **Slight overhead**: ~1KB ZIP structure overhead per snapshot (negligible)
- **Indexed queries**: If user has 1000 snapshots, can't query them directly without unpacking
  - **Mitigation**: Maintain a separate snapshot registry index (SQLite or JSON) that lists all snapshots; users browse registry, then open snapshots on-demand
- **Streaming complexity**: Adding/removing tabs requires re-zipping
  - **Mitigation**: Snapshots are immutable after creation; editing requires capture a new snapshot

### Neutral
- **Compression trade-off**: ZIP is not optimal for large binary media (videos), but "standard" and "rich" fidelity avoid embedding media anyway
- **Single file assumption**: Users might expect snapshots to be single `.snapshot` files instead of `.zip`; branding/naming can clarify this

---

## Related Decisions

- **ADR-002 (Auth Credentials)**: Encryption of snapshots at rest is separate; ZIP format supports optional encryption via `.signature` file
- **ADR-003 (MCP App State)**: MCP apps serialize to JSON and are stored in `mcp-apps/` directory
- **Snapshot Registry**: Separate decision on indexing snapshots; registry can be SQLite for efficient querying while format remains ZIP
