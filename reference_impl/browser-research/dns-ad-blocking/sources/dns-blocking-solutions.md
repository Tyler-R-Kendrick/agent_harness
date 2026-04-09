# DNS-Level Blocking Solutions

## Overview

DNS-level ad blocking works by intercepting DNS queries and returning null responses (0.0.0.0 or NXDOMAIN) for known ad/tracker domains. This prevents the browser from ever connecting to the ad server — the request dies at the DNS resolution stage.

## Solutions Evaluated

### Pi-hole

**What it is**: A network-wide DNS sinkhole, typically run on a Raspberry Pi or server, that acts as the DNS resolver for all devices on the network.

**Architecture (v6)**: Pi-hole v6 embeds the web server and REST API directly inside the `pihole-FTL` binary, eliminating the old lighttpd/PHP dependency chain. FTL (Faster Than Light) handles DNS resolution, blocklist management, and the admin interface in a single process.

**Strengths**: Mature, well-maintained, community-driven blocklists, modular architecture, group-based client management, good network policy control.

**Limitations for browser embedding**: Designed as a network service, not an in-process library. Would need significant adaptation to run embedded in a browser process. Overkill for single-device blocking.

### AdGuard Home

**What it is**: Similar to Pi-hole but with more features out of the box. Acts as a DNS server with built-in ad/tracker blocking.

**Strengths**: Native DNS-over-HTTPS (DoH) and DNS-over-TLS (DoT) support, per-client rules, richer parental controls, broader feature set without additional configuration.

**Limitations for browser embedding**: Same as Pi-hole — designed as a standalone network service. The Go implementation is also less suitable for embedding in a C++/Rust browser codebase compared to a Rust library.

### AdGuard DNS (Cloud)

**What it is**: A public DNS service (94.140.14.14 / 94.140.15.15) that performs server-side ad blocking. The browser just points its DNS resolver at AdGuard's servers.

**Strengths**: Zero integration effort — just change the DNS server. No filter list management needed.

**Limitations**: Introduces latency (round-trip to external DNS vs. local resolution), requires network connectivity to AdGuard's servers, can't do cosmetic filtering, limited customization, privacy implications of routing all DNS queries through a third party.

### Hickory DNS (formerly Trust-DNS)

**What it is**: A Rust-based DNS client, server, and resolver library. The resolver component is a **100% in-process DNS resolver** that doesn't use the host OS's resolver.

**Repository**: https://github.com/hickory-dns/hickory-dns

**Key features**:
- Full recursive DNS resolution in-process
- DNS-over-TLS and DNS-over-HTTPS support (via rustls)
- Multi-domain search, dual-stack IPv4/IPv6
- Connection metric tracking (picks best upstream resolver)
- mDNS support for .local zone
- Pure Rust, no C dependencies

**Strengths for browser embedding**: This is the most promising candidate for an embedded DNS sinkhole. Being pure Rust and designed as a library (not a service), it could be integrated directly into the browser process. Combined with a blocklist of ad/tracker domains, it could intercept DNS queries at the application level and return null responses for blocked domains.

**Limitations**: DNS-level blocking alone can't do cosmetic filtering (hiding ad placeholder elements), can't block first-party ads served from the same domain, and can't match on URL paths — only on domains.

## DNS Blocking vs. Filter List Blocking

| Aspect | DNS Blocking | Filter List (adblock-rust) |
|--------|-------------|---------------------------|
| Granularity | Domain-level only | Full URL path + parameters |
| Cosmetic filtering | No | Yes (CSS injection, element hiding) |
| First-party ads | Can't block (same domain) | Can block by URL pattern |
| Performance | Very fast (domain lookup) | Fast (sub-ms, but more work per request) |
| Memory | Small (domain list ~5-10MB) | Larger (~15MB after optimization) |
| Filter lists | Domain lists (hosts format) | ABP syntax lists (EasyList etc.) |
| Maintenance | Simpler lists | Complex rule syntax |

## Recommendation

DNS-level blocking alone is **insufficient** for competitive ad blocking. It handles the easy cases (third-party ad domains) but misses first-party ads, can't do cosmetic filtering, and can't match on URL paths.

However, an embedded DNS resolver (Hickory DNS) could be valuable as a **complement** to filter-list-based blocking:
1. Use Hickory DNS as the browser's DNS resolver for privacy (DoH/DoT) and performance (local caching)
2. Add domain-level blocking at the DNS layer as a first pass (fast, catches obvious ad domains)
3. Use adblock-rust for full filter-list matching as a second pass (handles the nuanced cases)

This layered approach would give the best of both worlds.

## Sources

- https://github.com/hickory-dns/hickory-dns
- https://pi-hole.net/
- https://getblockify.com/blog/adguard-home-vs-pi-hole/
- https://securitypulse.tech/2025/11/23/dns-sinkhole-101-with-pi-hole-and-adguard-home/
