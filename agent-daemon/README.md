# Agent Harness Local Inference Daemon

Headless Deno service for local inference. It runs beside `agent-browser`, connects to the web app over WebRTC DataChannels with a WebSocket fallback, and brokers only local OpenAI-compatible inference requests.

The daemon is intentionally not a generic shell executor. Accepted command actions are limited to:

- `ping`
- `listModels`
- `chatCompletion`

Endpoint URLs must resolve to loopback hosts such as `localhost`, `127.0.0.1`, or `[::1]`.

## Develop

```bash
deno task dev
```

## Compile

```bash
deno task compile:windows
deno task compile:windows:x64
deno task compile:linux
deno task compile:macos:x64
deno task compile:macos:arm64
```

Deno does not currently support a Windows ARM64 compile target; use the portable source bundle on Windows ARM64.

## Package for Agent Browser

From the repository root:

```bash
npm run build:extension-downloads
```

The browser-visible daemon package is written to:

```text
agent-browser/public/downloads/agent-harness-local-inference-daemon.zip
```

## Install as a service

Run with Administrator or sudo privileges:

```bash
deno task install-service
```

The install script uses `@cross/service` and starts `AgentHarnessLocalInferenceDaemon`.
