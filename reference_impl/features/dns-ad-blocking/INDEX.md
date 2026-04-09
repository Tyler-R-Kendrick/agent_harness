# DNS-Level Ad Blocking Feature Architecture

## Quick Navigation

**Start here:** [README.md](./README.md) — Feature overview, problem statement, core concept

**Deep dive:** [ARCHITECTURE.md](./ARCHITECTURE.md) — Technical design, components, data flow

**Competitive context:** [CAPABILITIES.md](./CAPABILITIES.md) — Feature comparison vs competitors

**Decision records:** [decisions/](./decisions/) — 4 ADRs documenting key architectural choices

---

## Document Summaries

### [README.md](./README.md)
- **What**: Integrate adblock-rust (Brave's engine) into Chromium for native ad blocking
- **Why**: 3-6x faster page loads on ad-heavy sites, ~21% average improvement
- **How**: Network-layer interception via ContentBrowserClient URLLoaderFactory proxy
- **Scope**: 3 implementation phases (MVP, DNS+privacy, benchmarking+UI)

### [ARCHITECTURE.md](./ARCHITECTURE.md)
- **System overview** with ASCII diagrams
- **5 core components**: AdblockEngine, URLLoaderFactory proxy, PerSiteAllowlist, FilterListManager, CSS injection
- **Pipeline stages** for startup and per-request evaluation
- **Integration points** with Chromium's network stack
- **Security model** with trust boundaries and attack surface analysis
- **Open questions** for implementation planning

### [CAPABILITIES.md](./CAPABILITIES.md)
- **8 detailed competitor analyses**: Brave, Chrome, uBlock Origin, Pi-hole, Firefox, Ungoogled-Chromium, Cromite, Safari
- **Comparison matrices** on performance, privacy, extensibility, cosmetic filtering
- **Unique capabilities** of this implementation (agentic browser optimization, Hickory DNS, granular allowlist)
- **Risk/tradeoff matrix** documenting design costs and mitigations

### [ADR-001: Engine Selection](./decisions/ADR-001-engine-selection.md)
- **Decision**: Use adblock-rust (Brave's open-source, MPL-2.0)
- **Alternatives considered**: uBlock Origin (GPLv3 licensing conflict), custom in-house engine (6-12 month effort)
- **Rationale**: Battle-tested at 90M users, <1ms latency, commercial licensing, active maintenance

### [ADR-002: Integration Approach](./decisions/ADR-002-integration-approach.md)
- **Decision**: ContentBrowserClient URLLoaderFactory proxy (network layer)
- **Alternatives considered**: DNS-only (insufficient coverage), extension-based Manifest V3 (rule limits, latency)
- **Rationale**: Full URL matching, first-party ad detection, sub-millisecond latency
- **Hybrid strategy**: Phase 1 network layer + Phase 2 Hickory DNS optimization

### [ADR-003: Filter List Strategy](./decisions/ADR-003-filter-list-strategy.md)
- **Decision**: EasyList + EasyPrivacy (CC BY-SA 3.0, community-maintained)
- **Alternatives considered**: EasyList-only (incomplete), modular opt-in lists (confusing), Brave-compatible internal lists (maintenance burden)
- **Rationale**: ~95% blocking effectiveness, licensing clean, minimal curation
- **Phases**: Phase 1 hardcoded; Phase 2 subscription UI; Phase 3 custom lists

### [ADR-004: Per-Site Bypass](./decisions/ADR-004-per-site-bypass.md)
- **Decision**: Hybrid temporary + permanent allowlist
- **Alternatives considered**: Temporary-only (annoying for repeat visits), permanent-only (safety risk), browser-curated (scalability issues)
- **Rationale**: Safety by default (temp bypass) + power user flexibility (permanent allowlist)
- **UX**: Separate "Allow ads (this session)" and "Always allow ads" in address bar

---

## Key Facts at a Glance

| Aspect | Value |
|--------|-------|
| **Primary Engine** | adblock-rust (Brave's open-source, MPL-2.0) |
| **Integration Point** | Chromium ContentBrowserClient URLLoaderFactory proxy |
| **Filter Lists** | EasyList + EasyPrivacy (CC BY-SA 3.0) |
| **DNS Complement** | Hickory DNS (Phase 2, not Phase 1) |
| **Performance Target** | 3-6x faster on ad-heavy sites, ~21% average |
| **Memory** | ~15MB (adblock-rust + FlatBuffers) |
| **Latency** | <1ms per-request overhead |
| **Licensing** | MPL-2.0 + CC BY-SA 3.0 = commercially viable |

---

## Implementation Roadmap

### Phase 1: MVP (6-8 weeks)
- [ ] Minimal Chromium build + ContentBrowserClient hook
- [ ] adblock-rust FFI integration
- [ ] EasyList + EasyPrivacy loading
- [ ] Basic enable/disable toggle
- [ ] Benchmark on Alexa top-100

### Phase 2: Privacy (4-6 weeks)
- [ ] Hickory DNS resolver (DoH/DoT)
- [ ] Domain-level fast-path blocking
- [ ] Filter list auto-updates (6h interval)

### Phase 3: Advanced (6-8 weeks)
- [ ] Benchmarking dashboard
- [ ] Per-site allowlist UI (address bar + settings)
- [ ] Custom filter list subscription
- [ ] Cosmetic filtering (CSS injection)

---

## Cross-References

**Related research**:
- `/browser-research/dns-ad-blocking/SUMMARY.md` — Research findings and conclusions
- `/browser-research/dns-ad-blocking/STEERING.md` — Next steps and open questions
- `/browser-research/forks/brave/README.md` — Brave Shields reference implementation
- `/browser-research/alternatives/cromite/README.md` — Cromite ad-blocking approach

**Skills and templates**:
- `.claude/skills/feature-architecture/SKILL.md` — Feature architecture skill (this doc follows its structure)

---

## Questions? 

1. **How does this compare to Brave?** → See [CAPABILITIES.md](./CAPABILITIES.md#1-brave-shields-closest-competitor)
2. **Why not just use uBlock Origin?** → See [ADR-001](./decisions/ADR-001-engine-selection.md#option-b-ublock-origin-extension-based)
3. **How does the network layer integration work?** → See [ARCHITECTURE.md § System Overview](./ARCHITECTURE.md#system-overview)
4. **What about privacy and DoH?** → See [ADR-002](./decisions/ADR-002-integration-approach.md#hybrid-approach-phase-1--phase-2)
5. **How do users allow ads on broken sites?** → See [ADR-004](./decisions/ADR-004-per-site-bypass.md#decision)

---

**Created**: 2026-04-04 | **Status**: Architecture Complete | **Next**: Implementation Planning
