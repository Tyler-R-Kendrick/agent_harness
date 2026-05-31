# Midscene.js Gossip

## Positive Signals

- Midscene has visible GitHub traction and frequent releases, with the README showing a large star count and active release history at snapshot time.
- Maintainer/community discussion says production adopters use it for high-churn flows and that replay reports help triage failures.
- The pure-vision pitch resonates for canvas, mobile, desktop, and UIs where DOM selectors are unavailable or unstable.

## Negative Signals

- Reddit QA discussion repeatedly flags latency: each uncached step is a model call.
- Some testers argue stable test IDs and page-object patterns are preferable, and that AI-based locators can worsen flakiness.
- The mental model for debugging a visual model mis-click is different from a selector stack trace, so onboarding can be nontrivial.

## Category Chatter

- QA teams are not rejecting AI automation outright; they are asking where it actually reduces maintenance versus hiding nondeterminism.
- A pragmatic migration pattern is emerging: move high-churn flows first, keep stable selectors where they work.
- Caching is becoming an expected mitigation for AI locator latency and cost.

## Bug And UX Risks To Watch

- Slow regular-regression runs if too many steps require live vision calls.
- False confidence from natural-language actions that pass locally but misread a production UI variant.
- Replay reports must be easy to keep, diff, and attach to CI failures, or model-driven debugging becomes opaque.
- Cross-platform breadth can dilute browser-specific permission, cookie, and authenticated-session controls.

## Sources

- https://midscenejs.com/
- https://github.com/web-infra-dev/midscene
- https://midscenejs.com/web-api-reference
- https://www.reddit.com/r/softwaretesting/comments/1t3dkpu/is_anyone_actually_using_midscene_in_real/
- https://www.reddit.com/r/softwaretesting/comments/1tawtt0/would_you_trust_aibased_locator_resolution_in/
