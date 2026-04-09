# ADR-002: Auth & Credential Handling in Snapshots

> Status: **Proposed** | Created: 2026-04-04

## Context

Snapshots capture cookies, localStorage, and form data. These often contain sensitive authentication tokens and credentials:

- **Session cookies**: `session=xyz123`, `jwt=eyJ0...`, OAuth tokens
- **localStorage tokens**: `authToken`, `refresh_token`, `api_key`
- **Form data**: Passwords (if user filled them in), credit card numbers (on payment forms)
- **HTTP headers**: Authorization headers (not captured directly, but session state is)

**Core tension**: Users want seamless restore (no need to re-authenticate on opening a snapshot), but sharing or exporting snapshots could leak credentials if not handled carefully.

**Three scenarios highlight the challenge:**

1. **Local restore on same device**: User saves snapshot, closes browser, reopens snapshot later. They expect to be logged in immediately (no re-auth needed).

2. **Cross-device restore**: User saves snapshot on MacBook, travels, restores on laptop. If tokens are included, they work immediately (good UX). If tokens are expired (likely after hours/days), restore fails or shows "re-auth needed" (bad UX).

3. **Sharing with teammates**: User exports snapshot to share a workspace with a teammate. If tokens are included, teammate sees them (credential leak + security liability). If tokens are stripped, teammate must re-authenticate (friction).

---

## Decision Drivers

1. **Security first**: Do not leak credentials by default; users must explicitly opt in to include tokens (if at all)
2. **Usability**: Local restore should not require re-authentication; cross-device restore can require re-auth
3. **Shareability**: Exporting snapshots should be safe (no credentials leaked) to reduce friction for collaboration
4. **Trust**: Users should understand what credentials are in their snapshots; transparency via warnings
5. **Backward compatibility**: As snapshots evolve, old format snapshots should still be readable (with warnings if they contain credentials)

---

## Options Considered

### Option A: Strip All Credentials (Recommended)

**Description:**
By default, remove all credentials from snapshots at capture time:
- Delete session cookies (anything matching `session|token|auth|jwt|api_key`)
- Delete localStorage tokens
- Skip form data capture (especially sensitive fields like password, credit card)
- Keep only structural cookies (e.g., `language=en`, `theme=dark`) and storage (e.g., UI preferences)

**Restore behavior:**
- User opens snapshot; tabs load URLs
- If tabs require auth, show a "Re-authentication required" badge on the tab
- User clicks badge to log back in (one-click if provider supports SSO)
- No automatic login; no credential leakage

**Example flow:**
```
Capture:
  - Tab: https://github.com/pr/123
  - Cookies: session=abc123 ← FILTERED OUT
  - localStorage: authToken=xyz789 ← FILTERED OUT
  - Result: snapshot contains URL only, no credentials

Restore:
  - Tab: https://github.com/pr/123 (loads unauthenticated)
  - User sees: "⚠️ Re-authentication required"
  - User clicks "Log in"
  - GitHub SSO modal appears
  - After login, tab reloads with auth (user is now logged in)
```

**Pros:**
- **Safe for sharing**: Snapshots contain no credentials; can email or upload to version control without risk
- **Privacy**: No risk of credentials being leaked if snapshot is intercepted or stolen
- **Simplicity**: No encryption, signing, or credential versioning logic needed
- **Enterprise-friendly**: Passes security audits; no credential storage in snapshot files
- **Transparency**: Users understand the tradeoff: "credentials are not stored, you'll re-auth when needed"

**Cons:**
- **Friction on local restore**: Users must re-authenticate even when restoring on the same machine shortly after capture
  - **Mitigation**: Browser session may still be active; Google, GitHub, etc. may not prompt for re-auth if session is fresh
- **Tokens with long expiry**: If a token is valid for 30 days, re-auth is wasteful (could have preserved it)
  - **Mitigation**: This is a security tradeoff accepted deliberately; 30-day tokens are rare and risky
- **Offline restore**: Can't restore snapshot if OAuth provider is unreachable
  - **Mitigation**: User can work offline; OAuth re-auth deferred until online

---

### Option B: Encrypt Credentials in Snapshots

**Description:**
Capture and preserve all credentials, but encrypt them in the snapshot file. Encryption key is either:
- User's password (user must enter password to decrypt snapshot)
- Browser's stored key (snapshot is encrypted at rest; decryption automatic on restore)
- Optional: user-provided key (for sharing, user shares key out-of-band)

**Restore behavior:**
```
User opens snapshot:
  1. Browser checks if snapshot is encrypted
  2. If encrypted, prompt for decryption key (password or browser key)
  3. Decrypt credentials
  4. Re-inject cookies and localStorage
  5. Tabs auto-login
```

**Sharing behavior:**
```
User exports snapshot for teammate:
  1. Snapshot is encrypted with user's key
  2. User shares snapshot file + separate key (via password manager or secure channel)
  3. Teammate decrypts with shared key
  4. Teammate opens snapshot; tabs are already authenticated
```

**Pros:**
- **No re-auth friction**: Credentials are preserved; restore is seamless
- **Encryption at rest**: Protects against disk theft
- **Shareability (with key distribution)**: Credentials are shared safely if key is shared securely
- **Offline restore**: Can restore snapshot without reaching OAuth provider

**Cons:**
- **Key management complexity**: Users must manage encryption keys; if key is lost, credentials are unrecoverable
  - **Risk**: User forgets password; snapshot becomes useless
- **Encryption overhead**: Significant engineering complexity; requires encryption libraries, key derivation, etc.
- **Not truly safe for sharing**: Key distribution is hard; users will email both snapshot and key (defeating encryption)
- **Trust boundary**: Browser must store encryption key somewhere; if browser is compromised, key is at risk
- **Version fragility**: If encryption algorithm changes, old snapshots become unreadable
- **Enterprise friction**: Different organizations have different key management policies; one size doesn't fit all

---

### Option C: Scope Credentials by Capture Intent

**Description:**
Give users a choice at capture time:

```
"Save Snapshot" dialog:
  [ ] Include login credentials (for seamless restore)
     ⚠️ Warning: Credentials will be stored; this snapshot will have your auth tokens.
        Only use this for personal use, not for sharing.

  Encryption (if credentials enabled):
    ○ No encryption (not recommended)
    ○ Password-protected
    ○ Use browser's stored key
```

**Fidelity map:**
- **minimal**: No credentials, no form data
- **standard**: No credentials, some form data (non-sensitive)
- **rich**: Credentials optional, MCP cache included
- **complete**: Credentials optional, all form data and media included

**Restore behavior:**
```
If snapshot contains credentials:
  - Tabs auto-login; seamless restore
  - If shared, warning banner: "This snapshot contains login credentials.
                                 Only import if you trust the source."

If snapshot does not contain credentials:
  - Tabs load unauthenticated
  - "Re-authentication required" badge shown
```

**Pros:**
- **Flexibility**: Users choose tradeoff between security and convenience
- **Safety by default**: Standard fidelity excludes credentials; power users can opt in
- **Transparency**: Dialog explicitly warns about credential inclusion
- **Sharing clarity**: User chooses "save without credentials for sharing" or "save with credentials for me"
- **Gradual adoption**: Encryption can be added later (only when credentials are enabled)

**Cons:**
- **UI friction**: Extra dialog; users must understand the choice (onboarding burden)
- **Decision paralysis**: Some users won't know which option to choose
- **Still risky**: Novice users may click "include credentials" without understanding implications
- **Incomplete solution**: If user chooses to include credentials but no encryption, sharing is still unsafe
- **Implementation complexity**: Conditional logic for credential handling based on user choice

---

## Decision

**Recommended: Option A (Strip All Credentials by Default) with Option C's transparency layer**

### Rationale

1. **Security by default**: Credentials are never stored in snapshots unless explicitly enabled (and encrypted)

2. **Shareability is a first-class use case**: Snapshots are meant to be shareable artifacts. If credentials are included by default, users will inevitably share them (by accident or ignorance). Stripping by default prevents this class of errors.

3. **Modern auth is becoming re-auth-friendly**: OAuth, SSO, and passwordless auth (FIDO2) are increasingly common. Re-auth on different device is expected and fast. The pain of re-auth is lower than the pain of leaked credentials.

4. **Cross-device auth is hard anyway**: Tokens expire, device fingerprints change, and TLS certificates are device-specific. Sharing credentials across machines is fragile even with encryption. Better to accept that cross-device restore requires re-auth.

5. **Layers of defense**: Even with encryption, credential storage adds complexity and risk. Strip by default; users who want credentials can use option C (future enhancement).

### Implementation Details

**Credential filtering at capture:**

```typescript
function filterCredentials(cookies: Cookie[], formData: Record<string, string>,
                           localStorage: Record<string, string>): FilteredState {
  // Patterns for auth tokens (case-insensitive)
  const authPatterns = [
    'session', 'token', 'auth', 'jwt', 'apikey', 'api_key',
    'bearer', 'refresh', 'oauth', 'credential', 'secret', 'key'
  ];

  // Filter cookies
  const safeCookies = cookies.filter(c => {
    const name = c.name.toLowerCase();
    return !authPatterns.some(pattern => name.includes(pattern));
  });

  // Filter localStorage
  const safeStorage = {};
  for (const [key, value] of Object.entries(localStorage)) {
    if (!authPatterns.some(pattern => key.toLowerCase().includes(pattern))) {
      safeStorage[key] = value;
    }
  }

  // Filter form data (conservative: skip password, credit card fields)
  const sensitiveFields = ['password', 'pin', 'cvv', 'cardnumber', 'secret'];
  const safeFormData = {};
  for (const [key, value] of Object.entries(formData)) {
    if (!sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      safeFormData[key] = value;
    }
  }

  return { safeCookies, safeStorage, safeFormData };
}
```

**Warning at restore:**

If snapshot is missing credentials but URL requires auth, show badge:
```
[⚠️ Re-authentication required]  https://github.com/pulls
```

Clicking badge triggers re-auth flow (browser's standard login prompt).

**Manifest metadata:**

Include flag in `manifest.json`:
```json
{
  "version": "1.0",
  "hasCredentials": false,
  "credentialStripping": "default",  // "default" | "user-opted-in" | "none"
  ...
}
```

So future tools can understand what was stripped and why.

**Future extension (Option C):**

Add UI option in "Save Snapshot" dialog:
```
Advanced options:
  ☐ Include login credentials (requires encryption)
    - Encrypted with: ○ Browser key ○ Password
```

If user enables this, capture credentials and encrypt them (separate ADR for encryption key management).

---

## Consequences

### Good
- **Security by default**: No credentials leak unless user explicitly opts in (future feature)
- **Shareable snapshots**: Users can safely email snapshots to teammates without credential risk
- **Privacy-respecting**: Passes security/privacy audits; no credential storage
- **Simple implementation**: No encryption library needed; filtering is straightforward
- **User education**: Warning badge teaches users that re-auth is normal behavior

### Bad
- **Re-auth friction**: Users must re-authenticate when restoring snapshot on same device
  - **Mitigation**: Browser session may still be active (user doesn't see login prompt); SSO providers cache sessions
- **Offline limitation**: Can't restore authenticated state without network
  - **Mitigation**: This is acceptable; rare use case
- **Token-dependent workflows**: Some workflows (e.g., API testing with specific token) won't restore identically
  - **Mitigation**: Users can manually inject tokens via form or storage inspection tools; document workaround

### Neutral
- **Manifest metadata**: Adding `hasCredentials` flag slightly increases manifest size (negligible)
- **Transparency cost**: Warning badge is visible; might feel like feature limitation rather than security feature
  - **Mitigation**: Frame as "smart restore" that handles auth gracefully; onboard users with help text

---

## Future Enhancements (Out of Scope for ADR-002)

1. **Encryption of credentials** (if user opts in): ADR on key management (password-derived vs browser-managed)
2. **Credential scanning**: Detect if snapshot contains leaked credentials post-hoc; warn user
3. **Credential injection workflows**: Easy way to inject credentials into restored snapshot (via form filler or storage injection)
4. **Cross-device credential sync**: Leverage system keychain (macOS, Windows, Linux) for secure cross-device auth storage (outside snapshot scope)

---

## Related Decisions

- **ADR-001 (Snapshot Format)**: Credentials filtering is format-agnostic; applies to ZIP, binary, or JSON equally
- **ADR-003 (MCP App State)**: MCP apps may also have auth tokens; apply same filtering logic to app state
- **Snapshot Registry**: Registry could track which snapshots have credentials (for security audit)
