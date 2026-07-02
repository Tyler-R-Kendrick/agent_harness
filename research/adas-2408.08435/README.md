# ADAS (arXiv:2408.08435)

- Paper: **Automated Design of Agentic Systems**
- Authors: Shengran Hu, Cong Lu, Jeff Clune (UBC / Vector Institute)
- Link: https://arxiv.org/abs/2408.08435
- Published: 2024-08 (arXiv v1); ICLR 2025

## What this paper proposes

ADAS defines the research area of automatically designing agentic systems: since agents are programs, a meta agent can program ever-better agents in code.

1. **Meta Agent Search**: a meta agent iteratively writes new agent designs as code, evaluates them, and keeps going.
2. An **archive of discovered designs** is maintained; the meta agent samples from it for inspiration, so search accumulates rather than restarting.
3. Discovered agents outperform hand-designed baselines and, notably, **transfer across domains and models**.

## Extracted capability to implement

### Capability name

**Harness Archive with Lineage Sampling (HALS)**

### Capability definition

A content-addressed archive of generated harness definitions ("genomes"), each carrying eval scores and a parent-lineage pointer. New harnesses are always produced as children of archived parents — never by evolving a definition in place — with parent selection weighted by both score AND novelty so the archive keeps exploring instead of collapsing onto one lineage.

### Why it matters in our stack

- `agent-browser/src/services/harnessEvolution.ts` is the existing evolution surface that would gain this archive: today's mutate-and-replace flow becomes append-only, replayable search.
- Fits the continual-improvement framing in `research/continual-harness-2605.09998`: the archive is the persistent substrate across improvement sessions.
- Related work: the planned sibling packet `research/hgm-2510.21614` (clade-based credit assignment) refines this archive's parent selection by scoring whole lineages instead of single genomes.

## Minimal algorithm sketch

1. Seed the archive with the incumbent harness definition, content-hashed to an id.
2. Sample a parent, weighted by combined eval score plus novelty versus the rest of the archive.
3. Mutate the parent's definition into a new child genome (new id, `parentId` set).
4. Evaluate the child and insert it; content-hash dedupe drops exact repeats.
5. Repeat for the budget; report the best genome and its full lineage.

## Deliverables in this folder

- `reference-architecture.md` — architecture for adding HALS to the harness-evolution surface.
- `experiments/experiment-01-harness-archive-search.md` — experiment design and acceptance criteria.
- `experiments/experiment-01-harness-archive-search.ts` — TypeScript implementation scaffold.
