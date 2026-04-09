# ADR-003: MCP App State Capture Strategy

> Status: **Proposed** | Created: 2026-04-04

## Context

The agent-first rendering system can generate MCP (Model Context Protocol) apps — dynamically created interfaces that replace or compose raw web pages. An MCP app has internal state:

- **Scroll position in composed view**: User has scrolled to a specific section of a multi-tab composed view
- **Selection state**: User has selected a specific PR, ticket, or card within the app
- **Filter/sort state**: User has applied filters or sorting that changed the visible data
- **Rendering cache**: Parsed content, thumbnails, or previews cached by the MCP app
- **Interaction history**: User's actions within the app (breadcrumbs, undo stack)

**Core question**: When capturing a snapshot, should we serialize MCP app state so that the composed view is restored exactly as the user saw it? Or should we capture only the source tabs and let the MCP app be re-generated on restore?

**The tension:**

- **Include MCP state** (fidelity >= "rich"): Composed views restore instantly without re-parsing/re-reasoning. Ideal for snapshots as "time capsules" (what did the interface look like at this moment?). But MCP apps are dynamically generated; serialization may be fragile.

- **Exclude MCP state** (fidelity <= "standard"): Snapshots are simpler and more durable; MCP apps are always re-generated on restore. But users lose scroll position and interaction state within composed views (frustrating UX).

---

## Decision Drivers

1. **Fidelity of restore**: Users expect snapshots to be "time capsules" of workspace state; losing MCP app state contradicts this
2. **Durability across versions**: MCP app format may change between browser versions; old app serializations must remain readable
3. **MCP app complexity**: Some MCP apps are expensive to generate (LLM inference, multi-source composition); caching them is valuable
4. **Developer friction**: Not all MCP apps will implement serialization; we need graceful fallback
5. **Snapshot size**: Serialized MCP app state could be large (especially with caches); impacts "standard" vs "rich" fidelity split

---

## Options Considered

### Option A: Interface Contract (Recommended)

**Description:**
Define a standard `SerializableApp` interface that MCP apps can implement. Apps that implement it are serialized; apps that don't fall back to re-generation on restore.

```typescript
interface SerializableApp {
  // Serialize the app's current state to a JSON-serializable object
  toJSON(): AppSnapshot;

  // Restore from a snapshot; rebuild internal state
  fromJSON(snapshot: AppSnapshot): void;

  // Declare what version of serialization this app uses
  serializationVersion: string;

  // Estimate size of serialized state (for fidelity level decision)
  estimateSize(): number;
}

interface AppSnapshot {
  version: string;
  type: string;  // e.g., "composed-pr-review", "multi-source-search"
  scrollPosition: { x: number; y: number };
  state: Record<string, any>;  // App-specific state
  cache?: Record<string, any>;  // Optional: cached data
  timestamp: number;
}
```

**Capture behavior:**
```
Snapshot Coordinator:
  for each tab in workspace:
    if tab has active MCP app:
      if app implements SerializableApp:
        size = app.estimateSize()
        if (fidelityLevel >= "rich" && size < maxSize):
          snapshot = app.toJSON()
          store in mcp-apps/{appId}.json
        else:
          skip serialization (will re-generate on restore)
      else:
        skip serialization (no toJSON method)
```

**Restore behavior:**
```
Restore Orchestrator:
  for each tab in snapshot:
    if snapshot has mcp-apps/{appId}.json:
      appSnapshot = load from zip
      // Check if app type is still supported
      if browser supports app type from appSnapshot.version:
        try:
          app = MCP App Engine.createApp(appSnapshot.type)
          app.fromJSON(appSnapshot)
          attach app to tab
        catch error:
          log warning, fall back to re-generation
      else:
        log warning (app format no longer supported), re-generate
    else:
      // No serialized app; re-generate via agent reasoning
      tab.regenerateMCPApp()
```

**Pros:**
- **Graceful degradation**: Apps that don't implement serialization still work (just re-generate)
- **Durable**: Apps control their own serialization; can change format between versions
- **Opt-in for developers**: Not all MCP apps need to support serialization; complex ones can, simple ones don't
- **Version-aware**: Each app snapshot declares its format version; can support multiple versions
- **Size control**: Apps declare estimated size; coordinator can make fidelity decisions
- **Testable**: Each app's `toJSON()` and `fromJSON()` can be tested independently
- **Flexible**: Apps can decide what state to serialize (some may skip large caches)

**Cons:**
- **Implementation burden**: Developers must implement `toJSON()` and `fromJSON()` for each app type
- **Versioning complexity**: As app format evolves, must handle old format migrations
- **Incomplete state**: Some app state may be transient (e.g., pending network requests); can't be serialized
- **Testing gaps**: If app's deserialization is buggy, restore fails
- **Size estimation guessing**: Apps must estimate size before serializing (could be inaccurate)

---

### Option B: Best-Effort Serialization

**Description:**
Automatically serialize MCP app state by introspecting the app object: walk its properties, convert to JSON, and store. No interface required; works for any app.

**Capture:**
```
SnapshotCoordinator.serializeApp(app):
  let snapshot = {}
  for each property of app:
    if property is JSON-serializable (primitive, object, array):
      snapshot[property] = app[property]
    else if property is DOM node:
      snapshot[property] = null  // Skip DOM nodes
    else if property is function:
      snapshot[property] = null  // Skip functions
  return snapshot
```

**Restore:**
```
RestoreOrchestrator.deserializeApp(appSnapshot):
  app = new MCPApp()
  for each property in snapshot:
    app[property] = snapshot[property]
  return app
```

**Pros:**
- **Zero developer friction**: Works for any MCP app; no interface to implement
- **Automatic**: Snapshot system handles serialization; developers don't need to code it
- **Inclusive**: All apps get serialization benefit, even if they don't explicitly support it
- **Quick to implement**: Introspection is straightforward

**Cons:**
- **Brittle**: Works only if app has simple state; nested objects or circular references break
- **Incomplete**: Transient state (network requests, timers, event listeners) can't be serialized; app may break on restore
- **Unpredictable**: Different app versions may have different property shapes; old snapshots may not deserialize cleanly
- **No version control**: No way to declare "this snapshot uses app format version X"
- **Debugging nightmare**: If app state deserialization breaks silently, hard to diagnose
- **Not type-safe**: No type checking; snapshot restoration can inject wrong types and crash app
- **Large snapshots**: Introspection may capture unnecessary state (debugging info, caches) that inflates snapshot size

---

### Option C: Source-Only Snapshots (No MCP State)

**Description:**
Never serialize MCP app state. Snapshots capture only source tabs (URLs, scroll, form data). MCP apps are always re-generated on restore.

**Capture:**
```
Skip MCP app serialization entirely.
Store only tab snapshots (URL, scroll, form, storage).
```

**Restore:**
```
Restore tabs from snapshot.
MCP apps are regenerated via agent reasoning (if applicable).
```

**Pros:**
- **Simplest implementation**: No serialization logic needed
- **Most durable**: Snapshots don't depend on MCP app format; format can change freely
- **Smallest snapshots**: No MCP app state overhead
- **Re-generation benefit**: MCP apps are re-generated with fresh data; may fix bugs or reflect changes in source pages

**Cons:**
- **Loss of app state**: User's scroll position, selections, and filters in composed views are lost
- **Expensive restore**: MCP app generation (parsing + reasoning) happens on every restore; slow
- **Poor time-capsule experience**: Snapshot is not a faithful copy of workspace state; composition may differ
- **Latency impact**: Restoring "rich" fidelity snapshot takes longer because apps are re-generated
- **User frustration**: "Why did my composed view change? I saved a snapshot..."
- **Conceptual mismatch**: Workspace Snapshots are meant to freeze workspace state; omitting MCP state contradicts the model

---

## Decision

**Recommended: Option A (Interface Contract)**

### Rationale

1. **Fidelity is a core value proposition**: Workspace Snapshots are marketed as "time capsules" of workspace state. Omitting MCP app state undermines this.

2. **Graceful degradation is essential**: Not all MCP apps need to serialize immediately. Simple apps can use re-generation; complex apps (composed views, caches) can implement serialization.

3. **Developer control**: Developers know their app best; they should decide what state is serializable and how to version format changes.

4. **Version awareness**: As browser evolves, MCP app formats will change. Each snapshot declares which version it uses; restore can handle migrations gracefully.

5. **Testing opportunity**: Each MCP app's serialization can be tested independently, catching bugs early.

6. **Opt-in for size**: Apps can estimate size and decline serialization if too large (keeping snapshot under fidelity threshold).

### Implementation Details

**SerializableApp interface (TypeScript):**

```typescript
/**
 * Optional interface for MCP apps that support serialization.
 * Apps implementing this can be snapshot-restored with full state preservation.
 * Apps not implementing this are re-generated on restore (fallback behavior).
 */
interface SerializableApp {
  /**
   * Serialize the app's current state to a JSON-safe object.
   * @returns AppSnapshot object, must be JSON.stringify-safe
   */
  toJSON(): AppSnapshot;

  /**
   * Restore the app's state from a previously serialized snapshot.
   * Called after app is instantiated; should rebuild internal state.
   * @throws If snapshot format is unsupported or corrupted
   */
  fromJSON(snapshot: AppSnapshot): void;

  /**
   * Declare serialization format version for this app.
   * Used to handle format migrations across browser versions.
   * E.g., "1.0", "2.0-with-caching"
   */
  readonly serializationVersion: string;

  /**
   * Estimate the serialized size in bytes.
   * Used to decide whether to include in snapshot (fidelity level budget).
   * @returns Approximate size; can be rough estimate
   */
  estimateSize(): number;
}

/**
 * Snapshot of a single MCP app's state.
 * Stored in snapshot ZIP as mcp-apps/{appId}.json
 */
interface AppSnapshot {
  version: string;  // serializationVersion from app
  type: string;     // App type identifier: "composed-pr-review", "multi-search", etc.
  timestamp: number;  // When snapshot was captured
  scrollPosition: { x: number; y: number };  // Always capture scroll
  state: Record<string, any>;  // App-specific state (selections, filters, etc.)
  cache?: Record<string, any>;  // Optional: cached data if app wants to preserve it
  metadata?: {
    browserVersion: string;
    appVersion?: string;  // Semantic version of app code
  };
}
```

**Capture algorithm:**

```typescript
async function captureApp(app: any, fidelityLevel: FidelityLevel): Promise<AppSnapshot | null> {
  // Check if app implements SerializableApp interface
  if (!isSerializable(app)) {
    return null;  // Will re-generate on restore
  }

  const estimatedSize = app.estimateSize();
  const maxSize = fidelityLevel === "rich" ? 1024 * 1024 : 512 * 1024;  // 1MB (rich), 512KB (standard)

  if (estimatedSize > maxSize) {
    console.warn(`App serialization size ${estimatedSize} exceeds limit for fidelity ${fidelityLevel}`);
    return null;  // Skip serialization; will re-generate
  }

  try {
    const snapshot = app.toJSON();
    validateAppSnapshot(snapshot);  // Type checking
    return snapshot;
  } catch (error) {
    console.warn(`App serialization failed:`, error);
    return null;  // Fallback to re-generation
  }
}

function isSerializable(app: any): boolean {
  return typeof app?.toJSON === 'function' &&
         typeof app?.fromJSON === 'function' &&
         app?.serializationVersion !== undefined;
}
```

**Restore algorithm:**

```typescript
async function restoreApp(appSnapshot: AppSnapshot, appId: string): Promise<MCP App | null> {
  // Get app factory from app registry
  const appFactory = mcpAppRegistry.getFactory(appSnapshot.type);
  if (!appFactory) {
    console.warn(`Unknown MCP app type: ${appSnapshot.type}; will skip restoration`);
    return null;  // App type no longer supported; will re-generate
  }

  // Create a fresh app instance
  const app = appFactory.create();

  // Check version compatibility
  if (!appFactory.supportsVersion(appSnapshot.version)) {
    console.warn(
      `App snapshot version ${appSnapshot.version} not supported by current app (v${appFactory.currentVersion})`
    );
    // Attempt migration if available
    if (appFactory.migrate) {
      appSnapshot = appFactory.migrate(appSnapshot);
    } else {
      return null;  // Can't migrate; will re-generate
    }
  }

  // Restore state
  try {
    app.fromJSON(appSnapshot);
    app.scrollPosition = appSnapshot.scrollPosition;  // Restore scroll
    return app;
  } catch (error) {
    console.warn(`App deserialization failed:`, error);
    return null;  // Fallback to re-generation
  }
}
```

**Example MCP app implementation:**

```typescript
class ComposedPRReviewApp implements SerializableApp {
  readonly serializationVersion = "1.0";

  // Internal state
  private selectedPRId: string = "";
  private filters: FilterSet = new FilterSet();
  private scrollPosition: { x: number; y: number } = { x: 0, y: 0 };
  private parseCache: Map<string, ParsedPage> = new Map();

  toJSON(): AppSnapshot {
    return {
      version: this.serializationVersion,
      type: "composed-pr-review",
      timestamp: Date.now(),
      scrollPosition: this.scrollPosition,
      state: {
        selectedPRId: this.selectedPRId,
        filters: this.filters.toJSON(),
      },
      cache: {
        // Include cache to avoid re-parsing on restore
        parseCache: Array.from(this.parseCache.entries()).map(([url, parsed]) => ({
          url,
          parsed: parsed.toJSON(),
        })),
      },
    };
  }

  fromJSON(snapshot: AppSnapshot): void {
    this.selectedPRId = snapshot.state.selectedPRId;
    this.filters.fromJSON(snapshot.state.filters);
    this.scrollPosition = snapshot.scrollPosition;

    if (snapshot.cache?.parseCache) {
      this.parseCache = new Map(
        snapshot.cache.parseCache.map(({ url, parsed }: any) => [
          url,
          ParsedPage.fromJSON(parsed),
        ])
      );
    }
  }

  estimateSize(): number {
    // Rough estimate: base + per-cache-entry
    return 5000 + (this.parseCache.size * 50000);  // Base 5KB + 50KB per cached page
  }
}
```

**Manifest tracking:**

Store in snapshot's `manifest.json`:
```json
{
  "mcp_apps": [
    {
      "appId": "composed-pr-review-1",
      "type": "composed-pr-review",
      "version": "1.0",
      "size": 120000
    }
  ]
}
```

---

## Consequences

### Good
- **Fidelity preserved**: MCP app state is serialized; composed views restore with scroll position, selections, and filters intact
- **Performance benefit**: MCP app cache is preserved; no re-parsing or re-reasoning needed on restore (if snapshot is "rich" fidelity)
- **Developer flexibility**: Apps can choose what state to serialize; simple apps don't need to implement anything
- **Version-safe**: Each app declares serialization version; can handle migration gracefully
- **Graceful fallback**: If app doesn't support serialization or old format is incompatible, system falls back to re-generation (not failure)

### Bad
- **Implementation burden**: Developers must implement `toJSON()` and `fromJSON()` for each MCP app
- **Version maintenance**: As apps evolve, developers must handle migrations (e.g., v1.0 → v2.0 format)
- **Testing complexity**: Serialization bugs can only be caught through integration testing
- **Size overhead**: "Rich" fidelity snapshots include MCP app cache; could be 500KB-2MB per snapshot
- **Snapshot staleness**: Cached parse data may be out of sync if source pages change between capture and restore

### Neutral
- **Complexity increase**: Snapshot format is more complex (includes optional mcp-apps/ directory)
- **Documentation burden**: Need to document interface and example implementations for app developers

---

## Future Extensions

1. **App version migration**: Define `migrate(snapshot: AppSnapshot, fromVersion: string, toVersion: string)` method for handling format changes
2. **Incremental restore**: Restore app structure immediately, re-generate cache in background
3. **Snapshot diffing**: Compare two snapshots' MCP app states to show "what changed"
4. **App registry versioning**: Track which app versions are installed; warn if snapshot uses incompatible version

---

## Related Decisions

- **ADR-001 (Snapshot Format)**: MCP apps serialize to JSON files stored in `mcp-apps/` directory within ZIP
- **ADR-002 (Auth Credentials)**: Apply same credential filtering to MCP app state as to tabs
- **ARCHITECTURE.md (Fidelity Levels)**: "Rich" fidelity includes MCP app cache; "standard" typically skips it (unless cache is small)
