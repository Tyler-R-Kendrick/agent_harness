---
adr: 004
title: Per-Site Ad-Blocking Bypass UI and Persistence
status: Decided
created: 2026-04-04
updated: 2026-04-04
---

# ADR-004: Per-Site Ad-Blocking Bypass UI and Persistence

> Status: **Decided** | Created: 2026-04-04

## Context

Ad blocking is powerful but sometimes breaks websites. Users need a way to temporarily or permanently allow ads on specific sites. Two approaches exist:

1. **Temporary bypass** (this session only; reverts on restart)
2. **Permanent allowlist** (stored in prefs; persists across sessions)

Each has different UX implications and persistence models.

## Decision Drivers

1. **User control**: Users must be able to override blocking (one click) when a site is broken
2. **Safety**: Temporary bypass should not permanently weaken ad blocking (accidental "always allow" is bad)
3. **Discoverability**: Allowlist/bypass mechanism must be obvious in browser UI
4. **Privacy**: Allowlist should not be sent to external servers (remain local)
5. **Advanced users**: Power users should be able to view/edit allowlist directly (prefs or settings)

## Options Considered

### Option A: Temporary Bypass Only

**Description**: Clicking "Allow ads on this site" disables blocking for the current session. Restarts the browser → blocking re-enabled.

**Data flow**:
```
User navigates to broken-site.com
  ↓
Ad blocking breaks layout
  ↓
User clicks "Disable ad blocking (this session)" in address bar
  ↓
PerSiteAllowlist in memory updated: {"broken-site.com": "session"}
  ↓
Browser reloads page; ads are now shown
  ↓
User restarts browser
  ↓
PerSiteAllowlist in memory cleared; next visit to broken-site.com blocks ads again
```

**Pros**:
- **Safety by default**: Accidental clicks don't permanently weaken blocking
- **Simple implementation**: In-memory set; no persistence logic needed
- **Clear mental model**: "This session only" is easy to understand

**Cons**:
- **Annoying for repeat visits**: If user visits same site in next session, they must click allow again
- **Power users frustrated**: Sites that are permanently broken (poor ad-blocking rules for that domain) require repeated allowlist actions
- **No way to permanently fix**: If user wants to always allow ads on trusted site, must grant exceptions every session

### Option B: Permanent Allowlist Only

**Description**: Clicking "Allow ads on this site" adds domain to persistent allowlist (stored in browser prefs). Survives browser restart.

**Data flow**:
```
User navigates to broken-site.com
  ↓
User clicks "Always allow ads on this site" in address bar
  ↓
PerSiteAllowlist updated in prefs:
  {
    "allowlist": ["broken-site.com", "trusted.example.com/*"],
    "version": 1
  }
  ↓
Browser reloads page; ads are now shown
  ↓
User restarts browser
  ↓
PerSiteAllowlist loaded from prefs; broken-site.com still allowed
```

**Pros**:
- **No repetition**: User sets exception once; it persists
- **Power users happy**: Can permanently allowlist broken sites
- **Transparent**: Allowlist is visible in settings (users can see what's allowed)

**Cons**:
- **Safety risk**: Accidental clicks permanently weaken blocking (hard to undo if user is unfamiliar with settings)
- **Privacy leak risk**: Allowlist could theoretically be exfiltrated (e.g., if settings page has XSS vulnerability)
- **UX confusion**: Casual users don't expect permanent changes from UI action

### Option C: Hybrid (Temporary + Permanent) (Recommended)

**Description**: Two separate allowlist levels:

1. **Session allowlist** (temporary): survives page reloads but not browser restart
2. **Persistent allowlist** (permanent): stored in prefs; survives restarts

UI offers both options in context menu:

```
Right-click or address bar button:
  ☐ Allow ads on this site (this session)
  ☐ Always allow ads on this site
  → Manage ad blocking exceptions...
```

**Data flow**:

Scenario 1: Temporary bypass
```
User right-clicks → "Allow ads on this site (this session)"
  ↓
SessionAllowlist.insert("broken-site.com")
  ↓
Page reloads; ads shown
  ↓
Browser restart
  ↓
SessionAllowlist cleared; next visit blocks ads again
```

Scenario 2: Permanent allowlist
```
User right-clicks → "Always allow ads on this site"
  ↓
PersistentAllowlist updated in prefs:
  {
    "allowlist": ["broken-site.com"],
    ...
  }
  ↓
Page reloads; ads shown
  ↓
Browser restart
  ↓
PersistentAllowlist loaded from prefs; broken-site.com still allowed
```

**Pros**:
- **Safe by default**: One-click allows ads temporarily; permanent changes require explicit second step ("Always allow")
- **Power user friendly**: Dedicated "Always allow" option for permanent exceptions
- **Flexible**: Casual users get one-click temporary relief; power users can manage permanent allowlist
- **Transparent**: Allowlist is visible in settings; users know what they've allowed
- **Clear mental model**: "This session" vs "Always" are distinct and obvious

**Cons**:
- **More complex implementation**: Two allowlists instead of one
- **More UI options**: Potentially confusing for casual users (must choose between temp/perm)
- **Prefs management**: Need UI to view/remove persistent allowlist entries

### Option D: Browser-Curated Exceptions

**Description**: Ship with a pre-built allowlist of sites known to be incompatible with ad blocking (e.g., banks, government sites). Users cannot modify.

**Pros**:
- **Minimal UX**: No user action required; known-broken sites "just work"
- **Research-backed**: Can curate list based on real breakage reports

**Cons**:
- **Maintenance burden**: Must curate list as sites change
- **User disempowerment**: Removes user control (bad precedent)
- **Not scalable**: Thousands of sites are incompatible; cannot curate all
- **No appeal process**: If browser mistakenly allowlists a site, user has no recourse

## Decision

**Recommended: Option C (Hybrid Temporary + Permanent Allowlist)**

### Rationale

1. **Safety by default**: New users click "allow" expecting temporary relief; blocking stays strong unless they explicitly choose "always allow"

2. **Power user flexibility**: Advanced users can permanently allowlist broken sites; UI offers both options

3. **Clear semantics**: "This session" and "Always" are distinct and easy to understand

4. **Audit transparency**: Permanent allowlist is visible in settings; users can review and remove entries

5. **Balanced complexity**: Implementation is straightforward (two in-memory/pref sets); UI is slightly more complex but justified

### Implementation

**Data Structures**:

```cpp
// In-memory (cleared on browser shutdown)
std::set<std::string> session_allowlist_;

// Persisted in browser prefs
// "adblock.permanent_allowlist": [
//   "broken-site.com",
//   "https://trusted.example.com/path/*",
//   "regex:^(bank|government)\\..*"
// ]
```

**URLLoaderFactory Proxy Logic**:

```cpp
bool IsAllowlisted(const GURL& url, const url::Origin& initiator) {
  const std::string& domain = url.host();

  // Check session allowlist first (temporary)
  if (session_allowlist_.count(domain)) {
    return true;
  }

  // Check persistent allowlist
  if (pref_service->GetList("adblock.permanent_allowlist").Find(domain) != -1) {
    return true;
  }

  return false;
}
```

**UI**:

**Scenario 1: User clicks address bar button**

```
[Adblock shield icon] ← Click
  ↓
Popup menu:
  [Enabled on this site (X ads blocked)]

  ○ Allow ads (this session)
  ○ Always allow ads
  [Manage exceptions...]
```

**Scenario 2: User right-clicks element**

```
<Context menu>
  ...
  → Ad Blocking
    ○ Block ads (enabled)
    ○ Allow ads (this session)
    ○ Always allow ads
    → Manage exceptions...
```

**Scenario 3: Settings page**

```
Settings → Privacy → Ad Blocking

[ ✓ Enable ad blocking ]
Filter Lists:
  [ ✓ EasyList ]
  [ ✓ EasyPrivacy ]
  [ + Add custom list ]

Permanent Exceptions:
  broken-site.com       [Remove]
  news.example.com      [Remove]

  [Clear all exceptions]
```

### Allowlist Pattern Support

**Basic patterns** (Phase 1):
- `example.com` — block all ads from example.com's requests
- `*.example.com` — wildcards supported

**Advanced patterns** (Phase 2, optional):
- `https://example.com/path/*` — scheme and path matching
- `regex:^(bank|gov)\\..*` — regex patterns (for power users)

Keep Phase 1 simple (domain-only); add patterns in Phase 2 if user demand is strong.

## Consequences

### Good
- Temporary allowlist prevents accidental permanent blocking of sites
- Permanent allowlist enables power users to fix broken sites
- UI is clearer than single "allow" action (distinguishes temp vs perm)
- Allowlist is transparent (visible in settings)
- Easy to audit (see what's been allowed)

### Bad
- Slightly more complex UI (two options instead of one)
- Implementation adds two data structures (session + persistent)
- Settings page needs UI for managing permanent allowlist (extra work)
- New users may not understand difference between "this session" and "always"

### Neutral
- No impact on extension ecosystem
- Allowlist is browser-local (not synced to cloud) — adds privacy but limits device sync
