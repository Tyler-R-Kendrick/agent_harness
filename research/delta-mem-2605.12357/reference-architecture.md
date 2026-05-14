# Reference Architecture: Online Delta Memory Adapter (ODMA)

## Objective

Integrate a compact online associative memory into the agent-browser execution loop so long-horizon tasks can retain salient state without unbounded context growth.

## Components

1. **Event Encoder**
   - Converts `(user turn, tool call, tool result, planner note)` into fixed-width key/value vectors.
2. **Delta Memory State**
   - Fixed matrix `M ∈ R[d_value x d_key]` updated online with a delta-rule.
3. **Memory Reader**
   - Projects current query vector into memory readout `r = Mq`.
4. **Low-Rank Adapter Head**
   - Maps `r` into low-rank correction terms for downstream scoring/ranking.
5. **Policy Fusion Gate**
   - Blends base policy signal with memory-corrected signal under bounded gain constraints.
6. **Metrics + Safety Monitor**
   - Tracks utility (retrieval hit rate), drift, and error spikes; disables memory path on regressions.

## Data flow

1. New runtime event enters encoder.
2. Encoder emits `(k, v)`.
3. Delta update mutates `M` in-place.
4. Next decision query `q` reads memory (`r = Mq`).
5. Adapter head computes correction vector.
6. Fusion gate applies correction to decision score.
7. Monitor records metrics and can switch memory path to fail-safe mode.

## Validation gates

- **Norm clamp**: cap `||M||` to avoid exploding updates.
- **Gain cap**: correction magnitude cannot exceed configurable ratio of base signal.
- **Replay check**: periodic deterministic replay of held-out traces to detect degradation.
- **Fallback**: instant switch to base policy when monitor flags violations.

## Rollout policy

1. Shadow mode (metrics only, no policy impact).
2. Read-only assist mode (memory informs diagnostics).
3. Bounded-action mode (small gain cap).
4. Full adapter mode with continuous monitoring.

## Metrics

- Memory retrieval hit rate on delayed-recall probes.
- Decision quality delta vs baseline policy.
- Context token savings from reduced transcript replay.
- Regression count from safety monitor trips.
