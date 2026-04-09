# ADR-004: Cross-Machine Restore Strategy

> Status: **Proposed** | Created: 2026-04-04

## Context

A user captures a workspace snapshot on MacBook Pro (1920x1200, Chrome 131, macOS 14) then tries to restore it on a Linux laptop (1366x768, Chrome 130, Ubuntu 24.04). This introduces several compatibility hazards:

1. **Screen resolution mismatch**: Layout hints (fixed widths, viewport assumptions) may not translate
2. **Browser version skew**: APIs, CSS features, or rendering behavior may differ
3. **OS-specific paths**: Form data or file input fields may contain paths (`/Users/alice/` → `/home/alice/`)
4. **Missing resources**: External images, fonts, or API endpoints may be unreachable or different
5. **Auth token expiry**: Session cookies captured on MacBook 2 hours ago are now expired
6. **Extension state**: Some MCP apps may rely on extensions that aren't installed on the target device

**Design question**: How aggressively should the restore system adapt snapshot data to the target environment? Should it fail loudly (catch incompatibilities and warn the user) or adapt silently (best-effort resolution scaling)?

---

## Decision Drivers

1. **Portability is core value**: Cross-machine restore is a major differentiator for Workspace Snapshots; must work reasonably well
2. **Graceful degradation**: Restore should not fail hard; must provide warnings but still produce a usable workspace
3. **User control**: Users should be aware of hazards (resolution change, version mismatch, auth issues) so they can manually fix them if needed
4. **Automation vs manual**: Some hazards can be fixed automatically (resolution scaling); others need user action (re-auth)
5. **No data loss**: Restore should never corrupt or delete data to make it "compatible"

---

## Options Considered

### Option A: Permissive Auto-Adaptation (Recommended)

**Description:**
Restore system automatically adapts snapshot data for the target environment. Hazards are detected and shown to the user, but restore proceeds (sometimes degraded). User can manually fix issues post-restore.

**Adaptation logic:**

| Hazard | Auto-Adaptation | User Warning |
|--------|---|---|
| **Resolution mismatch** | Scale layout hints proportionally | Info: "Snapshot was 1920x1200; current display is 1366x768" |
| **Browser version** | Use snapshot if version >= min supported; else warn | Warning: "Snapshot from Chrome 131; you have 130. Some features may not work." |
| **Missing resources** | Attempt load on-demand; show placeholder if fails | Warning: "Could not load image from original domain; will try when you click" |
| **Expired auth tokens** | Don't restore tokens; let user re-auth | Error: "Tab requires re-authentication" |
| **OS-specific paths** | Map paths intelligently (e.g., `/home/` vs `/Users/`) | Info: "Some file paths were adjusted for this OS" |
| **Extension state** | Fall back to re-generation if extension is missing | Warning: "MCP app requires extension X; not found. Re-generating..." |

**Restore flow:**

```
User opens snapshot on different machine:
  1. Hazard detection:
       - Check browser version
       - Check screen resolution
       - Scan form data for paths, check auth cookies
       - Validate MCP app dependencies
  2. Display hazard report:
       - Info: "Restoring snapshot captured on Mac 1920x1200 (Chrome 131)"
       - Warnings: "Resolution is different, browser version differs, re-auth needed"
       - Errors: None (proceed anyway)
  3. User clicks "Restore Anyway" or "Review Details"
  4. Restore proceeds with adaptations:
       - Scale layout hints
       - Adjust paths
       - Warn on auth-required tabs
       - Skip re-generation of MCP apps if version OK
  5. Workspace is reconstructed with best-effort state
  6. User sees warnings in tab headers: "[⚠️ Re-auth]", "[Adjusted layout]"
```

**Pros:**
- **Permissive**: Users can restore snapshots across machines without friction
- **Aware**: Users are informed of hazards; not surprised when auth fails or layout is off
- **Pragmatic**: Auto-adapts what can be adapted (resolution, paths); defers what needs manual action (re-auth)
- **No data loss**: Restore never deletes or mangles data to achieve compatibility
- **User agency**: Warnings empower users to fix issues if needed
- **Portable**: Makes cross-machine snapshots a reliable feature

**Cons:**
- **Silent failures possible**: Some auto-adaptations may degrade layout or functionality without user noticing
- **Surprise incompatibilities**: User may not read hazard report; restores snapshot expecting it to work, then discovers issues
- **Partial state**: Some tabs work, others don't; inconsistent experience
- **Debugging difficulty**: If adaptation breaks something, hard to diagnose (was it resolution scaling? version mismatch? missing resources?)

---

### Option B: Strict Compatibility Checking

**Description:**
Detect all incompatibilities and block restore if hazards are too severe. Only allow restore if:
- Browser version matches or is newer than snapshot
- Screen resolution is within 10% of original
- No critical resources are missing
- Auth tokens are fresh (< 1 hour old)

**Restore flow:**

```
User opens snapshot on different machine:
  1. Compatibility check:
       if browser version < snapshot.minVersion:
         throw IncompatibleBrowserError
       if abs(currentResolution - snapshotResolution) > 10%:
         throw IncompatibleResolutionError
       if missingCriticalResources:
         throw MissingResourcesError
       if authTokensExpired:
         throw ReAuthRequiredError
  2. If all checks pass:
       Restore proceeds
  3. If any check fails:
       Display error: "Cannot restore: browser version mismatch"
       User must update browser or restore on original machine
```

**Pros:**
- **Predictable**: No surprises; restore either works completely or fails clearly
- **No silent failures**: User can't end up with broken workspace without knowing it
- **Debugging simple**: If restore fails, reason is explicit
- **Safety-first**: Avoids "restore succeeded but broke things" scenarios

**Cons:**
- **Fragility**: Strict rules may block restorable snapshots unnecessarily
- **Poor UX**: User can't restore snapshot on their current device; must update browser, change resolution, or use original machine
- **Defeats portability**: Cross-machine snapshots become unusable (original design goal lost)
- **Unrealistic version requirements**: Browser versions evolve faster than user upgrades; blocking on exact version is too strict
- **Auth blocker**: Any snapshot with active tokens becomes invalid after a few hours; defeats purpose of cross-device snapshots

---

### Option C: Explicit User Approval with Detailed Report

**Description:**
Show detailed compatibility report to user; require explicit approval before proceeding. Report includes:
- All detected hazards (severity level)
- What will be auto-adapted vs what requires manual action
- Estimated "restore quality" score (0-100)
- Recommendations ("Update browser", "Re-login", "Resize window")

**Restore flow:**

```
User opens snapshot:
  1. Scan for hazards
  2. Generate detailed report:
       - Browser: Chrome 130 (snapshot: 131) — Warning: minor version diff
       - Resolution: 1366x768 (snapshot: 1920x1200) — Layout will scale
       - Auth: 2 tabs require re-login
       - Resources: All images reachable
       - Estimate: 85% restore quality
  3. Show modal:
       "Compatibility Report"
       [Details ▼]
       [⚠️ Some features may not work as expected]
       [Re-auth needed for 2 tabs]
       [Recommend: Update browser, re-login after restore]
       [❌ Cancel]  [⚠️ Restore with Cautions]
  4. If user clicks "Restore with Cautions":
       Proceed with auto-adaptations
  5. If user clicks "Cancel":
       Don't restore; show tips for manual restore or updating
```

**Pros:**
- **Informed consent**: User makes deliberate choice; not surprised by hazards
- **Transparency**: Detailed report explains exactly what's different
- **Guidance**: Recommendations help user fix issues
- **Quality estimate**: Score helps user judge "is this restore likely to work?"
- **Opt-in risk**: Users who understand risks can proceed; cautious users can cancel
- **Flexible**: Accommodates both strict and permissive users

**Cons:**
- **Modal fatigue**: Every cross-machine restore shows long compatibility report (friction)
- **Decision paralysis**: Non-technical users may not understand report; unsure whether to proceed
- **UX overhead**: Extra dialog adds latency to restore flow
- **Incomplete info**: Estimating "restore quality" is subjective; hard to quantify accurately
- **Still has failures**: User approves restore, but auto-adaptations don't work perfectly (resolution scaling breaks layout)

---

## Decision

**Recommended: Option A (Permissive Auto-Adaptation) with Option C's reporting layer**

### Rationale

1. **Portability is core value proposition**: Workspace Snapshots are marketed as cross-machine portable. Blocking restore on version mismatch or resolution difference undermines this.

2. **Users can fix issues**: Restore doesn't need to be perfect on first try. Users can manually re-auth, adjust layout, or manually fix data. Perfect is enemy of good.

3. **Transparency builds trust**: Showing detailed hazard report (from Option C) gives users visibility and control. They understand why some things don't work and can fix them if needed.

4. **Auto-adapt what's fixable**: Resolution scaling, path mapping, and version compatibility can be handled automatically without user friction. Auth and resources need manual action.

5. **Real-world usage**: Most cross-machine restores are within 1-2 browser versions and similar resolutions. Strict checking would block most of these unnecessarily.

### Implementation Details

**Hazard Detection (at restore time):**

```typescript
interface HazardReport {
  severity: "info" | "warning" | "error";
  hazards: Hazard[];
  qualityScore: number;  // 0-100 estimate
  recommendations: string[];
}

interface Hazard {
  type: "version" | "resolution" | "auth" | "resources" | "extensions" | "paths";
  severity: "info" | "warning" | "error";
  message: string;
  autoAdapted?: boolean;
  action?: string;  // What user should do
}

function detectHazards(
  snapshot: SnapshotManifest,
  currentEnvironment: Environment
): HazardReport {
  const hazards: Hazard[] = [];
  let qualityScore = 100;

  // Browser version check
  if (currentEnvironment.browserVersion < snapshot.browserVersion) {
    hazards.push({
      type: "version",
      severity: "warning",
      message: `Snapshot from Chrome ${snapshot.browserVersion}; you have ${currentEnvironment.browserVersion}`,
      autoAdapted: true,
      action: "Consider updating your browser for best compatibility"
    });
    qualityScore -= 5;
  }

  // Resolution check
  const resolutionDiff = Math.abs(
    currentEnvironment.screenWidth - snapshot.screenWidth
  ) / snapshot.screenWidth;
  if (resolutionDiff > 0.2) {  // > 20% difference
    hazards.push({
      type: "resolution",
      severity: "warning",
      message: `Resolution: ${snapshot.screenWidth}x${snapshot.screenHeight} → ${currentEnvironment.screenWidth}x${currentEnvironment.screenHeight}`,
      autoAdapted: true,
      action: "Layout will scale; some elements may be cramped or overflow"
    });
    qualityScore -= 10;
  }

  // Auth tokens
  for (const tab of snapshot.tabs) {
    if (hasExpiredAuthCookies(tab)) {
      hazards.push({
        type: "auth",
        severity: "error",
        message: `Tab ${tab.url} requires re-authentication`,
        autoAdapted: false,
        action: "You'll need to log back in"
      });
      qualityScore -= 20;
    }
  }

  // Missing resources
  const unreachableUrls = checkResourceReachability(snapshot);
  if (unreachableUrls.length > 0) {
    hazards.push({
      type: "resources",
      severity: "warning",
      message: `${unreachableUrls.length} resources unreachable (images, fonts, etc.)`,
      autoAdapted: true,
      action: "Will load on-demand; may show placeholders initially"
    });
    qualityScore -= 5;
  }

  // OS-specific paths
  if (snapshotHasFilePaths(snapshot) && currentEnvironment.os !== snapshot.os) {
    hazards.push({
      type: "paths",
      severity: "info",
      message: `OS changed from ${snapshot.os} to ${currentEnvironment.os}; adjusting file paths`,
      autoAdapted: true,
      action: "File paths will be mapped intelligently"
    });
  }

  // Extensions/MCP dependencies
  for (const app of snapshot.mcpApps) {
    if (app.requiresExtension && !isExtensionInstalled(app.requiresExtension)) {
      hazards.push({
        type: "extensions",
        severity: "warning",
        message: `MCP app "${app.type}" requires extension "${app.requiresExtension}"; not found`,
        autoAdapted: true,
        action: `App will be re-generated; you can install extension later`
      });
      qualityScore -= 10;
    }
  }

  return {
    severity: hazards.some(h => h.severity === "error") ? "error" : "warning",
    hazards,
    qualityScore: Math.max(0, qualityScore),
    recommendations: generateRecommendations(hazards, currentEnvironment)
  };
}

function generateRecommendations(hazards: Hazard[], env: Environment): string[] {
  const recommendations = [];
  if (hazards.some(h => h.type === "version")) {
    recommendations.push(`Update to Chrome ${env.recommendedVersion} for best compatibility`);
  }
  if (hazards.some(h => h.type === "auth")) {
    recommendations.push("Plan to re-login after restore");
  }
  if (hazards.some(h => h.type === "resolution")) {
    recommendations.push("You may need to adjust layout or window size");
  }
  return recommendations;
}
```

**Hazard Report UI Modal:**

```
┌─────────────────────────────────────────────────────┐
│  Compatibility Report: Restore Snapshot             │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Snapshot: "Project X" (captured 2026-03-28)        │
│  Source:   MacBook Pro, Chrome 131, 1920x1200       │
│  Target:   This device, Chrome 130, 1366x768        │
│                                                      │
│  Quality Score: 75/100                              │
│  ⚠️  Some features may not work perfectly           │
│                                                      │
│  Detected Issues:                                   │
│  ⚠️  [warning] Browser version 131 → 130            │
│  ⚠️  [warning] Resolution 1920x1200 → 1366x768      │
│  ❌ [error]   2 tabs require re-authentication      │
│  ℹ️  [info]   macOS paths adjusted to Linux         │
│                                                      │
│  Recommendations:                                   │
│  • Update to Chrome 131 if possible                 │
│  • Plan to re-login after restore                   │
│  • Resize window if layout looks cramped            │
│                                                      │
│  [Details ▼]                                        │
│                                                      │
│  [Cancel]  [✓ Restore Anyway]                       │
└─────────────────────────────────────────────────────┘
```

**Auto-Adaptation Logic:**

```typescript
async function restoreWithAdaptation(
  snapshot: SnapshotManifest,
  hazards: HazardReport
): Promise<WorkspaceNode> {
  const workspace = deserializeTree(snapshot.tree);

  // Adapt resolution (layout scaling)
  if (hazards.hazards.some(h => h.type === "resolution" && h.autoAdapted)) {
    const scaleFactor = currentEnvironment.screenWidth / snapshot.screenWidth;
    scaleLayoutHints(workspace, scaleFactor);
  }

  // Adapt paths (OS differences)
  if (hazards.hazards.some(h => h.type === "paths")) {
    adaptPathsForOS(snapshot.tabs, currentEnvironment.os);
  }

  // Skip auth restoration (users will re-auth)
  // (Already handled in ADR-002)

  // Restore MCP apps (with graceful fallback)
  for (const tabSnapshot of snapshot.tabs) {
    if (snapshot.mcp_apps[tabSnapshot.appId]) {
      try {
        const app = restoreApp(snapshot.mcp_apps[tabSnapshot.appId]);
        if (!app) {
          // Re-generate if deserialization failed
          tabSnapshot.regenerateMCPAppOnRestore = true;
        }
      } catch (error) {
        // Log and skip; MCP app will be re-generated
        console.warn(`MCP app restore failed; will re-generate:`, error);
        tabSnapshot.regenerateMCPAppOnRestore = true;
      }
    }
  }

  return workspace;
}

function scaleLayoutHints(workspace: WorkspaceNode, scaleFactor: number): void {
  // Walk tree and adjust fixed-width layout hints
  walk(workspace, (node) => {
    if (node.layoutHints?.maxWidth) {
      node.layoutHints.maxWidth = Math.floor(node.layoutHints.maxWidth * scaleFactor);
    }
    if (node.layoutHints?.minWidth) {
      node.layoutHints.minWidth = Math.floor(node.layoutHints.minWidth * scaleFactor);
    }
  });
}

function adaptPathsForOS(tabs: TabSnapshot[], targetOS: "macos" | "linux" | "windows"): void {
  for (const tab of tabs) {
    if (tab.formData) {
      for (const [key, value] of Object.entries(tab.formData)) {
        // Simple path mapping: /Users/ → /home/, C:\ → /mnt/c/, etc.
        if (typeof value === "string") {
          tab.formData[key] = mapPath(value, targetOS);
        }
      }
    }
  }
}

function mapPath(path: string, targetOS: "macos" | "linux" | "windows"): string {
  // macOS → Linux: /Users/alice → /home/alice
  if (path.startsWith("/Users/")) {
    const username = path.split("/")[2];
    return `/home/${username}${path.substring(`/Users/${username}`.length)}`;
  }
  // Windows → Linux: C:\Users\alice → /home/alice
  if (path.match(/^[A-Z]:\\Users\\/)) {
    const match = path.match(/^[A-Z]:\\Users\\([^\\]+)/);
    if (match) {
      return `/home/${match[1]}${path.substring(match[0].length).replace(/\\/g, "/")}`;
    }
  }
  // Add more mappings as needed...
  return path;  // No mapping; return as-is
}
```

**Warning Badges in Tab Headers:**

After restore, if a tab has hazards, show a badge:

```
Tab: "GitHub PR"
[⚠️ Resolution adjusted]  [⚠️ Re-auth needed]
```

User can click badge to get more details or manually fix the issue.

---

## Consequences

### Good
- **Portable snapshots**: Users can restore snapshots across machines without friction
- **Hazard awareness**: Users are informed of compatibility issues; not surprised
- **Pragmatic recovery**: Auto-adapt what can be adapted; let users fix what can't
- **No data loss**: Restore never mangles data; worst case is degraded layout or re-auth needed
- **User agency**: Users understand what changed and can manually fix issues if needed
- **Real-world usage**: Accommodates typical cross-machine scenarios (minor version skew, similar resolutions)

### Bad
- **Auto-adaptation may break things**: Layout scaling could inadvertently break responsive design or overflow
- **Silent failures possible**: Some incompatibilities may go unnoticed by user (if they don't read hazard report)
- **Incomplete state**: Tabs may need re-auth or adjustment; not a perfect restore
- **Debugging difficulty**: If adaptation breaks something, hard to diagnose root cause
- **User confusion**: Non-technical users may not understand hazard report; click "Restore Anyway" without understanding risks

### Neutral
- **Modal overhead**: Hazard report modal adds one extra click to restore flow (acceptable for cross-machine case)
- **Computation cost**: Hazard detection and adaptation logic adds latency (~100-200ms; negligible)

---

## Future Enhancements

1. **Automatic version migration**: Detect browser version change and run automated compatibility migration scripts
2. **Layout preview**: Show before/after layout comparison for resolution-adapted snapshots
3. **Snapshot telemetry**: Track which hazards users encounter; use data to improve auto-adaptation heuristics
4. **Interactive adaptation**: Let users adjust resolution scaling interactively (drag corners, set min/max widths)
5. **Snapshot diffing**: Compare two snapshots to show what changed (useful for cross-machine verification)

---

## Related Decisions

- **ADR-002 (Auth Credentials)**: Auth tokens are stripped by default; cross-machine restore always requires re-auth for sensitive tabs
- **ADR-001 (Snapshot Format)**: Manifest includes metadata (browserVersion, screenResolution, OS) needed for hazard detection
- **ARCHITECTURE.md (Cross-Machine Bridge)**: Architecture section details the bridging logic
