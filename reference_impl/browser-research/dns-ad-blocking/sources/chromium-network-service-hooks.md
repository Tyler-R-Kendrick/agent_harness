# Chromium Network Service: Integration Points for Ad Blocking

## Network Service Architecture

Chromium's network stack runs as a **Mojo service** that can operate either in-process (inside the browser process) or out-of-process (in a dedicated utility process). The browser process launches the network service and decides the hosting mode.

### Request Flow

1. Renderer process creates a `URLLoaderFactory` via the browser process
2. `URLLoaderFactory` creates a `URLLoader` for each request
3. `URLLoader` passes through the network service's request pipeline
4. DNS resolution, connection, and response delivery happen within the network service

### Key Interception Points

#### 1. Content Embedder API (Preferred for Forks)

Chromium's architecture allows **embedders** (browsers built on Chromium's content layer) to intercept requests via the content embedder API. This is the same mechanism Vivaldi uses for its built-in ad blocker:

> "Vivaldi's Ad Blocker is built on the same internal Chromium API that is used by both the Manifest V2 version of webRequest and declarativeNetRequest... designed to allow Chromium/content embedders to interact with requests performed with the Chromium network service."

The basic mechanism: requests from the network service get proxied through embedder-provided code that can examine, modify, or block the request **before it reaches the network**.

This is the cleanest integration point for a Chromium fork — it's the intended mechanism for embedders and doesn't require deep modifications to the network service itself.

#### 2. URLLoaderFactory Interception

A fork can provide a custom `URLLoaderFactory` implementation that wraps the default one. Before forwarding requests to the real factory, it can:
- Check the request URL against a blocklist
- Return an empty response for blocked URLs
- Modify request headers

This is structurally similar to how extensions work, but without the IPC overhead of the extension sandbox.

#### 3. Network Service Proxy

The network service's internal architecture has proxy points where request metadata (URL, headers, initiator origin, resource type) is available before the request is sent. A fork could add a filter check at this layer.

### CEF (Chromium Embedded Framework) Model

CEF provides `CefRequestHandler::OnBeforeResourceLoad` and `CefResourceRequestHandler` callbacks that let embedders intercept every resource request. While CEF itself is a higher-level abstraction, the pattern demonstrates how Chromium's architecture supports pre-request interception at the embedder level.

### DevTools Protocol (Not Recommended for Production)

The Chrome DevTools Protocol has `Network.setRequestInterception` (deprecated) and `Fetch.enable` for request interception. These are designed for debugging tools, not production ad blocking — they add significant overhead and aren't suitable for intercepting every request.

## Integration Strategy for adblock-rust

The recommended integration path:

1. **Hook into the content embedder API** at the `ContentBrowserClient` level
2. On each network request, extract: request URL, source/initiator URL, resource type
3. Call `adblock_engine.check_network_request(url, source_url, resource_type)`
4. If blocked: return an empty response or cancel the request
5. If redirected: modify the request URL per the engine's redirect instruction
6. If allowed: pass through to the normal network service pipeline

This keeps the modification surface minimal — no changes to the network service itself, just embedder-level hooks that Chromium's architecture explicitly supports.

## Manifest V3 Context

Chrome's shift from Manifest V2 (webRequest API, which allowed synchronous blocking) to Manifest V3 (declarativeNetRequest, which is limited to static rule sets evaluated by the browser) has weakened extension-based ad blocking. A browser fork with native ad blocking is **unaffected** by this change — it operates below the extension layer entirely.

Recent reporting (Feb 2026) suggests MV3's impact on ad blocking has been less severe than feared, with uBlock Origin Lite and other MV3 ad blockers still performing reasonably well. But native integration remains strictly superior for performance.

## Sources

- https://chromium.googlesource.com/chromium/src/+/lkgr/services/network/README.md (blocked but referenced)
- https://vivaldi.com/blog/manifest-v3-webrequest-and-ad-blockers/
- https://chromiumembedded.github.io/cef/general_usage.html
- https://www.theregister.com/2026/02/06/chrome_mv3_no_harm_ad_blocking/
