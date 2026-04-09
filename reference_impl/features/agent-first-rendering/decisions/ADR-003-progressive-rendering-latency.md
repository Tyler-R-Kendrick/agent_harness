# ADR-003: Progressive Rendering and Latency Budget

> Status: **Proposed** | Created: 2026-04-04

## Context

Putting an agent in the rendering path introduces latency. Users expect near-instant page loads. If agent rendering adds perceptible delay, adoption will fail regardless of how good the composed views are. We need a latency strategy that ensures the agent never makes the browser feel slower than a traditional browser.

## Decision Drivers

- **Perceived performance**: Time to first meaningful content must match or beat traditional browsers.
- **Progressive disclosure**: Users should see value increasing over time, not a loading spinner.
- **Predictability**: Users need to understand what they're seeing and when it will change.
- **User control**: Users must be able to stop progressive enhancement at any point.

## Latency Budget

| Phase | Time Budget | What Happens | User Sees |
|---|---|---|---|
| **T+0ms** | Navigation event | Standard Chromium page load begins | Loading indicator (same as any browser) |
| **T+0-100ms** | First paint | Standard first contentful paint | Raw page content appearing |
| **T+100-300ms** | Fast extract | Parse pipeline delivers DOM structure | Subtle UI hint that agent rendering is available |
| **T+300-800ms** | Smart extract | Extraction complete, basic MCP app ready | Smooth crossfade from raw page to extracted view (if fidelity > passthrough) |
| **T+800ms-2s** | Summary | Agent generates summary/enhanced view | Summary materializes with animation; raw page still accessible |
| **T+2-5s** | Composition | Multi-tab composite MCP app ready | Composition view offered as option (not forced) |

## Decision

**Never block, always enhance.** The rendering strategy is:

1. **Chromium renders first.** The standard page load is never delayed. T+0 to first paint is identical to a traditional browser.

2. **Agent rendering is an overlay, not a replacement.** The MCP app slides over the raw page. If the agent is slow, the user has the raw page. If the agent is fast, the transition is seamless.

3. **Composition is opt-in after first offer.** The first time a workspace qualifies for composition, the user is prompted ("I can combine these tabs into a single view — want to try?"). After the user accepts once for a workspace pattern, future compositions happen automatically.

4. **Freeze control.** A persistent UI element lets the user freeze the current rendering state. If they like the extracted view but don't want to wait for the summary, they freeze. The agent stops enhancing.

5. **Latency telemetry.** Every phase transition is instrumented. If agent rendering consistently exceeds its time budget for a site or content type, the system auto-downgrades to a faster fidelity tier for that pattern.

## Consequences

- **Good**: Browser never feels slower than Chrome/etc.
- **Good**: Users discover agent rendering organically through progressive enhancement
- **Good**: Auto-downgrade prevents bad experiences on sites the agent handles poorly
- **Bad**: The crossfade/overlay UX requires careful visual design to avoid feeling jarring
- **Bad**: Progressive rendering means the view is "unstable" for the first few seconds — some users may find this disorienting
- **Neutral**: Composition is slower by nature (multi-tab); making it opt-in first avoids frustrating users who don't want it
