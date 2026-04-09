# Integration Plan: Model Configuration

## Target Codebase

`workspace-prototype.html` — a single-file React 18 + Babel standalone prototype (~1250 lines) implementing an agentic browser with an activity bar, sidebar panels (Workspaces, History, Extensions, Account, Settings), LLM chat center, and page overlays.

## Architecture Approach

The model configuration feature touches three areas of the existing prototype:

1. **Settings Panel** — Replace the current placeholder `SettingsPanel` component with a full model configuration UI (Providers tab + Local Models tab).
2. **Chat Interface** — Add a model selector pill near the chat input that lets users switch models without leaving the chat.
3. **App State** — Lift model state (providers, local models, active model) to the `App` component so both the settings panel and chat interface share it.

### Data Flow

```
App (state: providers, localModels, activeModel)
  ├─> SettingsPanel → ProviderCards, LocalModelCards
  │     └─ updates flow up via onUpdate/onInstall/onDelete callbacks
  └─> ChatInterface → ModelSelector pill
        └─ onSelectModel callback updates App state
```

## File Map

| Action | Location (within workspace-prototype.html) | Description |
|--------|---------------------------------------------|-------------|
| Replace | `SettingsPanel` component (~line 410) | Replace 10-line placeholder with full Providers/Local Models tabbed panel |
| Create | `ProviderCard` component | New component: expandable card with API key, base URL, model toggles |
| Create | `LocalModelCard` component | New component: model card with install/delete, download progress bar |
| Create | `StorageBar` component | New component: IndexedDB cache usage indicator |
| Create | `ModelSelector` component | New component: dropdown listing cloud + local models, grouped |
| Modify | `ChatInterface` component (~line 573) | Add model selector pill to the input area |
| Modify | `App` component (~line 996) | Add state: providers, localModels, activeModel. Pass to SettingsPanel and ChatInterface |
| Add | `ic` object (~line 43) | Add icons: cloud, cpu, hardDrive, server, key, toggleLeft, toggleRight, wifiOff |
| Add | Top of `<script>` block | Add PROVIDERS and LOCAL_MODELS data constants |

## Implementation Sequence

1. **Add icons** to the `ic` object (no dependencies)
2. **Add mock data** constants: PROVIDERS array, LOCAL_MODELS array (no dependencies)
3. **Build ProviderCard** component (depends on: icons, data)
4. **Build LocalModelCard** component with download simulation (depends on: icons, data)
5. **Build StorageBar** component (depends on: data)
6. **Replace SettingsPanel** with tabbed Providers/Local panel using new components (depends on: steps 3-5)
7. **Build ModelSelector** dropdown component (depends on: icons, data)
8. **Add model selector pill** to ChatInterface's input area (depends on: step 7)
9. **Lift model state** to App and wire props to SettingsPanel and ChatInterface (depends on: steps 6, 8)

## Dependencies

No new external dependencies. Everything uses:
- React 18 (already loaded via CDN)
- Babel standalone (already loaded)
- Inline SVG icons (existing pattern)
- CSS-in-JS via React style objects (existing pattern)

For production (not prototype), the local models feature would depend on:
- `@huggingface/transformers` (Transformers.js v3) for WASM/WebGPU inference
- IndexedDB for model caching (browser-native, no library needed)
- Web Workers for inference off the main thread

## Performance Considerations

- **Prototype:** No performance concerns. Mock data is small, download progress is simulated.
- **Production — model downloads:** 500MB-4GB transfers. Must happen in a background worker. Progress updates should be throttled to ~10Hz to avoid flooding the UI thread.
- **Production — model loading:** Loading a model into WASM memory takes 2-10s. The chat interface needs a loading state while the model initializes.
- **Production — inference:** Must run in a Web Worker to avoid blocking the UI. Use `postMessage` for streaming tokens back to the main thread.
- **Storage quota:** IndexedDB quota varies by browser. Need `navigator.storage.estimate()` to show accurate quota in the StorageBar.

## Testing Strategy

**Prototype testing (manual):**
- Click through all provider cards — expand, enter key, save, toggle models
- Install a local model — verify progress bar animation, cancel mid-download, verify completion
- Delete an installed model — verify it moves back to "available"
- Switch models via the selector pill — verify active model updates
- Search local models — verify filtering works
- Check storage bar updates when models are installed/deleted

**Production testing:**
- Unit tests for provider state management (key validation, enable/disable)
- Integration tests for Transformers.js model loading (mock the pipeline)
- E2E tests for the full download → cache → load → inference flow
- Offline simulation: disconnect network, verify cloud models grey out, local models still work

## Estimated Effort

**Prototype integration: S (Small)** — ~200 lines of new components, ~20 lines of state wiring in App. The prototype code from `features/model-configuration/prototype/index.html` can be adapted directly.

**Production implementation: L (Large)** — Transformers.js integration, Web Worker setup, IndexedDB management, real API key storage, actual model registry fetching, and offline detection add significant complexity beyond the UI.
