# Fazm Gossip

## Positive Signals

- The GitHub README advertises a fully local, fully open-source computer agent that can control browser, code, documents, and Google Apps.
- Enterprise marketing directly addresses common objections to desktop agents: screen data, audit logs, admin controls, SSO, and on-prem deployment.
- The founder's Reddit post describes latency and instant push-to-talk as core product problems, which shows the team understands the feel of desktop automation.
- Public GitHub activity shows hundreds of stars, many releases, and a substantial Swift/TypeScript codebase.

## Negative Signals

- The product depends on macOS-specific permissions and APIs, which can make first-run setup fragile.
- Voice-first automation is vulnerable to transcription mistakes and ambiguous commands.
- Enterprise pages make strong ROI and self-healing claims that will need customer proof to avoid sounding like RPA replacement marketing.
- A whole-desktop agent can touch more sensitive surfaces than a browser-only agent, which increases approval and audit expectations.

## Bug And UX Complaints To Track

- ScreenCaptureKit and accessibility-permission setup failures.
- Per-action latency when screen capture, model calls, and execution are chained.
- Voice transcription or push-to-talk responsiveness issues.
- Code signing, macOS version, and local build friction for open-source users.
- Audit logs that capture steps but not enough visual context for incident review.

## Sources

- https://github.com/mediar-ai/fazm
- https://fazm.ai/enterprise
- https://www.reddit.com/r/SideProject/comments/1rqcn4y/fazm_open_source_voicecontrolled_ai_agent_for/
