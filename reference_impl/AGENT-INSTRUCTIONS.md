# Agent-First Browser Prototype — Build Instructions

Reproduce a single-file React 18 prototype for an agent-first browser. The entire app lives in one HTML file (`workspace-prototype.html`) loaded via `file://` in Chrome with no build step. React 18.2.0, ReactDOM 18.2.0, and Babel standalone 7.23.9 are loaded from cdnjs CDN. All application code goes in a single `<script type="text/babel">` block. All styling is inline `style={{}}` objects — no CSS-in-JS library, no CSS classes except for keyframe animations defined in a `<style>` tag.

## Design System

Dark theme. Background `#09090b` (body), `#0c0c0f` (panels). Text `#a1a1aa` (secondary), `#d4d4d8` (primary), `#e4e4e7` (headings). Borders `rgba(255,255,255,.06)`, `.12` on hover/focus. Accent colors: blue `#60a5fa`, green `#34d399`, purple `#a78bfa`, red `#f87171`, amber `#fbbf24`. Font stack: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif`. Body font size 13px, labels 9-11px, compact text 11.5px. Border radius 4-6px for small elements, 8-10px for cards, 12px for modals. Scrollbar 5px wide, transparent track, subtle thumb.

Keyframe animations in `<style>`: `ping` (pulsing scale), `fade-in` (opacity+translateY), `spin` (rotation), `slide-up` (tooltip entry), `shimmer` (skeleton loading), `blink` (cursor/dots), `slide-in-from-right`, `indeterminate` (progress bar), `switch-tree` (folder expand), `token-in` (token fade), `thinking-pulse` (opacity 0.4→0.8→0.4), `reasoning-border` (purple border pulse). CSS classes: `.shimmer`, `.typing-dot` (staggered blink), `.thinking-indicator`, `.stream-cursor::after` (blinking "▌").

## Code Conventions

Destructure React hooks at top: `const {useState,useCallback,useMemo,useRef,useEffect}=React`. Components are plain functions (not const arrow), defined in dependency order. Compact code style with short variable names. State updates for tree mutations use `setWorkspaces(ws => deepUpdate(...))`. Toast notifications via `setToast({msg, type})` with auto-dismiss. Mount with `ReactDOM.render(<App/>,document.getElementById("root"))`.

## Icon System

Define a reusable SVG icon component `I` that takes `{d, size, color, fill, sw, style}` and renders an `<svg>` with `viewBox="0 0 24 24"`. The `d` prop is either a single SVG path string or an array of path strings (for multi-path icons). Define a flat `ic` object mapping ~60 icon names to their SVG path data: `chevron`, `arrowRight`, `arrowLeft`, `arrowDown`, `folder`, `folderOpen`, `layers`, `package`, `fileText`, `plus`, `x`, `search`, `download`, `link`, `send`, `trash`, `checkCircle`, `check`, `loader` (multi-path), `refreshCw`, `eye`, `eyeOff`, `settings`, `user`, `shield`, `palette`, `keyboard`, `terminal`, `messageSquare`, `panelRight`, `desktops`, `mouse`, `clock`, `image`, `code`, `cloud`, `cpu`, `key`, `hardDrive`, `play`, `sparkles` (multi-path), `zap`, `snowflake`, `puzzle`, `alertTriangle`, `cornerDownRight`, `externalLink`, `crosshair`, `globe`, `bookmark`, `heart`, `tag`, `grip`, `hash`, `sun`, `monitor`, `megaphone`. Paths sourced from Lucide icons (24x24 viewBox, stroke-based).

## Feature 1: Model Provider Configuration

Define `MODEL_PROVIDERS` array with entries for Anthropic, OpenAI, Google, OpenRouter, and Ollama. Each provider has: `id`, `name`, `color`, `status` ("connected"/"not_configured"), `apiKey` (empty string), and `models` array. Each model has `id`, `name`, `enabled` boolean. Define `API_ENDPOINTS` mapping provider IDs to `{url, header, prefix}` for API calls.

Define `SEED_MODELS` array of recommended Hugging Face models with fields: `id` (HF repo ID like "onnx-community/Qwen3-0.6B-ONNX"), `name`, `author`, `task` (e.g. "text-generation"), `downloads`, `likes`, `tags`, `sizeMB`, `status` ("available"/"installed").

Implement a Hugging Face Hub search function that queries `https://huggingface.co/api/models` with debounced search (350ms), filtering by ONNX tag and task type.

## Feature 2: Local LLM Inference via Web Worker (TJS System)

Build a transformers.js v3 integration that runs inference off the main thread. The CDN URL is `https://cdn.jsdelivr.net/npm/@huggingface/transformers@3`.

**Worker creation**: Generate worker source as an inline string, create a Blob URL, and instantiate with `new Worker(blobURL)` (classic mode, NOT module mode). Chrome supports dynamic `import()` in classic workers. Blob URL workers bypass `file://` origin restrictions. The worker source must: import transformers.js from CDN, cache loaded pipelines by `task+modelId`, handle `ping`/`load`/`generate` messages, use `TextStreamer` for token-by-token streaming via `callback_function`, and post `status`/`phase`/`token`/`done`/`error` messages back.

**Babel compatibility trick**: Babel standalone transforms `import()` to `require()` which doesn't exist in browser. Define `const _dynamicImport=new Function("url","return import(url)")` — Babel won't transform code inside `new Function` strings.

**Fallback chain**: Blob URL classic worker → file-based worker (`tjs-worker.js`) → main-thread inference. Each level has a timeout watchdog (10s). If the worker doesn't respond, fall back to main thread.

**TJS public API object** with methods:
- `loadModel(task, modelId, onStatus)` — downloads and caches a model pipeline
- `generate({task, modelId, prompt, options}, {onStatus, onPhase, onToken, onDone, onError})` — runs streaming inference

Pipeline options: `{max_new_tokens:256, temperature:0.7, do_sample:true, top_p:0.9}`.

For `text-generation` with chat models, pass an array of `{role, content}` messages as the prompt — the pipeline auto-applies the model's chat template. Include a system message, the last 6 conversation messages, and the new user message.

## Feature 3: Memory Tier System

Define four tiers representing tab process state:
- `hot` (red `#f87171`): live process, active memory
- `warm` (amber `#fbbf24`): frozen DOM snapshot
- `cool` (blue `#60a5fa`): serialized to disk
- `cold` (gray `#52525b`): URL-only bookmark

Each tab node in the tree carries `memoryTier` and `memoryMB`. A `MemBar` component visualizes aggregate memory by tier as a stacked horizontal bar. Workspaces have an `activeMemory` toggle that promotes/demotes all child tabs.

## Feature 4: Workspace Tree with Keyboard Navigation

Hierarchical tree structure: a root node contains workspace folders, which contain tab nodes. Each node has `{id, name, type, children, expanded, persisted, activeMemory, memoryTier, memoryMB, url}`.

**Tree helper functions**: `deepUpdate(node, id, fn)` for recursive immutable updates, `findNode(node, id)` for lookup, `cntTabs(node)` for counting leaves, `sumMem(node)` for memory totals, `flattenTabs(node)` for extracting all tabs, `getParentPath(root, id)` for breadcrumbs, `flattenTree(root, filter)` for keyboard-navigable flat list with type-to-filter support.

**Keyboard navigation**: Arrow keys move cursor through `visibleItems` (flattened tree). Right expands folder or enters it. Left collapses or jumps to parent. Home/End go to first/last. Space toggles multi-select. Enter opens tab or toggles all tabs in folder. Ctrl+X cuts selection, Ctrl+V pastes into target folder. Typing a-z0-9 characters accumulates a filter string. Escape exits move mode, clears filter, or deselects. `?` opens shortcut overlay.

**Drag-drop**: `TabRow` and `WsFolder` components support `draggable` with `onDragStart/Over/Drop`. Visual drop indicators show "before", "after", or "into" positions. `moveNodes(sourceIds, targetId, insertIdx)` handles the tree mutation.

**Components**: `TabRow` renders a single tab with tier indicator dot, favicon, name, memory badge, pin icon, and close button. `WsFolder` renders a collapsible folder with chevron, tab count badge, memory indicator, and expand/collapse toggle.

## Feature 5: Omnibar (URL/Search Classification)

`classifyOmni(raw)` function that returns `{intent, url, query}`:
- Detects protocol URIs (`http://`, `ftp://`, `file://`, etc.) → navigate
- Detects bare domains (`google.com`, `foo.co.uk/path`) → navigate with `https://`
- Detects `localhost:port/path` → navigate with `http://`
- Everything else → search

When intent is "navigate", creates a new tab node in the tree with the URL. When intent is "search", sets `pendingSearch` state that the ChatInterface consumes and sends as a search query via `doSend(query, isSearch=true)`.

## Feature 6: Chat Interface with Cloud + Local LLM Support

`ChatInterface` component with messages state, input textarea (auto-growing), model selector dropdown, and send button. Messages have shape: `{id, role, content, streamedContent, status, isLocal, thinkingContent, thinkingDuration, isThinking, cards, loadingStatus, isError, statusText}`.

`updateMsg(id, patch)` merges a patch object into a message by ID using functional state update.

**doSend(text, isSearch)** function handles two paths:

**Local model path**: Creates assistant message with `status:"thinking"`. Builds chat messages array with system prompt, last 6 messages, and user message. Calls `TJS.generate()` with streaming callbacks. `onToken` accumulates into `tokenBuf` and updates `msg.streamedContent`. Strips turn-end markers (`\nUser:`, `<|im_end|>`, `<|endoftext|>`). On completion, cleans final content and sets `status:"complete"`.

**Cloud provider path**: Calls `callLLM(provider, apiKey, model, messages)`. For Anthropic: POST to `/v1/messages` with tool definitions. For OpenAI/OpenRouter: POST to `/v1/chat/completions` with function calling. Parses response for text content and tool calls. Tool calls are matched against MCP_APPS registry and rendered as cards.

## Feature 7: Inspectable Thinking Blocks

When using local models (specifically Qwen3), the model outputs `<think>...</think>` reasoning blocks before its actual response. Instead of stripping these, extract them into an inspectable collapsible UI.

**ThinkingBlock component**: Props: `content` (reasoning text string), `duration` (seconds number or null), `isThinking` (boolean).
- While `isThinking=true`: shows purple (`#a78bfa`) spinner icon + "Thinking" label with pulse animation, content auto-expanded below with left border accent, streaming cursor at end
- After thinking (`isThinking=false`): collapses to clickable "Thought for {duration}s >" with sparkles icon and chevron. Click expands to show the full reasoning text. Max-height 400px with overflow scroll when expanded.

**ChatMessage integration**: Renders `<ThinkingBlock>` when `msg.thinkingContent` exists or `msg.isThinking` is true. Shows a 3-dot pulsing indicator as initial thinking state before any tokens arrive. Phase label shows "Generating" only when NOT in thinking mode (thinking block has its own indicator).

**Token stream parsing in onToken**: Track `inThink` boolean, `thinkingBuf` string, `thinkStartTime` timestamp alongside `tokenBuf`.
- When `<think>` tag detected in token stream: set `inThink=true`, record start time, extract content after tag into `thinkingBuf`, update message with `{isThinking:true, thinkingContent:...}`
- While inside thinking block: keep appending to `thinkingBuf`, update `msg.thinkingContent`
- When `</think>` detected: set `inThink=false`, calculate `duration = Math.round((Date.now() - startTime) / 1000)`, update message with `{isThinking:false, thinkingDuration:elapsed}`, begin streaming normal content from after the close tag
- Normal content: strip any completed `<think>` blocks via regex, trim turn-end markers
- Finalize: preserve `thinkingContent` and `thinkingDuration` on the completed message

**Important**: All `</think>` string literals inside `<script type="text/babel">` should be escaped as `"<\/think>"` to avoid potential HTML parser issues.

## Feature 8: MCP App System

Define `MCP_APPS` registry object where each key is an app ID (`task_tracker`, `image_viewer`, `gallery`, `video_player`, `notes`, `data_table`) mapping to `{name, icon, description, parameters}` with JSON Schema parameter definitions.

`buildMcpTools()` converts the registry to the tool format expected by each LLM provider API (Anthropic `tools[]` or OpenAI `functions[]`).

**Renderer components**:
- `McpTaskTracker`: 3-column kanban board (To Do / In Progress / Done) with task cards showing priority colors
- `McpImageViewer`: single image display with caption
- `McpGallery`: auto-grid of images using CSS Grid with `minmax(140px, 1fr)`
- `McpVideoPlayer`: embeds YouTube (auto-detects YouTube URLs and converts to embed format) or generic iframe
- `McpNotes`: markdown-lite renderer (parses `#`/`##` headers, `- ` bullet lists, paragraphs)
- `McpDataTable`: HTML table from `columns[]` and `rows[][]`

When the LLM returns tool calls, they create MCP panes in the workspace. Panes render alongside browser tab panes in a split-view layout. Each pane has a header bar with icon, name, "MCP" badge, and close button.

## Feature 9: Settings Panel

Collapsible provider cards for each cloud API (Anthropic, OpenAI, Google, OpenRouter, Ollama). Each card shows: provider name with color dot, status badge, expandable section with API key input (password field with show/hide toggle), model checkboxes, and Save button.

Local model management section: search bar that queries HF Hub API with debounced input, task filter pills (text-generation, classification, question-answering, etc.), three sections — "Installed" (downloaded models), "Recommended" (seed models not yet installed), "Search Results" (from HF Hub). Each model card (`HFModelCard`) shows: model name, author, task badge, size, download/like counts, and Install/Delete button with loading state.

Model installation calls `TJS.loadModel(task, modelId, onStatus)` which downloads and caches the pipeline in the Web Worker.

## Feature 10: Workspace Management

Multiple workspaces, each with its own tab tree, active tabs, MCP panes, cursor position, and selection state. `App` component holds `workspaces` array and `activeWsId`. Scoped setters (`setRoot`, `setActiveTabs`, `setFocusedTabId`, `setMcpPanes`, `setCursorId`, `setSelectedIds`) update only the active workspace.

`WorkspaceOverlay` modal for switching between workspaces: grid of workspace cards with color coding, tab counts, memory usage, create/delete/rename actions.

Workspace switcher pills in the sidebar header allow quick switching. Each workspace has a `color` property for visual identification.

## Feature 11: Page Overlay System

When tabs are opened, a `PageOverlay` renders in the main content area showing the tab URL in a simulated browser chrome (address bar, back/forward/refresh buttons). `PageChat` provides a per-page chat panel that slides in from the right. `ElementPickerOverlay` simulates DOM element inspection with crosshair cursor.

## Feature 12: Extensions Panel

List of browser extensions with enable/disable toggles. `ExtensionsMarketplace` overlay with categories (Featured, Privacy, AI, Dev Tools, Productivity), search, and install buttons. Extensions are mock data with name, author, rating, user count, category, description, icon, and color.

## Feature 13: History Panel

Session history list with mock data. Each session shows title, date, preview text, and event timeline (chat messages, navigations, MCP tool uses). "Continue Session" button to restore context.

## Feature 14: Activity Bar

Narrow sidebar with icon buttons for panel switching: Workspaces (layers icon), Chat (messageSquare), History (clock), Extensions (puzzle), Settings (settings), Account (user). Collapse/expand toggle at bottom (panelRight icon). Active panel highlighted with accent background and border indicator.

## App Layout

Root layout is a horizontal flex container filling 100vh:
1. **ActivityBar** (48px wide, fixed)
2. **Sidebar Panel** (260px, collapsible with transition) — renders the active panel component
3. **Main Content** (flex:1) — ChatInterface as base layer, with PageOverlay + MCP panes layered on top when tabs/apps are open. Extensions marketplace overlays on top of everything.

Toast notification fixed at bottom center with blur backdrop. ShortcutOverlay and WorkspaceOverlay are modal overlays.
