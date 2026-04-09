# ADR-002: Authentication and Action Security Model

> Status: **Proposed** | Created: 2026-04-04

## Context

MCP apps need to perform actions on source pages (approve PRs, submit forms, move tickets). This requires the action router to interact with authenticated web pages on behalf of the user. Comet's security crisis (March 2026, dropped from #3 App Store) demonstrated that agentic credential handling is the highest-risk surface in an AI browser.

## Decision Drivers

- **Security**: Comet's failure mode was credential leakage through agentic workflows. We must not repeat this.
- **Usability**: Requiring re-auth for every action defeats the purpose of composed MCP apps.
- **Transparency**: Users must understand what actions the agent is taking and with what credentials.
- **Isolation**: A compromised MCP app in one workspace must not access credentials from another.

## Options Considered

### Option A: Share browser cookies directly
MCP app action router uses the same cookie jar as the raw page. Simple but dangerous — a malicious MCP app could exfiltrate session tokens.

### Option B: Scoped action tokens (Recommended)
When the user first navigates to an authenticated page in a workspace, the action router creates a scoped capability token:

```
Scope: workspace-123 / github.com / actions: [approve-pr, merge-pr, comment]
Expires: workspace session end
Revocable: yes (user can revoke from workspace settings)
```

The MCP app never sees raw cookies or session tokens. It can only invoke pre-declared actions through the capability token.

### Option C: Per-action re-authentication
Every action requires explicit user confirmation with biometric/password. Most secure, but extremely high friction.

### Decision

**Option B: Scoped action tokens**, with Option C escalation for high-impact actions.

The action router creates workspace-scoped capability tokens. Actions are categorized:

| Action Category | Confirmation Required | Example |
|---|---|---|
| **Read** | None | Fetch PR diff, read Jira description |
| **Low-impact write** | None (logged) | Add comment, change label |
| **High-impact write** | Explicit confirmation | Merge PR, move to production, delete |
| **Financial/account** | Re-authentication | Purchase, change password, transfer |

Tokens are workspace-scoped (cannot cross workspace boundaries), session-scoped (expire when workspace closes or goes cold), and revocable (user can revoke from workspace settings at any time).

## Consequences

- **Good**: No raw credential exposure to MCP apps
- **Good**: Workspace isolation prevents cross-contamination
- **Good**: Graduated confirmation matches actual risk
- **Bad**: Token scoping requires categorizing every possible web action (ongoing maintenance)
- **Bad**: First-time setup per site is slightly slower (defining action scopes)
- **Neutral**: Users must learn a new permissions model, but it's more intuitive than "this app has access to everything"
