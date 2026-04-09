# Capabilities: Workspace Snapshots vs Alternatives

> Status: **Draft** | Created: 2026-04-04

## Competitive Landscape

Workspace Snapshots positions against three categories of existing solutions:

1. **Browser session restore** (Chrome, Firefox, Safari)
2. **Specialized session management** (Tab Session Manager extension, Arc Spaces export)
3. **Conceptual comparisons** (VS Code workspaces, VM snapshots)

---

## Comparison Matrix: Session & Workspace Restore

| Dimension | Chrome Session Restore | Firefox Session Restore | Safari iCloud Tabs | Arc Spaces Export | **Workspace Snapshots** |
|-----------|---|---|---|---|---|
| **Scope** | Per-window | Per-window | Cross-device sync | Single space only | Entire workspace tree |
| **URL capture** | ✓ | ✓ | ✓ (URL-only) | ✓ | ✓ |
| **Scroll position** | ✗ | ✗ | ✗ | ✗ | **✓ Standard** |
| **Form data** | ✗ | **✓** | ✗ | ✗ | **✓ Standard** |
| **localStorage** | ✗ | ✗ | ✗ | ✗ | **✓ Standard** |
| **Cookies** | ✗ | ✗ | ✗ | ✗ | **✓ Standard** |
| **Tab screenshot** | ✗ | ✗ | ✗ | **✓** | ✓ (via MCP cache) |
| **MCP app state** | ✗ | ✗ | ✗ | ✗ | **✓ Rich fidelity** |
| **Memory tier restoration** | ✗ | ✗ | ✗ | ✗ | **✓ Exclusive** |
| **Cross-machine restore** | Per-device only | Per-device only | Automatic (URL sync) | ✗ | **✓ With adaptation** |
| **Manual export/import** | ✗ | ✗ | ✗ | **✓ Limited** | **✓ Full fidelity** |
| **Named snapshots** | ✗ | ✗ | ✗ | ✗ | **✓ Unlimited** |
| **Snapshot sharing** | ✗ | ✗ | ✗ | ✗ | **✓ With controls** |
| **Cross-device auto-sync** | ✗ | ✗ | **✓** (URL-only) | ✗ | Optional (3rd-party) |
| **Timeline/history** | ✗ | ✗ | ✗ | ✗ | **✓ Proposed** |
| **Automatic on crash** | **✓** | **✓** | ✗ | ✗ | ✓ (optional) |
| **Auth token handling** | Kept (risky) | Kept (risky) | Stripped | Kept | **✓ Filtered (ADR-002)** |
| **Form data safety** | N/A | Re-populated (risky) | N/A | N/A | **✓ Filtered (ADR-002)** |

---

## Detailed Competitor Analysis

### Chrome Session Restore
**What it does:** Automatically saves open tabs and windows on browser close; restores them on next session.

**Strengths:**
- Automatic (no user action required)
- Fast (just URLs and basic state)
- Well-integrated into browser startup flow

**Weaknesses:**
- **Scope**: Limited to URL list; no scroll position, form data, or localStorage
- **Fragility**: Easily clobbered by crashes or extension conflicts
- **Single-window**: Can't organize into named workspaces
- **No sharing**: Can't export or share a session with teammates
- **No cross-device**: Restored session is always on the same machine

**How Snapshots differ:**
- **Richer state capture**: Scroll, form data, cookies, localStorage, MCP app state
- **Intentional checkpoints**: User explicitly saves snapshots, not automatic
- **Shareable**: Export to file and send to teammates
- **Cross-machine aware**: Adapts to different screen sizes, browser versions, OS

---

### Firefox Session Restore
**What it does:** Saves all open tabs and their state (including form data) on close; restores on next session.

**Strengths:**
- **Form data preservation**: Understands HTML form elements; restores input values (unique among browsers)
- **Automatic**: No user action required
- **Tab-level granularity**: Can restore individual tabs

**Weaknesses:**
- **Single-window only**: Can't organize workspaces hierarchically
- **No scroll positions**: Tabs open at top of page
- **No localStorage/cookies**: Storage is not restored
- **No sharing**: Can't export sessions
- **No cross-device**: Per-machine only
- **Security risk**: Form data (passwords) can be restored automatically without user confirmation

**How Snapshots differ:**
- **Explicit snapshots**: User-controlled checkpoints, not automatic (better for privacy)
- **Scroll + storage**: Captures scroll position, cookies, localStorage (Firefox does only form data)
- **Workspace hierarchy**: Organize tabs into nested workspaces (vs flat list)
- **Sharing + cross-device**: Full export/import with cross-machine adaptation
- **Auth safety**: Filters sensitive form data and session tokens by default

---

### Safari iCloud Tabs
**What it does:** Automatically syncs open tabs across all Apple devices; shows other devices' tabs in a menu.

**Strengths:**
- **Cross-device**: Seamless sync across Mac, iPad, iPhone
- **Automatic**: No setup or user action needed
- **Real-time**: New tabs sync instantly

**Weaknesses:**
- **URL-only**: No state captured (scroll, form, storage)
- **Apple ecosystem only**: Locked to Safari on Apple devices
- **No collaboration**: Can't share with non-Apple users or other browsers
- **No history**: No named checkpoints or timeline
- **No export**: Can't download or archive tabs

**How Snapshots differ:**
- **Richer state**: Not just URLs; includes scroll, form, storage, MCP state
- **Platform-agnostic**: Works across browsers and OS (after restoring)
- **Explicit sharing**: Users control what's shared and with whom
- **Checkpoint history**: Named snapshots form a timeline of workspace evolution
- **Export flexibility**: Download snapshots as files for archival or sharing

---

### Arc Spaces Export
**What it does:** Allows exporting a single Arc "space" (workspace) as an HTML file with links and screenshots.

**Strengths:**
- **Designed for sharing**: Exports are human-readable files
- **Screenshots**: Includes visual previews of tabs
- **Structured**: Reflects Arc's space hierarchy

**Weaknesses:**
- **Limited scope**: Single space only; can't export multiple spaces or nested structure
- **No state restoration**: Export is read-only; can't restore an interactive workspace
- **Screenshots only**: No actual tab state (scroll, form, storage)
- **No cross-workspace**: Can't merge or relate multiple exports
- **Fragile sharing**: HTML files are not version-controlled; easy to get outdated copies

**How Snapshots differ:**
- **Full state restoration**: Not just URLs and screenshots; captures and restores actual tab state
- **Workspace hierarchy**: Support nested workspaces (not just single-space export)
- **Interactive restore**: Open snapshot and interact with tabs immediately (not just view screenshots)
- **Rich metadata**: Timestamps, tags, memory tier assignments; not just static HTML
- **Continuous evolution**: Snapshots form a timeline; old and new snapshots coexist and can be compared

---

### Tab Session Manager Extension (Chrome)
**What it does:** Browser extension for Chrome; allows manual save/restore of tab sessions.

**Strengths:**
- **Manual control**: Users decide what to save (vs automatic)
- **Session organization**: Save multiple named sessions
- **Lightweight**: Only captured what user wants (opt-in)

**Weaknesses:**
- **Extension dependency**: Requires installation; can break on Chrome updates
- **Limited scope**: Only URLs; no form data, scroll, storage (unlike Firefox)
- **No cross-device**: Extension settings are per-browser
- **No sharing**: Sessions are private to that browser installation
- **No MCP state**: Not designed for agentic rendering

**How Snapshots differ:**
- **Native integration**: Built into browser (not an extension)
- **Rich state capture**: Form data, scroll, storage, MCP app state (far beyond extension capabilities)
- **Cross-machine support**: Snapshots adapt to different hardware and OS
- **Sharing first-class**: Export snapshots as portable files with auth safety controls
- **Agent-aware**: Captures and restores MCP app state (exclusive to agentic browsers)

---

### VS Code Workspaces (.code-workspace files)
**What it does:** Saves editor configuration, file tree state, and open editors in a `.code-workspace` JSON file.

**Conceptual similarities:**
- Named, shareable checkpoints
- Hierarchical (folders + files)
- Portable across machines (VS Code installed)

**Why this comparison matters:**
Workspace Snapshots follow a similar mental model: a workspace is a checkpointed unit of work that can be saved, named, shared, and restored. VS Code shows this pattern is intuitive to users.

**How Snapshots differ from this paradigm:**
- **Richness**: Include runtime state (scroll, form, storage), not just file structure
- **Browser-specific**: Handle cookies, localStorage, cross-origin policies
- **Cross-device adaptation**: Normalize for different screen sizes and browser versions (VS Code assumes same installation)

---

### VM Snapshots (VMware, VirtualBox)
**Conceptual analogy (not a direct competitor):**

A VM snapshot freezes the entire machine state at a point in time — CPU state, disk, memory, network connections. Restoring the snapshot rewinds the VM to that exact state.

**Workspace Snapshots are the browser equivalent:**
- Instead of freezing OS state, freeze workspace state (tabs, scroll, form, storage, MCP app state)
- Instead of VM process restore, restore workspace tree and re-hydrate tabs
- Cross-machine challenges are analogous: VM snapshots are also fragile across different hardware (drivers, CPU features, etc.)

**Why this analogy is useful:**
It helps users understand the scope: "Like hitting a snapshot button on a VM, but for your workspace." It also flags known challenges (cross-machine compatibility).

---

## Unique Capabilities

### Exclusive #1: Full Workspace Tree Snapshots
**No competitor does this**: Snapshot captures the entire hierarchical workspace (all nested folders and tabs), not just a flat window or space.

**Scenario**: A user has a 20-tab research project nested under `Projects > Research > Q1 2026 > Competitor Analysis`. Only Workspace Snapshots can freeze this entire tree structure and restore it with all hierarchy intact.

### Exclusive #2: Memory Tier Restoration
**Unique to agentic browsers**: Snapshots capture and restore memory tier assignments (hot/warm/cool/cold).

**Scenario**: A user has carefully organized their workspace with high-frequency tabs in hot tier and reference materials in cool tier. A snapshot preserves this tuning; on restore, the tier assignments are re-applied, so the workspace performs the same way.

### Exclusive #3: MCP App State Capture
**Unique to agent-first rendering**: Snapshots serialize MCP app state so that composed views are restored without re-parsing and re-reasoning.

**Scenario**: A user has an MCP app combining three tabs (GitHub PR, ticket tracker, documentation) into a unified review interface. Snapshot captures the app's state (scroll in composed view, selected PR, etc.). On restore, the composed app reappears with the same state — users don't see the parse/reasoning pipeline again.

### Exclusive #4: Cross-Machine Snapshot Restore
**Most competitors are single-machine**: Workspace Snapshots are designed from the ground up for cross-device restore with intelligent adaptation.

**Scenario**: A user captures a snapshot on MacBook Pro (1920x1200) with Chrome 131. Later, they restore it on a Linux laptop (1366x768) with Chrome 130. The snapshot adapter adjusts layout proportionally, warns about browser version mismatch, and re-verifies auth state. Most tabs restore correctly; users see warnings (not crashes) for the few that don't.

### Exclusive #5: Filtered Auth & Form Data
**Firefox restores form data automatically (risky)**; Snapshots filter by default.

**Scenario**: A user captures a snapshot after filling out a payment form with a credit card. The card number is NOT included in the snapshot (filtered by content policy). If the user shares the snapshot with a teammate, the teammate sees the form structure but not the sensitive data. On restore, users are warned: "This tab had sensitive form data that wasn't captured; you may need to re-enter credentials."

### Exclusive #6: Named, Searchable Snapshots
**No browser natively supports this**: Unlike automatic session restore, snapshots are named and can be indexed for search.

**Scenario**: A user saves 50 snapshots over a quarter: "Project X - Phase 1", "Project X - Phase 2", "Bug investigation - auth flow", etc. They can search "auth" and find all snapshots related to auth work. They can sort by date, tags, or name. They can compare two snapshots ("what changed between Phase 1 and Phase 2?").

---

## Risk & Tradeoff Matrix

| Tradeoff | Upside | Downside | Mitigation |
|----------|--------|----------|-----------|
| **Snapshot size (complete fidelity)** | Restores without network; full audit trail | 50MB+ per snapshot; storage bloat | Recommend "standard" fidelity by default; offer compression; auto-prune old snapshots |
| **Auth token capture** | Users can share snapshots without re-auth hassle | Session tokens leak if snapshot is intercepted | Filter tokens by default; encrypt snapshots at rest; warn users before capturing "complete" fidelity |
| **Form data capture** | Seamless restore without re-entering data | Passwords or API keys could leak | Filter sensitive fields; don't capture payment forms; warn before "complete" fidelity |
| **Cross-device adaptation** | Snapshots are portable; work across machines | Layout may degrade or break on very different hardware | Cross-machine bridge detects hazards; users are warned; passthrough fallback available |
| **Auto-snapshots** | Safety net (can recover from crashes) | Disk space bloat; performance impact on snapshot creation | Auto-snapshots optional and configurable; auto-prune old ones; run in background |
| **Snapshot sharing** | Enables collaboration and knowledge transfer | Snapshots can contain sensitive data; no fine-grained access control | Encryption, signing, and optional approval flows; educate users on what to share |
| **MCP app state capture** | Composed views restore without re-reasoning | Large snapshots if MCP cache is included; version mismatch if MCP generation changes | MCP app state optional (can skip if too large); version snapshots with MCP version |
| **Persistent snapshot registry** | Discoverable history; search and timeline UI | Additional storage and indexing overhead; privacy concerns | Registry is local-first and opt-in; users can export snapshots without registering |

---

## Why Workspace Snapshots Matter

**Problem solved**: Today, workspace state is fragile and tied to a single machine. Users lose scroll positions, form data, and memory tier tuning on restart. They can't share a workspace with a teammate. They can't travel with their workspace.

**Value unlocked**:

1. **Reliability**: Capture checkpoints of workspace evolution; never lose work again
2. **Collaboration**: Export snapshots to teammates; they see exactly what you saw
3. **Cross-device**: Work on a project on Mac, continue on Linux, same state
4. **Team knowledge**: Archive snapshots from past projects (customer support issues, bugs, code reviews)
5. **Performance tuning**: Preserve memory tier assignments and MCP app states (unique to agentic browsers)

**Market position**: No other browser offers this combination of richness (scroll + form + storage + MCP state), portability (cross-device), and collaboration (sharing). This is a genuine differentiator for an agentic browser.
