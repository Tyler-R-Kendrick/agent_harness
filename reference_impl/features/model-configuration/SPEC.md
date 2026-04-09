# Feature Spec: Model Configuration

## Problem Statement

The browser's LLM chat interface currently has no way to choose which model powers it. Users need to configure both cloud API providers (OpenAI, Anthropic, Google, etc.) for high-quality responses and local WASM-quantized models (via Transformers.js) for offline/private use. Without this, the browser is locked to a single hardcoded model with no offline fallback.

## User Flow

### Flow A: Browse & Connect a Cloud Provider

1. User clicks **Settings** (gear icon) in the activity bar.
2. Settings panel opens. User sees a **"Models"** section at the top.
3. Two sub-tabs: **Providers** (default) | **Local Models**.
4. **Providers tab** shows a list of supported providers (Anthropic, OpenAI, Google, Mistral, OpenRouter, Ollama, custom).
5. Each provider card shows: name, logo placeholder, status (connected / not configured), and model count.
6. User clicks a provider card → expands to show:
   - API key input field (masked by default, toggle visibility)
   - Base URL (pre-filled, editable for custom endpoints)
   - Available models list (fetched or pre-populated)
   - Toggle to enable/disable the provider
7. User enters API key, clicks **Save**. Provider status updates to "Connected."
8. User can check/uncheck individual models within a provider to control which appear in the model selector.

### Flow B: Browse & Install a Local Model

1. User navigates to Settings → Models → **Local Models** tab.
2. Tab shows two sections:
   - **Installed** (top): Models already downloaded and cached. Shows name, size, quantization, and a status indicator.
   - **Available** (below): Browsable list of compatible models from Hugging Face, pre-filtered to models that fit in browser memory.
3. Each available model card shows: name, parameter count, quantization options (q4/q8), estimated size, and estimated performance rating for this device.
4. User clicks **Install** on a model card.
5. Card expands to show download progress: progress bar, percentage, download speed, estimated time remaining, and a **Cancel** button.
6. On completion, model moves to the **Installed** section with a "Ready" badge.
7. User can click **Delete** on any installed model to free cache space.

### Flow C: Switch Models in Chat

1. In the main chat interface, a small model indicator appears near the input area showing the current model name.
2. Clicking it opens a quick-switch dropdown listing all available models (cloud + local), grouped by source.
3. User selects a model. Indicator updates. Subsequent messages use the new model.
4. If user goes offline, cloud models are greyed out. Local models remain available. If a local model is installed, it auto-selects as fallback.

## States & Transitions

| State | Description | Trigger | Visual |
|-------|-------------|---------|--------|
| Provider: not configured | No API key entered | Default | Grey card, "Add key" prompt |
| Provider: connected | API key saved, validated | Save key | Green dot, model list visible |
| Provider: error | Key invalid or API unreachable | Validation fail | Red dot, error message |
| Local model: available | On Hugging Face, not downloaded | Default browse | Install button visible |
| Local model: downloading | Download in progress | Click Install | Progress bar, cancel button |
| Local model: installed | Cached in IndexedDB | Download complete | "Ready" badge, delete button |
| Local model: loading | Loading into WASM memory | Selected for use | Spinner on model indicator |
| Local model: active | Loaded and running inference | Load complete | Green dot on model indicator |
| Local model: error | Download failed or cache full | Error during download | Red badge, retry button |

## Inputs & Outputs

**Inputs:**
- API keys for cloud providers (user-entered, stored securely)
- Model selection (which models are enabled per provider)
- Local model selection (which to download/install)
- Active model choice (which model handles the next message)

**Outputs:**
- Persisted provider configuration (keys, enabled models, base URLs)
- Cached local model files (in IndexedDB via Transformers.js)
- Active model state (current selection, available for chat interface)
- Storage usage summary (how much cache space local models consume)

## Interaction Details

### Provider Cards
- Click card to expand/collapse configuration
- API key field: password-type input with eye toggle for visibility
- Save button validates key format before storing
- Models list: checkboxes to enable/disable individual models
- Provider toggle: master enable/disable switch

### Local Model Cards
- **Available models:** Compact card with Install button. Hover shows full description.
- **Installing:** Card stays expanded with animated progress bar. Download speed in MB/s. ETA countdown. Cancel button stops and cleans up partial download.
- **Installed models:** Show quantization badge (q4/q8), file size, and a delete button. Click to set as active local model.
- **Storage bar:** At bottom of Local Models tab, shows total cache usage vs estimated browser quota.

### Model Selector (in chat)
- Compact pill/badge near the chat input showing current model name
- Click opens dropdown grouped by: "Cloud Models" / "Local Models"
- Cloud models show provider icon. Local models show a device icon.
- Offline state: cloud models greyed with "offline" label. Auto-fallback to best local model if one is installed.

### Keyboard
- Tab through provider cards and model options
- Enter to expand/collapse cards
- Escape to close expanded cards or model selector dropdown

### Accessibility
- All interactive elements focusable and labeled
- Progress bars have aria-valuenow/aria-valuemax
- Status changes announced via aria-live regions

## Non-Goals (v1)

- Fine-tuning or training models in-browser
- Model performance benchmarking beyond basic speed estimates
- Syncing model configuration across devices
- Custom model file import (only Hugging Face hub browsing)
- Multi-model routing (OpenRouter-style auto-routing between providers)
- Streaming token-by-token from local models (batch response is fine for v1)

## Open Questions

1. Should we persist API keys in the browser's credential store or encrypt in localStorage? (Security implications for a browser app.)
2. What's the right set of pre-filtered local models? Should we curate a "recommended" list or show everything compatible?
3. Should model switching mid-conversation start a new context or continue the existing one?
