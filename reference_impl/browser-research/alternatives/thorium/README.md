---
project: Thorium
type: chromium-fork
status: active
last_reviewed: 2026-04-04
---

# Thorium

## Overview
High-performance Chromium fork with focus on JavaScript optimization. Compiled with -O3 optimization and -march=native flags. Achieves 8-38% JavaScript performance improvement over stock Chromium. Active development. Excellent foundation for performance-focused browser forks.

## Technical Approach
- **Base**: Chromium fork
- **AI Integration**: None (performance-focused)
- **Key Differentiator**: Aggressive compiler optimizations; native architecture tuning

## Key Learnings
- Compiler optimization can yield significant performance gains (8-38% JS improvement)
- -O3 + -march=native proves feasible for mainstream applications
- Performance differentiation is underutilized in browser market
- Good reference implementation for performance-conscious forks

## UX Innovations
- Measurably faster JavaScript execution
- Native architecture optimization
- Drop-in replacement for Chromium users

## Risks & Concerns
- Compiler optimization complexity increases maintenance burden
- Binary size/startup time trade-offs not specified
- Limited ecosystem around performance fork
- Chromium update cadence requires continuous rebase

## Links
- Thorium GitHub repository
- Optimization flags documentation

## Notes
Thorium demonstrates that simple compiler optimization yielding 8-38% JS improvement is viable. Good reference implementation for performance-focused fork strategy. Active development suggests sustainable model. However, pure performance differentiation without feature innovation has limited market size.
