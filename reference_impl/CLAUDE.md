# Workspace Browser Prototype — Agent Instructions

## Overview

This is a single-file React 18 prototype for an agent-first browser. It runs from `file://` in Chrome with no build step — React, ReactDOM, and Babel standalone are loaded from CDN, and all application code lives inside a `<script type="text/babel">` block in `workspace-prototype.html`.

The app reimagines the browser UX from first principles: workspaces replace bookmark folders, tabs live in a tree with memory tiers, an AI chat panel provides a copilot with tool use (MCP apps), and local LLM inference runs in a Web Worker via transformers.js.

## Known Issue: Page Does Not Render

The page currently fails to render. The cause is unknown — Babel standalone parses the code successfully in Node.js, braces are balanced, and there are no obvious syntax errors. The issue may be:

1. A runtime error in a component definition that crashes React's initial render (check DevTools console)
2. Something specific to the browser's Babel standalone transform that differs from Node's `@babel/standalone`
3. A subtle interaction between the `<think>` / `</think>` string literals inside the script tag and Chrome's HTML parser
4. The ThinkingBlock component or its integration in ChatMessage (added in a recent session)

**Debug approach:** Open DevTools (F12), check Console for errors. Switch React from production to development for better error messages:
```html
<!-- Replace production with development builds temporarily -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.development.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.development.js"></script>
```

**If `</think>` in string literals is the issue**, escape them: `"<" + "/think>"` or `"<\/think>"` (regex escape that also works in strings).

## File Structure

```
workspace-prototype.html   — The entire app (3624 lines, ~213KB)
tjs-worker.js             — External Web Worker for transformers.js (fallback)
workspace-prototype.jsx   — Alternate JSX source (721 lines, not actively used)
```

## Architecture: workspace-prototype.html

Single HTML file with three sections:

### 1. Head: CDN Scripts + CSS (~35 lines)
- React 18.2.0 production UMD
- ReactDOM 18.2.0 production UMD  
- Babel standalone 7.23.9
- `<style>` block with keyframe animations: `ping`, `fade-in`, `spin`, `slide-up`, `shimmer`, `blink`, `slide-in-from-right`, `indeterminate`, `switch-tree`, `token-in`, `thinking-pulse`, `reasoning-border`
- Dark theme: `#09090b` background, `#a1a1aa` text, system font stack

### 2. Body: Single `<div id="root">` mount point

### 3. Babel Script Block (~3580 lines)

Organized in this order:

| Lines | Section | Purpose |
|-------|---------|---------|
| 39-104 | Icon system | `I` component + `ic` object with 60+ SVG paths |
| 105-165 | Model config | `MODEL_PROVIDERS`, `API_ENDPOINTS`, `SEED_MODELS` |
| 166-431 | TJS system | Web Worker code (inline Blob URL), `TJS` object with worker + main-thread fallback, `_dynamicImport` trick for Babel |
| 432-598 | Data + MCP | `TIERS`, `MCP_APPS` registry, MCP renderer components (TaskTracker, ImageViewer, Gallery, VideoPlayer, Notes, DataTable) |
| 599-711 | LLM utility | `callLLM()` — Anthropic and OpenAI/OpenRouter support with tool use |
| 712-882 | Tree helpers | `deepUpdate`, `findNode`, `cntTabs`, `sumMem`, `flattenTabs`, `getParentPath`, `classifyOmni` |
| 883-1070 | Tree UI | `TabRow`, `WsFolder` components with drag-drop |
| 1071-1353 | Workspace panel | `MemBar`, `WorkspacePanel` with omnibar, tree view, keyboard nav |
| 1354-1583 | Extensions | `ExtensionsPanel`, marketplace overlay |
| 1584-1874 | Settings | `SettingsPanel` with provider config, HF model browser, local model management |
| 1875-2078 | History + Account | Session history list, account panel stub |
| 2079-2112 | Activity bar | Sidebar icon navigation |
| 2113-2261 | MCP cards | `McpToolCard`, `PageSummaryCard`, `MultiTabTaskCard`, `ImageGalleryCard` |
| 2262-2452 | Chat message | `ThinkingBlock`, `ChatMessage` components |
| 2453-2808 | Chat interface | `ChatInterface` with `doSend`, model selector, input |
| 2809-3002 | Page overlay | `PageChat`, `ElementPickerOverlay`, `PageOverlay` |
| 3003-3060 | Utilities | `flattenTree`, `ShortcutOverlay` |
| 3061-3624 | App component | Main `App` with all state, layout, keyboard handlers |

## Key Systems to Understand

### Thinking Block (the recent work)

**ThinkingBlock component** (~line 2288): Collapsible block matching ChatGPT's "Thought for Xs >" pattern.
- Props: `content` (reasoning text), `duration` (seconds), `isThinking` (boolean)
- While `isThinking`: shows purple spinner + "Thinking" label, auto-expanded, streams reasoning text
- After thinking: collapses to "Thought for {duration}s >" with chevron, click to expand
- Purple theme: `#a78bfa`

**ChatMessage integration** (~line 2346): Renders ThinkingBlock when `msg.thinkingContent` or `msg.isThinking` exists. Message fields:
- `msg.thinkingContent` — extracted text from `<think>...</think>` tags
- `msg.thinkingDuration` — seconds (calculated from timestamps)
- `msg.isThinking` — true while inside `<think>` block

**Token stream parsing** (in `doSend`, ~line 2548): The `onToken` callback parses Qwen3's `<think>...</think>` blocks:
- Tracks `inThink` boolean, `thinkingBuf` string, `thinkStartTime` timestamp
- When `<think>` detected: sets `isThinking=true`, starts accumulating thinking content
- When `</think>` detected: sets `isThinking=false`, calculates duration, switches to normal content
- After `</think>`: strips thinking tags from display, shows only response content
- Finalize step preserves `thinkingContent` and `thinkingDuration` in the completed message

### TJS Web Worker System (~line 166)

Local inference via transformers.js v3 in a Web Worker:

**Worker creation**: Inline source string → Blob URL → `new Worker(blobURL)` (classic, not module). Chrome supports `import()` in classic workers, and Blob URLs bypass `file://` origin restrictions. Fallback chain: Blob worker → file-based worker (`tjs-worker.js`) → main-thread inference.

**Key trick** (~line 172): `const _dynamicImport=new Function("url","return import(url)")` — Babel standalone transforms `import()` to `require()` which doesn't exist in browser. This creates a function that Babel doesn't transform.

**Pipeline caching**: Models are loaded once into `pipelines[task+modelId]` and reused.

**Token streaming**: Uses `TextStreamer` from transformers.js: `new lib.TextStreamer(tokenizer, {skip_prompt:true, callback_function: fn})` passed as `streamer` option to the pipeline.

### Chat Messages Array Format

For text-generation with Qwen3 (and other chat models):
```javascript
const chatMsgs = [
  {role: "system", content: "You are a helpful browser workspace assistant..."},
  ...lastMessages.map(m => ({role: m.role, content: m.content})),
  {role: "user", content: text}
];
prompt = chatMsgs; // Pipeline auto-applies model's chat template
```

### MCP Apps

Registry at `MCP_APPS` defines tools the LLM can invoke: `task_tracker`, `image_viewer`, `gallery`, `video_player`, `notes`, `data_table`. Each has a name, icon, description, and JSON schema for parameters.

`buildMcpTools()` converts the registry to the format expected by each provider's API.

When the LLM returns tool calls, they're matched against the registry and rendered as cards in the chat + optionally opened as panes.

### Workspace Tree

Hierarchical structure: workspace nodes contain tab nodes. Tabs have memory tiers (hot/warm/cool/cold) representing process state. Full keyboard navigation (arrows, enter, space for multi-select, ctrl+x/v for move, type-to-filter). Drag-drop reordering.

## Design Tokens

- Background: `#09090b` (body), `#0c0c0f` (panels)
- Text: `#a1a1aa` (body), `#d4d4d8` (primary), `#e4e4e7` (headings)
- Borders: `rgba(255,255,255,.06)` default, `.12` on focus/hover
- Accent blue: `#60a5fa`, green: `#34d399`, purple: `#a78bfa`, red: `#f87171`, amber: `#fbbf24`
- Font: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif`
- Font size: 13px body, 9-11px labels, 11.5px compact
- Border radius: 4-6px small, 8-10px cards, 12px modals
- All inline styles (no CSS classes except for animations)

## Conventions

- All code in a single `<script type="text/babel">` block — no imports, no modules
- React hooks destructured at top: `const {useState,useCallback,useMemo,useRef,useEffect}=React`
- Icons via `<I d={ic.name} size={n} color="..."/>` — `ic` is a flat object of SVG path strings/arrays
- State updates via `setWorkspaces(ws => deepUpdate(...))` pattern for tree mutations
- Toast notifications via `setToast({msg, type})` with auto-dismiss
- All styling is inline `style={{}}` objects — no CSS-in-JS library
- Compact code style: minimal whitespace, short variable names
- Components are plain functions (not arrow const), defined in dependency order
