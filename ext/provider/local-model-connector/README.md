# Local Model Connector

Local Model Connector is a Manifest V3 Chrome/Edge extension that lets approved hosted PWAs talk to user-approved local OpenAI-compatible endpoints without asking the local model runtime to configure CORS or Private Network Access headers.

```text
Hosted PWA
  -> chrome.runtime external messaging
Local Model Connector service worker
  -> fetch with extension host permissions
Local OpenAI-compatible endpoint
```

The extension only accepts configured PWA origins and only fetches loopback `http://127.0.0.1:<port>/v1` or `http://localhost:<port>/v1` targets. It is not a generic fetch proxy.

## Package Boundary

Use the package root as the stable plugin import:

```ts
import { createLocalModelConnectorPlugin } from '@agent-harness/ext-local-model-connector';
```

Use the manifest subpath when a host needs the Agent Harness plugin metadata:

```ts
import manifest from '@agent-harness/ext-local-model-connector/manifest';
```

Treat `@agent-harness/ext-local-model-connector/src/*` deep imports as private
implementation modules. The extension service worker, validation, storage, and
client modules are packaged for the loadable browser extension and local tests;
they are not a supported application integration surface.

Published package contents intentionally include the README, plugin manifest,
Chrome manifest template, build scripts, runtime TypeScript source, and generated
extension `dist/**` files while excluding source tests and source maps.

## Developer Setup

Build the extension:

```bash
npm --workspace @agent-harness/ext-local-model-connector run build
```

The loadable extension is written to:

```text
ext/provider/local-model-connector/dist
```

Build the Agent Browser downloadable extension zip:

```bash
npm run build:extension-downloads
```

The browser-visible package is written to:

```text
agent-browser/public/downloads/local-model-connector-extension.zip
```

Load it in Chrome or Edge:

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select `ext/provider/local-model-connector/dist`.

Configure allowed PWA origins at build time:

```bash
LOCAL_MODEL_CONNECTOR_ALLOWED_ORIGINS="https://app.example.com/*,https://app-dev.example.com/*" npm --workspace @agent-harness/ext-local-model-connector run build
```

For local Agent Browser development, the default manifest also allows `http://localhost/*` and `http://127.0.0.1/*`; the service worker validates the sender origin again before handling messages.

Set the extension ID in the PWA:

```bash
VITE_LOCAL_MODEL_CONNECTOR_EXTENSION_ID="<chrome-extension-id>" npm --workspace agent-browser run dev
```

You can also set `localStorage["local-model-connector.extension-id"]` for local manual testing.

Run the relevant checks:

```bash
npm --workspace @agent-harness/ext-local-model-connector run test
npm --workspace @agent-harness/ext-local-model-connector run test:coverage
npm --workspace @agent-harness/ext-local-model-connector run lint
npm --workspace @agent-harness/ext-local-model-connector run build
```

Run the example PWA surface:

```bash
npm --workspace agent-browser run dev
```

Open Settings, then **Local OpenAI-compatible endpoint**.

## User Setup

1. Install or load the Local Model Connector extension.
2. Start a local OpenAI-compatible runtime such as LM Studio, Ollama's OpenAI-compatible API, Foundry Local, or another compatible server.
3. Open the web app settings panel.
4. Choose a provider preset.
5. Confirm the endpoint URL includes `/v1`.
6. Grant permission for the local endpoint.
7. Test the connection.
8. Choose a model and save settings.

API keys are not stored unless **Store API key in extension storage** is enabled.

## Supported Endpoints

Required:

```text
GET  /v1/models
POST /v1/chat/completions
```

Optional future-compatible paths guarded by validation:

```text
POST /v1/embeddings
POST /v1/completions
```

Runtime-specific chat completion fields are preserved as JSON pass-through
fields after the connector validates the standard OpenAI-compatible body. Use
that for runtime-supported features such as sparse-autoencoder activation
controls, adapters, or sampling knobs without tying the connector to one model
family. For example, a runtime that supports SAE can receive an `sae` object for
Qwen, DeepSeek, Mistral, or any other compatible model; unsupported runtimes are
expected to reject or ignore those fields.

Provider presets:

```text
LM Studio                         http://127.0.0.1:1234/v1
Ollama OpenAI-compatible API      http://127.0.0.1:11434/v1
Foundry Local                     http://127.0.0.1:<port>/v1
Custom OpenAI-compatible endpoint user supplied
```

## Troubleshooting

Extension not detected:

- Confirm the extension is installed and enabled.
- Confirm the PWA is using the correct extension ID.
- Confirm the PWA origin is listed in `externally_connectable`.

Permission denied:

- Re-open settings and grant access to the local endpoint.
- Confirm the endpoint uses `localhost` or `127.0.0.1`.

Endpoint unavailable:

- Confirm the local runtime is running.
- Confirm the port is correct.
- Confirm the endpoint path includes `/v1`.

No models found:

- Confirm the runtime supports `GET /v1/models`.
- Confirm at least one model is installed or loaded.

Streaming does not work:

- Confirm the runtime supports OpenAI-compatible streaming chat completions.
- Fall back to non-streaming mode.
