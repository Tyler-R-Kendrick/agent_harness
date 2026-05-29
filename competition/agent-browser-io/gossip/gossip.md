# Agent Browser Gossip

## What People Say

- Reddit discussion around agent-browser-style tooling centers on token efficiency compared with Playwright MCP and Chrome DevTools MCP.
- Some commenters report large token savings, while others ask whether the efficiency claim refers to tokens, time, or overall reliability.

## Design Sentiment

- Positive: the ASCII demo is memorable and immediately explains the product.
- Positive: numeric refs make agent actions easy to specify.
- Negative: humans may still need screenshots or video to trust what happened.

## Feature Sentiment

- Positive: MCP, SDK, and CLI options make it easy to try in different contexts.
- Positive: a small action set reduces tool-choice confusion.
- Negative: wireframe-only perception can miss visual bugs, layout regressions, and page states that matter to users.

## Marketing Sentiment

- Good: token efficiency is a real pain point in browser-agent loops.
- Risk: efficiency claims are easy to challenge unless benchmarked against current Playwright/DevTools alternatives and real workflows.

## Bugs And Friction To Watch

- Ref stability after dynamic page changes.
- Lossy page representation for canvas, charts, images, modals, and CSS-dependent states.
- Need for screenshot fallback when wireframes cannot explain visual affordances.
