---
feature: dns-ad-blocking
section: technical-architecture
created: 2026-04-04
---

# Technical Architecture: DNS-Level Ad Blocking

## System Overview

```
Browser Startup
    ↓
    ├─→ Load filter lists from disk (EasyList + community)
    │   ↓
    │   ├─→ adblock-rust Engine::parse_rules()
    │   │   ↓
    │   │   └─→ Compile to FlatBuffers (15MB resident)
    │   └─→ Store in SharedMemory (per-process)
    │
    └─→ Network Layer (URLLoaderFactory)
        │
        ├─→ HTTPSUpgrade Service (unrelated)
        ├─→ AdBlockProxy ← NEW
        │   ├─→ PerSiteAllowlist check
        │   ├─→ adblock-rust Engine::check_network_request()
        │   │   ├─→ URL matching (<1ms)
        │   │   ├─→ Type checking (script, image, etc.)
        │   │   └─→ Return BlockDecision
        │   │
        │   ├─→ IF Allow: pass to ChromeNetworkDelegate
        │   ├─→ IF Block: cancel request (net::ERR_BLOCKED_BY_CLIENT)
        │   └─→ IF Block+Css: queue CSS injection for renderer
        │
        └─→ Renderer
            └─→ CSS Injection (cosmetic filtering)
                └─→ Hide ad placeholders (optional Phase 1b)

Data Flow (Network Request):
    User navigates to example.com
        ↓
    Blink -> URLLoaderFactory::CreateLoaderAndStart()
        ↓
    AdBlockProxy::OnBeforeURLRequest()
        ├─→ Check PerSiteAllowlist (example.com in allowlist? → Allow)
        └─→ adblock-rust::check_network_request("https://ads.com/banner.js", "script")
            └─→ EasyList contains "-ads-" → Block
        ↓
    ChromeNetworkDelegate (sees nothing, request already cancelled)
        ↓
    Network stack (request never sent)
        ↓
    User saves bandwidth + gets faster page load
```

## Core Components

### 1. AdblockEngine (Rust FFI Wrapper)

**Responsibility**: Lifetime management of the adblock-rust Engine instance; safe FFI bridge between C++ network stack and Rust filtering logic.

**Input**:
- Filter list bytes (EasyList .txt format)
- Per-request: `(url: String, request_type: ResourceType, is_third_party: bool)`

**Output**:
- Startup: Compiled FlatBuffers filter rules (~15MB resident)
- Per-request: `BlockDecision { action: Allow | Block | BlockAndHide, css_selector: Option<String> }`

**Performance Target**: Sub-millisecond per-request matching (adblock-rust compiled rules are O(1) or O(log n) depending on rule type).

**Key Design**:
- Single Engine instance per browser process (not per-tab to save memory)
- FlatBuffers caching: compiled rules serialized at build time or first-run, loaded directly into shared memory
- Thread-safe via `Arc<Mutex<Engine>>` for calls from network thread

### 2. URLLoaderFactory Proxy (AdBlockProxy)

**Responsibility**: Intercept network requests at Chromium's URLLoaderFactory level; evaluate against AdblockEngine; allow or cancel based on BlockDecision.

**Input**:
- `ResourceRequest` (url, method, headers, request_type)
- Context: `RenderFrameHost` (for same-site/third-party evaluation)

**Output**:
- Allow: request proceeds unchanged
- Block: request cancelled with `net::ERR_BLOCKED_BY_CLIENT`
- Block+Css: request cancelled + CSS selector queued for renderer process

**Latency Target**: <1ms overhead per request (measured in network profiler).

**Integration Point**: `ContentBrowserClient::CreateNetworkDelegate()` or `CreateURLLoaderFactory()` hook. Chromium v121+ exposes `URLLoaderFactory` as proxyable interface.

**Pipeline Stages**:

| Stage | Function | Latency |
|-------|----------|---------|
| **Parse Request** | Extract URL, type, third-party status | <100µs |
| **Allowlist Check** | Lookup PerSiteAllowlist (hash table) | <10µs |
| **Engine Evaluate** | adblock-rust URL matching + rules | <900µs (99th percentile) |
| **CSS Queue** (optional) | If Block+Css, queue selector for renderer | <50µs |
| **Decision** | Return Allow/Block | <10µs |

### 3. PerSiteAllowlist Manager

**Responsibility**: Store, retrieve, and manage user exceptions to ad blocking.

**Data Model**:
```json
{
  "allowlist": [
    "example.com",
    "https://trusted.example.com/*",
    "regex:^https://intranet\\.company\\.com"
  ],
  "version": 2,
  "last_updated": 1712275200
}
```

**Storage**: Browser prefs (encrypted if profile is encrypted); survives browser restart.

**Query Interface**:
- `IsAllowlisted(url, domain) → bool` (called before engine evaluation)
- `AddAllowlist(pattern)` (user clicks "allow ads on this site")
- `RemoveAllowlist(pattern)` (user revokes exception)

**Latency**: <10µs for typical queries (hash table lookup of ~50-100 entries).

### 4. FilterList Manager (Startup + Async Updates)

**Responsibility**: Fetch, validate, parse, and cache filter lists; trigger AdblockEngine recompilation on updates.

**Pipeline**:

| Stage | Trigger | Action | Latency |
|-------|---------|--------|---------|
| **Fetch** | Startup or periodic (6h) | Download EasyList + community lists from CDN | 100-500ms (network-bound) |
| **Validate** | After download | SHA-256 checksum; ABP format validation | 10-50ms |
| **Parse** | After validation | Feed to adblock-rust::Engine::parse_rules() | 100-300ms (first run); cached after |
| **Compile** | After parse | adblock-rust FlatBuffers serialization | 50-100ms |
| **Persist** | After compile | Write to disk; mark version in prefs | 50ms (disk I/O) |
| **Activate** | On browser startup | Load cached FlatBuffers into shared memory | 10-50ms (mmap) |

**Design Decision**: Async update thread (not on UI thread) to avoid stuttering.

### 5. CSS Injection / Cosmetic Filtering (Phase 1b, Optional)

**Responsibility**: Hide elements matched by cosmetic filtering rules (non-blocking ads that are visible but should be hidden).

**Data Flow**:
1. AdblockEngine returns `Block { css_selector: ".advertisement" }`
2. AdBlockProxy queues selector in per-frame state
3. Content script in renderer injects `<style>.advertisement { display: none !important }</style>` before DOMContentLoaded
4. User sees no placeholder or whitespace for blocked ads

**Latency**: <1ms injection (cached selectors, no network calls).

**Note**: CSS injection is cosmetic only and does not prevent request execution (unlike URL blocking). Prioritize URL blocking in Phase 1, defer CSS to Phase 1b.

## Data Flow: Complete Request Lifecycle

### Scenario: Loading example.com with ads.doubleclick.net banner

**Step 1: Browser Startup (0ms)**
```
AdblockEngine::new() initialized
Filter list loaded from disk (EasyList 7MB uncompressed → 15MB in memory via FlatBuffers)
PerSiteAllowlist loaded from prefs
URLLoaderFactory proxy registered
```

**Step 2: User navigates to example.com (100-500ms)**
```
User types "example.com" and presses Enter
Blink parser begins HTML fetch
```

**Step 3: HTML Parsing Discovers Resource (50-200ms)**
```
<img src="https://ads.doubleclick.net/banner.jpg?cid=123">
Blink emits URLRequest for ads.doubleclick.net
```

**Step 4: Network Stack → AdBlockProxy (0-1ms)**
```
URLLoaderFactory::CreateLoaderAndStart()
    ↓ delegates to AdBlockProxy::OnBeforeURLRequest()
```

**Step 5: AdBlockProxy Evaluation (<1ms)**
```
1. Parse: url="https://ads.doubleclick.net/banner.jpg", type=Image, third_party=true
2. Allowlist: "example.com" not in allowlist; continue
3. Engine: check_network_request() → matches "-doubleclick-" pattern in EasyList
   Result: BlockDecision::Block
4. Action: Cancel request (net::ERR_BLOCKED_BY_CLIENT)
   Return from proxy
```

**Step 6: Network Stack Never Makes Request**
```
Request never sent to doubleclick.net
Blink never receives response
Image placeholder shows nothing (or cosmetic CSS hides it)
```

**Step 7: Page Finishes Loading (2-4s faster)**
```
Fewer resources to load → DOM ready sooner → page interactive sooner
User sees fully-rendered page without ads
```

## Integration Points

### Chromium's Network Layer

**Hook Point**: `ContentBrowserClient::CreateNetworkDelegate()` or Chromium v121+ URLLoaderFactory proxy pattern.

**Implementation**:
- Subclass `net::NetworkDelegate` (or implement URLLoaderFactory proxy interface)
- Override `OnBeforeURLRequest()` callback
- Call AdblockEngine synchronously (must not block longer than 1ms)
- Return `NetworkDelegate::AuthRequiredResponse` with `net::ERR_BLOCKED_BY_CLIENT` for blocks

**Code Pattern** (pseudocode):
```cpp
class AdBlockProxy : public net::NetworkDelegate {
  int OnBeforeURLRequest(net::URLRequest* request, ...) override {
    const std::string& url = request->url().spec();
    const ResourceType type = request->resource_type();

    // Check allowlist
    if (allowlist_.IsAllowlisted(request->initiator(), url)) {
      return OK;
    }

    // Evaluate against adblock-rust engine
    BlockDecision decision = adblock_engine_->check_network_request(
        url, type, is_third_party);

    if (decision == BlockDecision::Block) {
      return net::ERR_BLOCKED_BY_CLIENT;
    }

    // If Block+Css, queue selector for renderer (separate flow)
    if (decision == BlockDecision::BlockAndHide) {
      frame_css_selectors_[request->render_frame_id()].push_back(
          decision.css_selector);
    }

    return OK;
  }
};
```

### Rust FFI Bridge

**Files**:
- `//chrome/browser/net/adblock_proxy.cc` (C++ wrapper)
- `//brave/components/adblock_rust_ffi/ffi.cc` (FFI binding to adblock-rust crate)

**Build Integration** (GN):
```gn
# In DEPS and BUILD.gn
source_set("adblock_proxy") {
  deps = [
    "//brave/components/adblock_rust_ffi",  # FFI crate
    "//net",
  ]
  sources = [ "adblock_proxy.cc" ]
}

# In brave/components/adblock_rust_ffi/BUILD.gn
rust_library("adblock_rust_ffi") {
  deps = [ "//third_party/rust/adblock:lib" ]  # adblock-rust crate
  source_root = "lib.rs"
}
```

### Renderer Process (CSS Injection)

**Hook Point**: Content script injected before DOMContentLoaded.

**Flow**:
1. Network process queues CSS selector for frame
2. Renderer process receives message: `mojo::blink::AdblockCSS::InjectSelectors()`
3. Content script adds `<style>` tag with selectors to `<head>`

**Latency**: Injected within 100ms of page load start (before user sees content).

## Security Model

### Attack Surface

1. **Malicious Filter Lists**: Attacker supplies filter list with regex that causes ReDoS (regex denial of service) in rule matching.
   - **Mitigation**: adblock-rust uses memmem-based string matching (not regex) for most rules. Regex rules are bounded to <100ms timeout.

2. **Per-Request Latency**: Attacker requests many resources rapidly; AdblockEngine matching becomes bottleneck.
   - **Mitigation**: FlatBuffers caching ensures O(1) or O(log n) matching. Synchronous evaluation is safe because network stack is already parallel (multiple requests in flight).

3. **Filter List Poisoning**: Attacker compromises CDN; malicious rules block legitimate content.
   - **Mitigation**: Filter lists are user-provided (can be pinned by checksum). Bad lists are immediately visible (page breakage). User can revert to previous version.

4. **Allowlist Bypass**: Attacker injects JavaScript to modify PerSiteAllowlist prefs.
   - **Mitigation**: Prefs are isolated from JavaScript context. Only browser UI (not web pages) can modify them.

### Trust Boundaries

```
╔════════════════════════════════════════════════════════════╗
║  User (trusted)                                            ║
║  ├─ Browser settings (trusted)                            ║
║  │  └─ PerSiteAllowlist (user-controlled)                 ║
║  └─ Filter list sources (external, verify via hash)       ║
║                                                            ║
║  AdblockEngine (trusted, built-in)                        ║
║  ├─ adblock-rust crate (open-source, auditable)           ║
║  └─ Compiled rules (read-only at runtime)                 ║
╠════════════════════════════════════════════════════════════╣
║  Network requests (untrusted)                              ║
║  ├─ URL (evaluated against trusted rules)                 ║
║  ├─ Headers (not inspected for blocking)                  ║
║  └─ Body (never examined)                                 ║
╠════════════════════════════════════════════════════════════╣
║  Web content (untrusted)                                   ║
║  ├─ Cannot modify PerSiteAllowlist                        ║
║  ├─ Cannot modify filter lists                            ║
║  └─ Cannot bypass AdblockEngine evaluation                ║
╚════════════════════════════════════════════════════════════╝
```

## Open Questions

1. **FlatBuffers Caching Strategy**: Should compiled filter rules be pre-serialized at build time (reduces startup overhead but increases binary size by ~20MB) or compiled on first run and cached to disk (slower first startup but smaller initial download)?

2. **Hickory DNS Integration Timing**: Should DoH/DoT resolver be integrated in Phase 1 or deferred to Phase 2? DoH adds privacy but increases complexity; can start with standard system DNS in Phase 1.

3. **CSS Injection Scope**: Should cosmetic filtering (hiding non-blocked elements) be in Phase 1 MVP or Phase 1b feature? URL blocking is higher impact; CSS is nice-to-have.

4. **Per-Frame Allowlist Evaluation**: If user allowlists "example.com", should ads served via example.com be allowed even if they're from a different origin? (Current design: allowlist is per-initiator domain, not per-request-origin.)

5. **Memory Pressure**: If filter lists grow beyond 25MB, what's the fallback? Should we support list pruning, selective loading, or on-disk caching of inactive rules?

6. **Update Mechanism**: Should filter list updates be automatic (6h interval) or user-controlled? Automatic updates can fix security issues but may break sites; user control is safer but leaves users vulnerable.

See [ADR-003](./decisions/ADR-003-filter-list-strategy.md) and [ADR-004](./decisions/ADR-004-per-site-bypass.md) for related decisions.
