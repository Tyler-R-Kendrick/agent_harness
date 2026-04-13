import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useCopilotReadable } from '@copilotkit/react-core';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Cpu,
  File,
  Folder,
  FolderOpen,
  Globe,
  History,
  Layers3,
  LoaderCircle,
  LucideIcon,
  MessageSquare,
  PanelRightOpen,
  Plus,
  Puzzle,
  RefreshCcw,
  Search,
  SendHorizontal,
  Settings,
  Sparkles,
  Terminal,
  User,
  X,
} from 'lucide-react';
import { Bash } from 'just-bash/browser';
import './App.css';
import { searchBrowserModels } from './services/huggingFaceRegistry';
import { browserInferenceEngine } from './services/browserInference';
import { formatBrowserInferenceResult } from './services/browserInferenceRuntime';
import { appendPendingLocalTurn, createCopilotBridgeSnapshot, toAiSdkMessages, toChatSdkTranscript } from './services/chatComposition';
import {
  buildWorkspacePromptContext,
  createWorkspaceFileTemplate,
  detectWorkspaceFileKind,
  discoverWorkspaceCapabilities,
  loadWorkspaceFiles,
  removeWorkspaceFile,
  upsertWorkspaceFile,
  validateWorkspaceFile,
  WORKSPACE_FILES_STORAGE_KEY,
  WORKSPACE_FILE_STORAGE_DEBOUNCE_MS,
} from './services/workspaceFiles';
import { createUniqueId } from './utils/uniqueId';
import type { ChatMessage, HFModel, HistorySession, NodeKind, TreeNode, WorkspaceCapabilities, WorkspaceFile, WorkspaceFileKind } from './types';

type ToastState = { msg: string; type: 'info' | 'success' | 'error' | 'warning' } | null;
type FlatTreeItem = { node: TreeNode; depth: number };

const TIERS = {
  hot: { color: '#f87171', label: 'Hot' },
  warm: { color: '#fbbf24', label: 'Warm' },
  cool: { color: '#60a5fa', label: 'Cool' },
  cold: { color: '#52525b', label: 'Cold' },
} as const;

const TASK_OPTIONS = [
  'text-generation', 'text2text-generation', 'text-classification',
  'token-classification', 'question-answering', 'summarization',
  'translation', 'feature-extraction', 'fill-mask',
  'image-classification', 'object-detection', 'image-segmentation',
  'automatic-speech-recognition', 'zero-shot-classification',
  'sentence-similarity',
];

const HF_TASK_LABELS: Record<string, string> = {
  'text-generation': 'Text Generation',
  'text2text-generation': 'Text-to-Text',
  'text-classification': 'Classification',
  'token-classification': 'Token Classification',
  'question-answering': 'QA',
  'summarization': 'Summarization',
  'translation': 'Translation',
  'feature-extraction': 'Embeddings',
  'fill-mask': 'Fill Mask',
  'image-classification': 'Image Classification',
  'object-detection': 'Object Detection',
  'image-segmentation': 'Image Segmentation',
  'automatic-speech-recognition': 'Speech Recognition',
  'zero-shot-classification': 'Zero-Shot',
  'sentence-similarity': 'Sentence Similarity',
};

// Pre-populated registry shown before any HF API call completes.
// Mirrors reference_impl LOCAL_MODELS_SEED exactly.
const LOCAL_MODELS_SEED: HFModel[] = [
  { id: 'onnx-community/Qwen3-0.6B-ONNX', name: 'Qwen3-0.6B-ONNX', author: 'onnx-community', task: 'text-generation', downloads: 5000, likes: 30, tags: ['transformers.js', 'text-generation', 'onnx'], sizeMB: 0, status: 'available' },
  { id: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', name: 'distilbert-base-uncased-finetuned-sst-2-english', author: 'Xenova', task: 'text-classification', downloads: 50000, likes: 32, tags: ['transformers.js'], sizeMB: 0, status: 'available' },
  { id: 'Xenova/all-MiniLM-L6-v2', name: 'all-MiniLM-L6-v2', author: 'Xenova', task: 'feature-extraction', downloads: 80000, likes: 65, tags: ['transformers.js', 'feature-extraction'], sizeMB: 0, status: 'available' },
  { id: 'Xenova/whisper-tiny.en', name: 'whisper-tiny.en', author: 'Xenova', task: 'automatic-speech-recognition', downloads: 25000, likes: 28, tags: ['transformers.js'], sizeMB: 0, status: 'available' },
  { id: 'Xenova/detr-resnet-50', name: 'detr-resnet-50', author: 'Xenova', task: 'object-detection', downloads: 15000, likes: 20, tags: ['transformers.js'], sizeMB: 0, status: 'available' },
];
const MAX_CONTEXT_MESSAGES = 7;
const NEW_TAB_NAME_LENGTH = 32;
const DEFAULT_NEW_TAB_MEMORY_MB = 96;
const INITIAL_WORKSPACE_IDS = ['ws-research', 'ws-build'] as const;
const PRIMARY_NAV = [
  ['workspaces', 'layers', 'Workspaces'],
  ['history', 'clock', 'History'],
  ['extensions', 'puzzle', 'Extensions'],
] as const;
const SECONDARY_NAV = [
  ['settings', 'settings', 'Settings'],
  ['account', 'user', 'Account'],
] as const;
const WORKSPACE_SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    items: [
      { keys: '↑ / ↓', description: 'Move cursor' },
      { keys: '→', description: 'Expand folder / enter' },
      { keys: '←', description: 'Collapse folder / go to parent' },
      { keys: 'Home / End', description: 'First / last item' },
    ],
  },
  {
    title: 'Selection',
    items: [
      { keys: 'Space', description: 'Toggle selection' },
      { keys: 'Shift+↑/↓', description: 'Extend selection' },
      { keys: 'Ctrl+A', description: 'Select all visible' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { keys: 'Enter', description: 'Toggle folder / open tab' },
      { keys: 'Ctrl+X', description: 'Cut selected' },
      { keys: 'Ctrl+V', description: 'Paste into folder' },
      { keys: 'Esc', description: 'Clear / cancel' },
    ],
  },
  {
    title: 'Quick access',
    items: [
      { keys: 'Type to filter', description: 'Incremental search' },
      { keys: '?', description: 'This overlay' },
    ],
  },
  {
    title: 'Workspace switching',
    items: [
      { keys: 'Ctrl+1-9', description: 'Jump to workspace N' },
      { keys: 'Ctrl+Alt+←/→', description: 'Previous / next workspace' },
      { keys: 'Ctrl+Alt+N', description: 'New empty workspace' },
      { keys: 'Double-click pill', description: 'Rename workspace' },
    ],
  },
] as const;
const WORKSPACE_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#fb7185'] as const;
const CATEGORY_ORDER: NodeKind[] = ['browser', 'terminal', 'agent', 'files'];
const CATEGORY_LABELS: Record<NodeKind, string> = {
  browser: 'Browser',
  terminal: 'Terminal',
  agent: 'Agent',
  files: 'Files',
};

function createSessionNode(workspaceId: string, kind: 'agent' | 'terminal', index: number): TreeNode {
  const label = kind === 'agent' ? 'Chat' : 'Terminal';
  return {
    id: createUniqueId(),
    name: `${label} ${index}`,
    type: 'tab',
    nodeKind: kind,
    persisted: true,
    filePath: `${workspaceId}:${kind}:${index}`,
  };
}

function createBrowserTab(name: string, url: string, memoryTier: TreeNode['memoryTier'], memoryMB: number, persisted = false): TreeNode {
  return {
    id: createUniqueId(),
    name,
    type: 'tab',
    nodeKind: 'browser',
    url,
    persisted,
    memoryTier,
    memoryMB,
  };
}

function categoryNode(workspaceId: string, kind: NodeKind, children: TreeNode[] = []): TreeNode {
  return {
    id: `${workspaceId}:category:${kind}`,
    name: CATEGORY_LABELS[kind],
    type: 'folder',
    nodeKind: kind,
    expanded: true,
    children,
  };
}

function createWorkspaceNode({
  id,
  name,
  color,
  browserTabs,
}: {
  id: string;
  name: string;
  color: string;
  browserTabs: TreeNode[];
}): TreeNode {
  return {
    id,
    name,
    type: 'workspace',
    expanded: true,
    activeMemory: true,
    color,
    children: [
      categoryNode(id, 'browser', browserTabs),
      categoryNode(id, 'terminal', [createSessionNode(id, 'terminal', 1)]),
      categoryNode(id, 'agent', [createSessionNode(id, 'agent', 1)]),
      categoryNode(id, 'files', []),
    ],
  };
}

const icons = {
  layers: Layers3,
  messageSquare: MessageSquare,
  clock: History,
  puzzle: Puzzle,
  settings: Settings,
  user: User,
  panelRight: PanelRightOpen,
  search: Search,
  folder: Folder,
  folderOpen: FolderOpen,
  file: File,
  x: X,
  send: SendHorizontal,
  loader: LoaderCircle,
  globe: Globe,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  refresh: RefreshCcw,
  sparkles: Sparkles,
  plus: Plus,
  cpu: Cpu,
  chevronRight: ChevronRight,
  terminal: Terminal,
} as const;

const mockHistory: HistorySession[] = [
  { id: 1, title: 'Research Session', date: 'Today · 2:15 PM', preview: 'Investigated browser-safe ONNX models', events: ['Opened Hugging Face registry', 'Installed an ONNX model', 'Streamed a local response'] },
  { id: 2, title: 'UX Session', date: 'Yesterday · 4:30 PM', preview: 'Tuned keyboard navigation and overlays', events: ['Moved through workspace tree', 'Opened shortcut overlay', 'Validated page overlay'] },
];

function createInitialRoot(): TreeNode {
  return {
    id: 'root',
    name: 'Root',
    type: 'root',
    expanded: true,
    children: [
      createWorkspaceNode({
        id: 'ws-research',
        name: 'Research',
        color: '#60a5fa',
        browserTabs: [
          createBrowserTab('Hugging Face', 'https://huggingface.co/models?library=transformers.js', 'hot', 165, true),
          createBrowserTab('Transformers.js', 'https://huggingface.co/docs/transformers.js', 'warm', 88),
        ],
      }),
      createWorkspaceNode({
        id: 'ws-build',
        name: 'Build',
        color: '#34d399',
        browserTabs: [
          createBrowserTab('CopilotKit docs', 'https://docs.copilotkit.ai', 'cool', 44),
        ],
      }),
    ],
  };
}

function Icon({ name, size = 16, color = 'currentColor', className = '' }: { name: keyof typeof icons; size?: number; color?: string; className?: string }) {
  const IconComponent: LucideIcon = icons[name];
  return <IconComponent size={size} color={color} className={className} aria-hidden="true" strokeWidth={1.8} />;
}

function Favicon({ url, size = 14 }: { url?: string; size?: number }) {
  const [err, setErr] = useState(false);
  const domain = useMemo(() => {
    if (!url) return null;
    try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname; } catch { return null; }
  }, [url]);
  if (!domain || err) return <Icon name="globe" size={size} color="rgba(255,255,255,.3)" />;
  return <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} width={size} height={size} onError={() => setErr(true)} style={{ borderRadius: 2, flexShrink: 0, display: 'block' }} alt="" aria-hidden="true" />;
}

function ActiveMemoryPulse() {
  return (
    <span className="memory-pulse" title="Active memory" aria-hidden="true">
      <span className="memory-pulse-ring" />
      <span className="memory-pulse-dot" />
    </span>
  );
}

function deepUpdate(node: TreeNode, id: string, update: (node: TreeNode) => TreeNode): TreeNode {
  if (node.id === id) return update(node);
  if (!node.children) return node;
  return { ...node, children: node.children.map((child) => deepUpdate(child, id, update)) };
}

function findNode(node: TreeNode, id: string): TreeNode | null {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const match = findNode(child, id);
    if (match) return match;
  }
  return null;
}

function flattenTabs(node: TreeNode, kind?: NodeKind): TreeNode[] {
  if (node.type === 'tab') {
    if (!kind || node.nodeKind === kind) return [node];
    return [];
  }
  return (node.children ?? []).flatMap((child) => flattenTabs(child, kind));
}

function countTabs(node: TreeNode): number {
  return flattenTabs(node, 'browser').length;
}

function totalMemoryMB(node: TreeNode): number {
  return flattenTabs(node, 'browser').reduce((sum, t) => sum + (t.memoryMB ?? 0), 0);
}

function getWorkspace(root: TreeNode, workspaceId: string): TreeNode | null {
  return (root.children ?? []).find((node) => node.id === workspaceId) ?? null;
}

function findParent(root: TreeNode, id: string, parent: TreeNode | null = null): TreeNode | null {
  if (root.id === id) return parent;
  for (const child of root.children ?? []) {
    const match = findParent(child, id, root);
    if (match) return match;
  }
  return null;
}

function findWorkspaceForNode(root: TreeNode, nodeId: string): TreeNode | null {
  for (const workspace of root.children ?? []) {
    if (workspace.id === nodeId) return workspace;
    if ((workspace.children ?? []).some((child) => findNode(child, nodeId))) return workspace;
  }
  return null;
}

function getWorkspaceCategory(workspace: TreeNode, kind: NodeKind): TreeNode | null {
  return (workspace.children ?? []).find((child) => child.type === 'folder' && child.nodeKind === kind) ?? null;
}

function removeNodeById(node: TreeNode, nodeId: string): TreeNode {
  if (!node.children) return node;
  return {
    ...node,
    children: node.children
      .filter((child) => child.id !== nodeId)
      .map((child) => removeNodeById(child, nodeId)),
  };
}

function ensureWorkspaceCategories(workspace: TreeNode): TreeNode {
  const existing = new Map((workspace.children ?? []).filter((child) => child.type === 'folder' && child.nodeKind).map((child) => [child.nodeKind as NodeKind, child]));
  const legacyTabChildren = (workspace.children ?? []).filter((child) => child.type === 'tab' && child.nodeKind !== 'agent' && child.nodeKind !== 'terminal');
  const nextChildren = CATEGORY_ORDER.map((kind) => existing.get(kind) ?? categoryNode(workspace.id, kind, kind === 'browser' ? legacyTabChildren : []));
  return { ...workspace, children: nextChildren };
}

function findFirstSessionId(workspace: TreeNode, kind: 'agent' | 'terminal'): string | null {
  const category = getWorkspaceCategory(workspace, kind);
  const first = (category?.children ?? []).find((child) => child.type === 'tab' && child.nodeKind === kind);
  return first?.id ?? null;
}

function createVirtualFsTreeNodes(prefix: string, paths: string[]): TreeNode[] {
  const root: TreeNode = { id: `${prefix}:root`, name: 'root', type: 'folder', expanded: true, children: [] };
  for (const path of paths) {
    const clean = path.replace(/^\/+/, '');
    if (!clean) continue;
    const parts = clean.split('/').filter(Boolean);
    let cursor = root;
    for (const [index, part] of parts.entries()) {
      const nodeId = `${prefix}:${parts.slice(0, index + 1).join('/')}`;
      let next = (cursor.children ?? []).find((child) => child.id === nodeId);
      if (!next) {
        next = { id: nodeId, name: part, type: 'folder', expanded: false };
        cursor.children = [...(cursor.children ?? []), next];
      }
      cursor = next;
    }
  }
  return root.children ?? [];
}

function buildWorkspaceNodeMap(root: TreeNode): Map<string, string> {
  const map = new Map<string, string>();
  for (const workspace of root.children ?? []) {
    if (workspace.type !== 'workspace') continue;
    map.set(workspace.id, workspace.id);
    const stack = [...(workspace.children ?? [])];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      map.set(node.id, workspace.id);
      if (node.children?.length) stack.push(...node.children);
    }
  }
  return map;
}

function createSystemChatMessage(sessionId: string): ChatMessage {
  return {
    id: `${sessionId}:system`,
    role: 'system',
    content: 'Agent browser ready. Local inference is backed by browser-runnable Hugging Face ONNX models.',
  };
}

function flattenTreeFiltered(node: TreeNode, query: string, depth = 0): FlatTreeItem[] {
  const normalized = query.trim().toLowerCase();
  const children = node.children ?? [];
  if (!normalized) {
    return children.flatMap((child) => [{ node: child, depth }, ...(child.expanded && child.children ? flattenTreeFiltered(child, normalized, depth + 1) : [])]);
  }

  const filtered: FlatTreeItem[] = [];
  for (const child of children) {
    const matches = child.name.toLowerCase().includes(normalized);
    const descendants = child.children ? flattenTreeFiltered(child, normalized, depth + 1) : [];
    if (matches || descendants.length) {
      filtered.push({ node: child, depth });
      if (child.expanded && child.children) filtered.push(...descendants);
    }
  }
  return filtered;
}

function nextWorkspaceName(root: TreeNode): string {
  const existing = new Set((root.children ?? []).map((workspace) => workspace.name));
  let index = (root.children ?? []).length + 1;
  while (existing.has(`Workspace ${index}`)) index += 1;
  return `Workspace ${index}`;
}

function classifyOmnibar(raw: string): { intent: 'navigate' | 'search'; value: string } {
  const value = raw.trim();
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value)) return { intent: 'navigate', value };
  if (/^localhost(:\d+)?(\/.*)?$/.test(value)) return { intent: 'navigate', value: `http://${value}` };
  if (/^([\w-]+\.)+[a-zA-Z]{2,}(\/.*)?$/.test(value)) return { intent: 'navigate', value: `https://${value}` };
  return { intent: 'search', value };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return { toast, setToast };
}

function ThinkingBlock({ content, duration, isThinking }: { content?: string; duration?: number; isThinking?: boolean }) {
  const [open, setOpen] = useState(Boolean(isThinking));
  useEffect(() => { if (isThinking) setOpen(true); }, [isThinking]);
  if (!content && !isThinking) return null;
  return (
    <div className={`thinking-block ${isThinking ? 'thinking-active' : ''}`}>
      <button type="button" className="thinking-header" onClick={() => !isThinking && setOpen((current) => !current)} aria-expanded={open}>
        <span className="thinking-title">
          <Icon name={isThinking ? 'loader' : 'sparkles'} size={13} color="#a78bfa" className={isThinking ? 'spin' : ''} />
          {isThinking ? 'Thinking' : `Thought for ${duration ?? 0}s`}
        </span>
      </button>
      {open && <div className={`thinking-content ${isThinking ? 'stream-cursor' : ''}`}>{content}</div>}
    </div>
  );
}

function fmtMem(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1).replace(/\.0$/, '')} GB`;
  if (mb >= 1) return `${Math.round(mb)} MB`;
  return `${Math.round(mb * 1024)} KB`;
}

function MemBar({ root }: { root: TreeNode }) {
  const budget = 2048;
  const tabs = flattenTabs(root);
  const tierMemory = Object.entries(TIERS).map(([tier, meta]) => ({
    tier,
    ...meta,
    memory: tabs.filter((tab) => tab.memoryTier === tier).reduce((sum, tab) => sum + (tab.memoryMB ?? 0), 0),
  }));
  const used = tierMemory.reduce((sum, t) => sum + t.memory, 0);
  const pct = (mb: number) => Math.max((mb / budget) * 100, 0.3);
  return (
    <div className="mem-bar" aria-label="Memory distribution">
      <div className="mem-bar-header">
        <span>Memory</span>
        <span>{fmtMem(used)} / {fmtMem(budget)}</span>
      </div>
      <div className="mem-bar-track">
        {tierMemory.map((t) =>
          t.memory ? (
            <div key={t.tier} style={{ width: `${pct(t.memory)}%`, background: t.color, transition: 'width .5s' }} title={`${t.label}: ${t.memory}MB`} />
          ) : null,
        )}
      </div>
      <div className="mem-bar-legend">
        {tierMemory.map((t) => (
          <span key={t.tier} className="mem-bar-legend-item">
            <span className="mem-bar-legend-dot" style={{ background: t.color }} />
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChatMessageView({ message }: { message: ChatMessage }) {
  const content = message.streamedContent || message.content;
  return (
    <div className={`message ${message.role}`}>
      {(message.thinkingContent || message.isThinking) && <ThinkingBlock content={message.thinkingContent} duration={message.thinkingDuration} isThinking={message.isThinking} />}
      {content ? <div className="message-bubble">{content}{message.status === 'streaming' && !message.isThinking && <span className="stream-cursor" />}</div> : null}
      {message.loadingStatus ? <div className="message-status">{message.loadingStatus}</div> : null}
    </div>
  );
}

function PageOverlay({ tab, onClose }: { tab: TreeNode; onClose: () => void }) {
  const [address, setAddress] = useState(tab.url ?? '');
  const [showInspector, setShowInspector] = useState(false);
  const [showChat, setShowChat] = useState(false);
  return (
    <section className="page-overlay" aria-label="Page overlay">
      <header className="page-toolbar">
        <button type="button" className="icon-button" aria-label="Back"><Icon name="arrowLeft" /></button>
        <button type="button" className="icon-button" aria-label="Forward"><Icon name="arrowRight" /></button>
        <button type="button" className="icon-button" aria-label="Refresh"><Icon name="refresh" /></button>
        <label className="address-bar"><Icon name="globe" size={12} color="#71717a" /><input aria-label="Address" value={address} onChange={(event) => setAddress(event.target.value)} /></label>
        <button type="button" className={`icon-button ${showInspector ? 'active' : ''}`} aria-label="Toggle inspector" onClick={() => setShowInspector((current) => !current)}><Icon name="cpu" /></button>
        <button type="button" className={`icon-button ${showChat ? 'active' : ''}`} aria-label="Toggle page chat" onClick={() => setShowChat((current) => !current)}><Icon name="messageSquare" /></button>
        <button type="button" className="icon-button" aria-label="Close page overlay" onClick={onClose}><Icon name="x" /></button>
      </header>
      <div className="page-body">
        <div className="page-canvas">
          <Icon name="globe" size={32} color="#3f3f46" />
          <p>{tab.url}</p>
          <span>Simulated page content with browser chrome</span>
        </div>
        {showInspector ? <div className="picker-overlay">Element picker active</div> : null}
        {showChat ? <aside className="page-chat-panel"><h3>Page Chat</h3><p>Use the main assistant to reason about the currently open page.</p></aside> : null}
      </div>
    </section>
  );
}

function FileEditorPanel({
  file,
  onSave,
  onDelete,
  onClose,
  onToast,
}: {
  file: WorkspaceFile;
  onSave: (nextFile: WorkspaceFile, previousPath?: string) => void;
  onDelete: (path: string) => void;
  onClose: () => void;
  onToast: (toast: Exclude<ToastState, null>) => void;
}) {
  const [editorPath, setEditorPath] = useState(file.path);
  const [editorContent, setEditorContent] = useState(file.content);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    setEditorPath(file.path);
    setEditorContent(file.content);
    setValidationMessage(null);
  }, [file]);

  function handleSave() {
    const nextFile: WorkspaceFile = {
      path: editorPath.trim(),
      content: editorContent,
      updatedAt: new Date().toISOString(),
    };
    const validationError = validateWorkspaceFile(nextFile);
    if (validationError) {
      setValidationMessage(validationError);
      return;
    }
    onSave(nextFile, file.path);
    onToast({ msg: `Saved ${nextFile.path}`, type: 'success' });
  }

  return (
    <section className="file-editor-panel" aria-label="File editor">
      <header className="file-editor-header">
        <div className="file-editor-heading">
          <Icon name="file" size={14} color="#a5b4fc" />
          <span className="file-editor-title">{file.path}</span>
          <span className="badge">{detectWorkspaceFileKind(file.path) ?? 'file'}</span>
        </div>
        <button type="button" className="icon-button" aria-label="Close file editor" onClick={onClose}><Icon name="x" /></button>
      </header>
      <div className="file-editor-body">
        <label className="file-editor-field">
          <span>Path</span>
          <input aria-label="Workspace file path" value={editorPath} onChange={(event) => setEditorPath(event.target.value)} />
        </label>
        <label className="file-editor-field file-editor-content-field">
          <span>Content</span>
          <textarea aria-label="Workspace file content" value={editorContent} onChange={(event) => setEditorContent(event.target.value)} />
        </label>
        {validationMessage ? <p className="file-editor-error">{validationMessage}</p> : null}
        <div className="file-editor-toolbar">
          <button type="button" className="primary-button" onClick={handleSave}>Save file</button>
          <button type="button" className="secondary-button destructive" onClick={() => { onDelete(file.path); onClose(); onToast({ msg: `Removed ${file.path}`, type: 'info' }); }}>Delete file</button>
        </div>
      </div>
    </section>
  );
}

const BASH_INITIAL_CWD = '/workspace';
const BASH_CWD_PLACEHOLDER_FILE = '.keep';
type BashEntry = { cmd: string; stdout: string; stderr: string; exitCode: number };

function JustBashPanel({
  sessionId,
  onFsPathsChanged,
  bashBySessionRef,
  historyBySession,
  setHistoryBySession,
}: {
  sessionId: string;
  onFsPathsChanged: (sessionId: string, paths: string[]) => void;
  bashBySessionRef: MutableRefObject<Record<string, Bash>>;
  historyBySession: Record<string, BashEntry[]>;
  setHistoryBySession: Dispatch<SetStateAction<Record<string, BashEntry[]>>>;
}) {
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const history = historyBySession[sessionId] ?? [];

  const getSessionBash = useCallback((id: string) => {
    if (!bashBySessionRef.current[id]) {
      // Seed a placeholder file so the configured cwd always exists in the in-memory FS.
      bashBySessionRef.current[id] = new Bash({ cwd: BASH_INITIAL_CWD, files: { [`${BASH_INITIAL_CWD}/${BASH_CWD_PLACEHOLDER_FILE}`]: '' } });
    }
    return bashBySessionRef.current[id];
  }, []);

  // Auto-focus the bash input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [sessionId]);

  useEffect(() => {
    if (outputRef.current && typeof outputRef.current.scrollTo === 'function') {
      outputRef.current.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [history]);

  useEffect(() => {
    const bash = getSessionBash(sessionId);
    onFsPathsChanged(sessionId, bash.fs.getAllPaths());
  }, [getSessionBash, onFsPathsChanged, sessionId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const cmd = input.trim();
    if (!cmd || running) return;
    if (cmd === 'clear') {
      // Keep clear instant in the UI instead of waiting for async shell execution.
      setHistoryBySession((current) => ({ ...current, [sessionId]: [] }));
      setInput('');
      inputRef.current?.focus();
      return;
    }
    const bash = getSessionBash(sessionId);
    setInput('');
    setRunning(true);
    try {
      const result = await bash.exec(cmd);
      setHistoryBySession((current) => ({
        ...current,
        [sessionId]: [...(current[sessionId] ?? []), { cmd, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode }],
      }));
      onFsPathsChanged(sessionId, bash.fs.getAllPaths());
    } catch (error) {
      setHistoryBySession((current) => ({
        ...current,
        [sessionId]: [...(current[sessionId] ?? []), { cmd, stdout: '', stderr: error instanceof Error ? error.message : String(error), exitCode: 1 }],
      }));
    } finally {
      setRunning(false);
      // Use rAF to ensure focus happens after the disabled→enabled DOM update
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  return (
    <>
      <div className="just-bash-output" ref={outputRef} aria-label="Terminal output" aria-live="polite">
        {history.length === 0 ? (
          <div className="bash-welcome">
            <span className="bash-prompt">$</span> Welcome to <strong>just-bash</strong> — a sandboxed shell.
            <br />Type commands like <code>echo hello</code>, <code>ls</code>, <code>pwd</code>, or <code>clear</code>.
          </div>
        ) : null}
        {history.map((entry, index) => (
          <div key={index} className="bash-entry">
            <span className="bash-prompt">$ </span><span className="bash-cmd">{entry.cmd}</span>
            {entry.stdout ? <div className="bash-result">{entry.stdout}</div> : null}
            {entry.stderr ? <div className="bash-result bash-stderr">{entry.stderr}</div> : null}
          </div>
        ))}
        {running ? <div className="bash-running"><span className="bash-prompt">$ </span><span className="bash-cmd">{input || '…'}</span></div> : null}
      </div>
      <form className="just-bash-compose" onSubmit={handleSubmit}>
        <span className="bash-prompt">$ </span>
        <input
          ref={inputRef}
          className="bash-input"
          aria-label="Bash input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="type a command…"
          autoComplete="off"
          spellCheck={false}
          disabled={running}
        />
        {running ? <span className="bash-spinner" aria-label="Running" /> : null}
      </form>
    </>
  );
}

function ChatPanel({
  installedModels,
  pendingSearch,
  onSearchConsumed,
  onToast,
  workspaceName,
  workspaceFiles,
  workspaceCapabilities,
  activeAgentSessionId,
  activeTerminalSessionId,
  activeMode,
  onSwitchMode,
  onNewAgentSession,
  onNewTerminalSession,
  onTerminalFsPathsChanged,
}: {
  installedModels: HFModel[];
  pendingSearch: string | null;
  onSearchConsumed: () => void;
  onToast: (toast: Exclude<ToastState, null>) => void;
  workspaceName: string;
  workspaceFiles: WorkspaceFile[];
  workspaceCapabilities: WorkspaceCapabilities;
  activeAgentSessionId: string | null;
  activeTerminalSessionId: string | null;
  activeMode: 'agent' | 'terminal';
  onSwitchMode: (mode: 'agent' | 'terminal') => void;
  onNewAgentSession: () => void;
  onNewTerminalSession: () => void;
  onTerminalFsPathsChanged: (sessionId: string, paths: string[]) => void;
}) {
  const [messagesBySession, setMessagesBySession] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState('');
  const [selectedModelBySession, setSelectedModelBySession] = useState<Record<string, string>>({});
  const [bashHistoryBySession, setBashHistoryBySession] = useState<Record<string, BashEntry[]>>({});
  const showBash = activeMode === 'terminal';
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const consumedPendingSearchRef = useRef<string | null>(null);
  const bashBySessionRef = useRef<Record<string, Bash>>({});
  const workspacePromptContext = useMemo(() => buildWorkspacePromptContext(workspaceFiles), [workspaceFiles]);
  const activeChatSessionId = activeAgentSessionId ?? 'agent:fallback';
  const messages = messagesBySession[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)];
  const selectedModelId = selectedModelBySession[activeChatSessionId] ?? '';

  useEffect(() => {
    if (!installedModels.length) return;
    setSelectedModelBySession((current) => {
      if (current[activeChatSessionId]) return current;
      return { ...current, [activeChatSessionId]: installedModels[0].id };
    });
  }, [activeChatSessionId, installedModels]);

  useEffect(() => {
    setMessagesBySession((current) => current[activeChatSessionId]
      ? current
      : { ...current, [activeChatSessionId]: [createSystemChatMessage(activeChatSessionId)] });
  }, [activeChatSessionId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function updateMessage(id: string, patch: Partial<ChatMessage>) {
    setMessagesBySession((current) => ({
      ...current,
      [activeChatSessionId]: (current[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)]).map((message) => message.id === id ? { ...message, ...patch } : message),
    }));
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const model = installedModels.find((entry) => entry.id === selectedModelId);
    const assistantId = createUniqueId();
    const nextMessages = appendPendingLocalTurn(messagesRef.current, text, { userId: createUniqueId(), assistantId });
    messagesRef.current = nextMessages;
    setMessagesBySession((current) => ({ ...current, [activeChatSessionId]: nextMessages }));
    setInput('');

    if (!model) {
      updateMessage(assistantId, { status: 'error', content: 'Install a browser-compatible ONNX model from Settings before sending a prompt.' });
      return;
    }

    const aiMessages = toAiSdkMessages(nextMessages);
    const chatTranscript = toChatSdkTranscript(nextMessages);
    const copilotBridge = createCopilotBridgeSnapshot(nextMessages);
    const prompt = [
      { role: 'system', content: 'You are a helpful agent-first browser assistant. Be concise and clear.' },
      { role: 'system', content: `Active workspace: ${workspaceName}` },
      { role: 'system', content: workspacePromptContext },
      ...aiMessages.slice(-MAX_CONTEXT_MESSAGES).map((message) => ({ role: message.role, content: message.parts.map((part) => ('text' in part ? String(part.text) : '')).join('') })),
      { role: 'system', content: `Chat transcript length: ${chatTranscript.length}; Copilot bridge: ${copilotBridge.runtimeUrl}; messages: ${copilotBridge.messageCount}` },
    ];

    let tokenBuffer = '';
    let thinkingBuffer = '';
    let inThinking = false;
    let thinkingStart = 0;

    try {
      await browserInferenceEngine.generate(
        { task: model.task, modelId: model.id, prompt },
        {
          onPhase: (phase) => updateMessage(assistantId, { loadingStatus: phase }),
          onToken: (token) => {
            if (!inThinking && token.includes('<think>')) {
              inThinking = true;
              thinkingStart = Date.now();
              thinkingBuffer += token.split('<think>')[1] ?? '';
              updateMessage(assistantId, { isThinking: true, thinkingContent: thinkingBuffer, status: 'streaming' });
              return;
            }
            if (inThinking && token.includes('</think>')) {
              const [before, after = ''] = token.split('</think>');
              thinkingBuffer += before;
              tokenBuffer += after;
              inThinking = false;
              updateMessage(assistantId, {
                isThinking: false,
                thinkingContent: thinkingBuffer,
                thinkingDuration: Math.max(1, Math.round((Date.now() - thinkingStart) / 1000)),
                streamedContent: tokenBuffer.replace(/\nUser:|<\|im_end\|>|<\|endoftext\|>/g, '').trim(),
                status: 'streaming',
              });
              return;
            }
            if (inThinking) {
              thinkingBuffer += token;
              updateMessage(assistantId, { isThinking: true, thinkingContent: thinkingBuffer, status: 'streaming' });
              return;
            }
            tokenBuffer += token;
            updateMessage(assistantId, { streamedContent: tokenBuffer.replace(/\nUser:|<\|im_end\|>|<\|endoftext\|>/g, '').trim(), status: 'streaming' });
          },
          onDone: (result) => updateMessage(assistantId, {
            status: 'complete',
            streamedContent: (tokenBuffer.trim() || formatBrowserInferenceResult(result)).trim(),
            loadingStatus: null,
          }),
          onError: (error) => updateMessage(assistantId, { status: 'error', content: error.message, loadingStatus: null }),
        },
      );
    } catch (error) {
      onToast({ msg: error instanceof Error ? error.message : 'Local inference failed', type: 'error' });
    }
  }, [activeChatSessionId, installedModels, onToast, selectedModelId, workspaceName, workspacePromptContext]);

  useEffect(() => {
    if (!pendingSearch) {
      consumedPendingSearchRef.current = null;
      return;
    }
    if (consumedPendingSearchRef.current === pendingSearch) return;
    consumedPendingSearchRef.current = pendingSearch;
    void sendMessage(`Search the web for: ${pendingSearch}`);
    onSearchConsumed();
  }, [pendingSearch, onSearchConsumed, sendMessage]);

  return (
    <section className={`chat-panel ${showBash ? 'mode-terminal' : 'mode-chat'}`} aria-label={showBash ? 'Terminal' : 'Chat panel'}>
      <header className="chat-header">
        <div className="chat-heading">
          <span className="panel-eyebrow">{showBash ? 'Sandboxed shell' : 'Workspace assistant'}</span>
          <h2>{showBash ? 'Terminal' : 'Agent Chat'}</h2>
          <p>{showBash ? 'Run commands in a sandboxed just-bash shell. Files persist while the tab is open.' : `I'm your workspace assistant with access to local models, exploration context, and the capability files stored in ${workspaceName}.`}</p>
        </div>
        <div className="chat-mode-controls">
          <div className="chat-mode-tabs" role="tablist" aria-label="Panel mode">
            <button type="button" role="tab" aria-selected={!showBash} aria-label="Chat mode" className={`mode-tab ${!showBash ? 'active' : ''}`} onClick={() => onSwitchMode('agent')}><Icon name="sparkles" size={13} />Chat</button>
            <button type="button" role="tab" aria-selected={showBash} aria-label="Terminal mode" className={`mode-tab ${showBash ? 'active' : ''}`} onClick={() => onSwitchMode('terminal')}><Icon name="terminal" size={13} />Terminal</button>
          </div>
          {!showBash ? <button type="button" className="mode-tab mode-action" aria-label="New chat session" onClick={onNewAgentSession}><Icon name="plus" size={13} />New chat</button> : null}
          {showBash ? <button type="button" className="mode-tab mode-action" aria-label="New terminal session" onClick={onNewTerminalSession}><Icon name="plus" size={13} />New terminal</button> : null}
        </div>
      </header>
      <div hidden={!showBash}>
        {showBash && activeTerminalSessionId ? (
          <JustBashPanel
            sessionId={activeTerminalSessionId}
            onFsPathsChanged={onTerminalFsPathsChanged}
            bashBySessionRef={bashBySessionRef}
            historyBySession={bashHistoryBySession}
            setHistoryBySession={setBashHistoryBySession}
          />
        ) : null}
        {showBash && !activeTerminalSessionId ? <div className="chat-empty-state"><span>No terminal session selected.</span></div> : null}
      </div>
      <div hidden={showBash}>
        <>
          <div className="message-list" role="log" aria-live="polite">
            <div className="chat-empty-state">
              <Icon name="sparkles" size={14} color="#d1fae5" />
              <span>Ask about your workspace, browse the web, or run a task.</span>
            </div>
            {messages.map((message) => <ChatMessageView key={message.id} message={message} />)}
            <div ref={bottomRef} />
          </div>
          <div className="context-strip">Context: {installedModels.length} active local models · {workspaceCapabilities.agents.length} AGENTS.md · {workspaceCapabilities.skills.length} skills · {workspaceCapabilities.plugins.length} plugins · {workspaceCapabilities.hooks.length} hooks · {pendingSearch ? 'web search queued' : 'workspace ready'}</div>
          <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); void sendMessage(input); }}>
            <textarea aria-label="Chat input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask the local ONNX model…" rows={2} />
            <div className="composer-toolbar">
              <label className="model-pill">
                <span className="sr-only">Installed model</span>
                <select aria-label="Installed model" value={selectedModelId} onChange={(event) => setSelectedModelBySession((current) => ({ ...current, [activeChatSessionId]: event.target.value }))}>
                  <option value="">Choose an installed model</option>
                  {installedModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                </select>
              </label>
              <button type="submit" className="primary-button accent"><Icon name="send" size={14} color="#07130f" />Send</button>
            </div>
          </form>
        </>
      </div>
    </section>
  );
}

function ModelCard({ model, isInstalled, isLoading, onInstall, onDelete }: { model: HFModel; isInstalled: boolean; isLoading: boolean; onInstall: () => void; onDelete?: () => void }) {
  const taskLabel = HF_TASK_LABELS[model.task] ?? model.task;
  return (
    <div className="model-card">
      <div className="model-card-icon"><Icon name="layers" size={15} color={isInstalled ? '#34d399' : '#60a5fa'} /></div>
      <div className="model-card-body">
        <strong>{model.name}</strong>
        <span className="chip mini">{taskLabel}</span>
        <p>{model.author}</p>
        <small>{model.downloads.toLocaleString()} downloads · {model.likes.toLocaleString()} likes{model.sizeMB > 0 ? ` · ${model.sizeMB >= 1000 ? (model.sizeMB / 1000).toFixed(1) + 'GB' : model.sizeMB + 'MB'}` : ''}</small>
      </div>
      {isInstalled ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="badge connected">Installed</span>
          {onDelete && <button type="button" className="secondary-button" style={{ fontSize: 10 }} onClick={onDelete}>Remove</button>}
        </div>
      ) : (
        <button type="button" className="secondary-button" aria-label={`${model.name} ${isLoading ? 'Loading' : 'Load'}`} onClick={onInstall} disabled={isLoading}>
          {isLoading ? 'Loading…' : 'Load'}
        </button>
      )}
    </div>
  );
}

function SettingsPanel({ registryModels, installedModels, task, loadingModelId, onTaskChange, onSearch, onInstall, onDelete }: { registryModels: HFModel[]; installedModels: HFModel[]; task: string; loadingModelId: string | null; onTaskChange: (task: string) => void; onSearch: (query: string) => void; onInstall: (model: HFModel) => Promise<void>; onDelete: (id: string) => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const installedIds = new Set(installedModels.map((m) => m.id));
  // Recommended = seed models not yet installed, only shown when no filter active
  const recommended = (!searchQuery && !task) ? LOCAL_MODELS_SEED.filter((m) => !installedIds.has(m.id)) : [];
  const recommendedIds = new Set(recommended.map((m) => m.id));
  // HF results, deduped against installed + recommended
  const hfResults = registryModels.filter((r) => !installedIds.has(r.id) && !recommendedIds.has(r.id));

  function handleSearch(value: string) {
    setSearchQuery(value);
    onSearch(value);
  }

  return (
    <section className="panel-scroll settings-panel" aria-label="Settings">
      <span className="panel-eyebrow">Settings / Models</span>

      <div className="local-model-controls">
        <input aria-label="Hugging Face search" value={searchQuery} onChange={(event) => handleSearch(event.target.value)} placeholder="Search model registry" />
        <div className="chip-row">
          {TASK_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`chip ${task === option ? 'active' : ''}`}
              aria-pressed={task === option}
              onClick={() => onTaskChange(task === option ? '' : option)}
            >
              {HF_TASK_LABELS[option] ?? option}
            </button>
          ))}
        </div>
      </div>

      {installedModels.length > 0 && (
        <div className="model-section">
          <div className="panel-section-header"><span>Loaded ({installedModels.length})</span></div>
          {installedModels.map((model) => (
            <ModelCard key={model.id} model={model} isInstalled={true} isLoading={false} onInstall={() => undefined} onDelete={() => onDelete(model.id)} />
          ))}
        </div>
      )}

      {recommended.length > 0 && (
        <div className="model-section">
          <div className="panel-section-header"><span>Recommended ({recommended.length})</span></div>
          {recommended.map((model) => (
            <ModelCard key={model.id} model={model} isInstalled={false} isLoading={loadingModelId === model.id} onInstall={() => void onInstall(model)} />
          ))}
        </div>
      )}

      <div className="model-section settings-result-list">
        <div className="panel-section-header">
          <span>{searchQuery || task ? `Results (${hfResults.length})` : `Popular on HF (${hfResults.length})`}</span>
          <span className="muted">{installedModels.length} models loaded</span>
        </div>
        {hfResults.map((model) => (
          <ModelCard key={model.id} model={model} isInstalled={false} isLoading={loadingModelId === model.id} onInstall={() => void onInstall(model)} />
        ))}
        {!hfResults.length && !recommended.length && <p className="muted">Search the model registry to find browser-runnable ONNX models.</p>}
      </div>
    </section>
  );
}

function HistoryPanel() {
  return <section className="panel-scroll history-panel" aria-label="History"><span className="panel-eyebrow">History</span><h2>Recent sessions</h2><p className="muted">Pick up where you left off across research, build, and UX investigations.</p>{mockHistory.map((session) => <article key={session.id} className="list-card history-card"><div className="history-card-header"><div><h3>{session.title}</h3><p className="muted">{session.date}</p></div><span className="badge">{session.events.length} events</span></div><p>{session.preview}</p><ul>{session.events.map((entry) => <li key={entry}>{entry}</li>)}</ul></article>)}</section>;
}

interface MarketplaceExtension {
  id: string;
  name: string;
  author: string;
  description: string;
  iconColor: string;
  iconLetter: string;
  stars: number;
  users: string;
  installed: boolean;
  category: string;
}

const MARKETPLACE_ITEMS: MarketplaceExtension[] = [
  { id: 'ublock', name: 'uBlock Origin', author: 'Raymond Hill', description: 'An efficient wide-spectrum content blocker for Chromium and Firefox.', iconColor: '#800000', iconLetter: 'uB', stars: 5, users: '10M+', installed: true, category: 'Privacy' },
  { id: 'dark-reader', name: 'Dark Reader', author: 'Dark Reader Ltd', description: 'Dark mode for every website. Take care of your eyes, use Dark Reader for night and daily browsing.', iconColor: '#1a1a2e', iconLetter: 'DR', stars: 4, users: '5M+', installed: true, category: 'Productivity' },
  { id: 'mcp-bridge', name: 'MCP Bridge', author: 'Anthropic', description: 'Connect to Model Context Protocol servers for tool-augmented AI interactions.', iconColor: '#d97706', iconLetter: 'MC', stars: 4, users: '50K+', installed: false, category: 'AI' },
  { id: '1password', name: '1Password', author: 'AgileBits', description: 'The best way to experience 1Password in your browser. Easily sign in, generate passwords, and autofill forms.', iconColor: '#0572ec', iconLetter: '1P', stars: 5, users: '2M+', installed: false, category: 'Privacy' },
  { id: 'react-devtools', name: 'React DevTools', author: 'Meta', description: 'Adds React debugging tools to the browser DevTools. Inspect the component hierarchy and props.', iconColor: '#61dafb', iconLetter: 'Re', stars: 4, users: '3M+', installed: true, category: 'Developer' },
  { id: 'copilot', name: 'GitHub Copilot', author: 'GitHub', description: 'AI pair programmer that helps you write code faster with autocomplete-style suggestions.', iconColor: '#238636', iconLetter: 'GH', stars: 5, users: '1M+', installed: false, category: 'AI' },
  { id: 'bitwarden', name: 'Bitwarden', author: 'Bitwarden Inc', description: 'A secure and free password manager for all of your devices.', iconColor: '#175DDC', iconLetter: 'Bw', stars: 4, users: '1M+', installed: false, category: 'Privacy' },
  { id: 'grammarly', name: 'Grammarly', author: 'Grammarly Inc', description: 'Improve your writing with AI-powered grammar checking, spell checking, and style suggestions.', iconColor: '#15c39a', iconLetter: 'Gr', stars: 4, users: '10M+', installed: false, category: 'Productivity' },
  { id: 'json-viewer', name: 'JSON Viewer', author: 'nicedoc.io', description: 'Beautify and format JSON data in the browser with syntax highlighting and tree view.', iconColor: '#f59e0b', iconLetter: 'JS', stars: 4, users: '500K+', installed: true, category: 'Developer' },
  { id: 'vimium', name: 'Vimium', author: 'Phil Crosby', description: 'The Hacker\'s browser. Navigate the web without a mouse using Vim-like keybindings.', iconColor: '#4ade80', iconLetter: 'Vi', stars: 5, users: '800K+', installed: false, category: 'Tools' },
];

function ExtensionsPanel({ workspaceName, capabilities }: { workspaceName: string; capabilities: WorkspaceCapabilities }) {
  const [search, setSearch] = useState('');
  const [installedExtensions, setInstalledExtensions] = useState<Set<string>>(() => new Set(MARKETPLACE_ITEMS.filter((e) => e.installed).map((e) => e.id)));

  const filtered = MARKETPLACE_ITEMS.filter((ext) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return ext.name.toLowerCase().includes(q) || ext.description.toLowerCase().includes(q) || ext.author.toLowerCase().includes(q);
  });

  const toggleInstall = (id: string) => {
    setInstalledExtensions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <section className="panel-scroll extensions-panel" aria-label="Extensions">
      <div className="extensions-topbar">
        <Icon name="puzzle" size={16} color="#f59e0b" />
        <h2>Extensions</h2>
        <span className="badge">{installedExtensions.size} installed</span>
      </div>
      <div className="extensions-search">
        <input aria-label="Search extensions" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search extensions…" />
      </div>
      <div className="extensions-grid">
        {filtered.map((ext) => {
          const isInstalled = installedExtensions.has(ext.id);
          return (
            <article key={ext.id} className="marketplace-card">
              <div className="marketplace-card-icon" style={{ background: ext.iconColor }}>
                <span>{ext.iconLetter}</span>
              </div>
              <div className="marketplace-card-body">
                <strong>{ext.name}</strong>
                <span className="marketplace-card-author">{ext.author}</span>
                <p className="marketplace-card-desc">{ext.description}</p>
                <div className="marketplace-card-meta">
                  <span className="marketplace-stars">{'★'.repeat(ext.stars)}{'☆'.repeat(5 - ext.stars)}</span>
                  <span className="muted">{ext.users}</span>
                </div>
              </div>
              <button type="button" className={`marketplace-install-btn ${isInstalled ? 'installed' : ''}`} onClick={() => toggleInstall(ext.id)}>
                {isInstalled ? 'Installed' : 'Add'}
              </button>
            </article>
          );
        })}
        {filtered.length === 0 && <p className="muted">No extensions match your search.</p>}
      </div>
      {capabilities.plugins.length > 0 && (
        <div className="workspace-plugins-section">
          <h3>Workspace Plugins ({workspaceName})</h3>
          {capabilities.plugins.map((plugin) => (
            <div key={plugin.path} className="list-card extension-card">
              <div className="extension-icon"><Icon name="puzzle" color="#f59e0b" /></div>
              <div className="extension-content">
                <div className="extension-title-row"><h3>{plugin.directory}</h3><span className="badge">{plugin.manifestName}</span></div>
                <p>{plugin.path}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function WorkspaceSwitcherOverlay({
  workspaces,
  activeWorkspaceId,
  onSwitch,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onClose,
}: {
  workspaces: TreeNode[];
  activeWorkspaceId: string;
  onSwitch: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
  onRenameWorkspace: (workspaceId: string) => void;
  onDeleteWorkspace?: (workspaceId: string) => void;
  onClose: () => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSwitch = (id: string) => {
    onSwitch(id);
    onClose();
  };

  const handleCreate = () => {
    onCreateWorkspace();
    onClose();
  };

  return (
    <div className="ws-overlay-backdrop" role="dialog" aria-modal="true" aria-label="Workspace switcher" onClick={onClose}>
      <div className="ws-overlay-content" onClick={(e) => e.stopPropagation()}>
        <div className="ws-overlay-title" role="heading" aria-level={2}>Workspaces</div>
        <div className="ws-overlay-grid">
          {workspaces.map((workspace, index) => {
            const isActive = workspace.id === activeWorkspaceId;
            const isHovered = workspace.id === hoveredId;
            const color = workspace.color ?? '#60a5fa';
            const tabCount = countTabs(workspace);
            const tabs = flattenTabs(workspace, 'browser').slice(0, 4);

            return (
              <div
                key={workspace.id}
                className={`workspace-card ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredId(workspace.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleSwitch(workspace.id)}
              >
                <div
                  className="ws-card-thumbnail"
                  style={{
                    borderColor: isActive ? color : isHovered ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.06)',
                    background: isActive ? color + '10' : 'rgba(255,255,255,.03)',
                  }}
                >
                  <div className="ws-card-tab-list">
                    {tabs.length > 0 ? tabs.map((tab) => (
                      <div key={tab.id} className="ws-card-tab-row">
                        <span className="ws-card-tab-dot" style={{ background: color + '30' }} />
                        <span className="ws-card-tab-name">{tab.name}</span>
                      </div>
                    )) : (
                      <div className="ws-card-empty">Empty workspace</div>
                    )}
                    {flattenTabs(workspace, 'browser').length > 4 && (
                      <div className="ws-card-more">+{flattenTabs(workspace, 'browser').length - 4} more</div>
                    )}
                  </div>
                  {isActive && <div className="ws-card-active-bar" style={{ background: color }} />}
                </div>
                <div className="ws-card-label">
                  <span className="ws-card-badge" style={{ background: color + '25', color, borderColor: color + '40' }}>
                    {index + 1}
                  </span>
                  <span className="ws-card-name" onDoubleClick={(e) => { e.stopPropagation(); onRenameWorkspace(workspace.id); }}>
                    {workspace.name}
                  </span>
                  <span className="ws-card-tab-count">{tabCount}</span>
                </div>
                {isHovered && !isActive && workspaces.length > 1 && onDeleteWorkspace && (
                  <button
                    type="button"
                    className="ws-card-delete"
                    onClick={(e) => { e.stopPropagation(); onDeleteWorkspace(workspace.id); }}
                    aria-label={`Delete workspace ${workspace.name}`}
                  >
                    <Icon name="x" size={10} color="rgba(255,255,255,.5)" />
                  </button>
                )}
              </div>
            );
          })}
          <div className="workspace-card ws-card-new" onClick={handleCreate}>
            <div className="ws-card-thumbnail ws-card-new-thumb">
              <Icon name="plus" size={20} color="rgba(255,255,255,.2)" />
              <span className="ws-card-new-label">New workspace</span>
            </div>
            <div className="ws-card-label">
              <span className="ws-card-new-hint">Ctrl+Alt+N</span>
            </div>
          </div>
        </div>
        <div className="ws-overlay-hints">
          <span>Ctrl+1-9 switch</span>
          <span>Ctrl+Alt+←→ cycle</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}

function ShortcutOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className="modal-card shortcuts-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="panel-eyebrow">Hotkeys</span>
            <h2>Keyboard Shortcuts</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close keyboard shortcuts"><Icon name="x" /></button>
        </div>
        <div className="shortcut-groups">
          {WORKSPACE_SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="shortcut-group">
              <h3>{group.title}</h3>
              <ul className="shortcut-list">
                {group.items.map((item) => (
                  <li key={item.keys}>
                    <span>{item.description}</span>
                    <kbd>{item.keys}</kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="shortcut-overlay-footer">Press Esc or click outside to close</div>
      </div>
    </div>
  );
}

function RenameWorkspaceOverlay({
  value,
  onChange,
  onSave,
  onClose,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Rename workspace" onClick={onClose}>
      <div className="modal-card compact" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="panel-eyebrow">Workspace</span>
            <h2>Rename workspace</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close rename workspace"><Icon name="x" /></button>
        </div>
        <div className="add-file-form">
          <label className="file-editor-field">
            <span>Name</span>
            <input aria-label="Workspace name" value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSave(); }} />
          </label>
          <div className="add-file-buttons">
            <button type="button" className="primary-button" onClick={onSave}>Save</button>
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarTree({ root, workspaceByNodeId, activeWorkspaceId, openTabId, editingFilePath, cursorId, selectedIds, onCursorChange, onToggleFolder, onOpenTab, onCloseTab, onOpenFile, onAddFile, onAddAgent, onAddTerminal, items }: { root: TreeNode; workspaceByNodeId: Map<string, string>; activeWorkspaceId: string; openTabId: string | null; editingFilePath: string | null; cursorId: string | null; selectedIds: string[]; onCursorChange: (id: string) => void; onToggleFolder: (id: string) => void; onOpenTab: (id: string) => void; onCloseTab: (id: string) => void; onOpenFile: (id: string) => void; onAddFile: (workspaceId: string) => void; onAddAgent: (workspaceId: string) => void; onAddTerminal: (workspaceId: string) => void; items: FlatTreeItem[] }) {
  return (
    <div className="tree-panel" role="tree" aria-label="Workspace tree">
      {items.map(({ node, depth }) => {
        const isFolder = node.type !== 'tab' && node.type !== 'file';
        const isWorkspace = node.type === 'workspace';
        const isFile = node.type === 'file';
        const isActiveWs = isWorkspace && node.id === activeWorkspaceId;
        const isEditingFile = isFile && node.filePath === editingFilePath;
        const isSelected = selectedIds.includes(node.id);
        const tabOpacity = node.type === 'tab' ? (node.memoryTier === 'cold' ? 0.5 : node.memoryTier === 'cool' ? 0.65 : 0.9) : undefined;
        const workspaceParentId = workspaceByNodeId.get(node.id);
        const workspaceParent = workspaceParentId ? getWorkspace(root, workspaceParentId) : null;
        return (
          <div key={node.id} role="treeitem" className={`tree-row ${isWorkspace ? 'ws-node' : ''} ${isActiveWs ? 'ws-active' : ''} ${cursorId === node.id ? 'cursor' : ''} ${openTabId === node.id ? 'active' : ''} ${isEditingFile ? 'active' : ''} ${isSelected ? 'selected' : ''} ${isFile ? 'file-node' : ''}`} style={{ paddingLeft: `${depth * 16}px` }}>
            <button type="button" className="tree-button" style={tabOpacity !== undefined ? { opacity: tabOpacity } : undefined} onFocus={() => onCursorChange(node.id)} onClick={() => isFile ? onOpenFile(node.id) : isFolder ? onToggleFolder(node.id) : onOpenTab(node.id)}>
              {isFile ? (
                <Icon name="file" size={12} color="#a5b4fc" />
              ) : isFolder ? (
                <>
                  <span className={`tree-chevron ${node.expanded ? 'tree-chevron-expanded' : ''}`}><Icon name="chevronRight" size={11} color="rgba(255,255,255,.25)" /></span>
                  {isWorkspace && node.activeMemory ? <ActiveMemoryPulse /> : null}
                  {isWorkspace && node.persisted ? <span className="persist-badge" title="Persisted" aria-label="Persisted workspace">📌</span> : null}
                  {node.nodeKind === 'browser' ? <Icon name="globe" size={12} color="#93c5fd" /> : null}
                  {node.nodeKind === 'terminal' ? <Icon name="terminal" size={12} color="#86efac" /> : null}
                  {node.nodeKind === 'agent' ? <Icon name="sparkles" size={12} color="#c4b5fd" /> : null}
                  {node.nodeKind === 'files' ? <Icon name="file" size={12} color="#a5b4fc" /> : null}
                  {!node.nodeKind ? <Icon name={node.expanded ? 'folderOpen' : 'folder'} size={isWorkspace ? 13 : 12} color={isWorkspace && node.activeMemory ? '#34d399' : node.color ?? '#60a5fa'} /> : null}
                </>
              ) : (
                <>
                  {node.nodeKind === 'browser' ? (
                    <>
                      <span className="tier-dot" style={{ background: TIERS[node.memoryTier ?? 'cold'].color }} />
                      <Favicon url={node.url} size={13} />
                    </>
                  ) : node.nodeKind === 'terminal' ? <Icon name="terminal" size={13} color="#86efac" /> : <Icon name="sparkles" size={13} color="#c4b5fd" />}
                </>
              )}
              <span className={isWorkspace && !node.persisted ? 'ws-name-temp' : ''}>{node.name}</span>
              {node.type === 'tab' && node.nodeKind === 'browser' ? <span className="tree-meta">{fmtMem(node.memoryMB ?? 0)}</span> : null}
              {isWorkspace ? <span className="tree-meta">{countTabs(node)} tabs · {fmtMem(totalMemoryMB(node))}</span> : null}
            </button>
            {node.type === 'tab' ? <button type="button" className="icon-button subtle" aria-label={`Close ${node.name}`} onClick={() => onCloseTab(node.id)}><Icon name="x" size={12} /></button> : null}
            {isFile ? <button type="button" className="icon-button subtle" aria-label={`Remove ${node.name}`} onClick={() => onCloseTab(node.id)}><Icon name="x" size={12} /></button> : null}
            {isWorkspace ? <button type="button" className="icon-button subtle" aria-label={`Add file to ${node.name}`} onClick={() => onAddFile(node.id)}><Icon name="plus" size={11} /></button> : null}
            {node.type === 'folder' && node.nodeKind === 'agent' && workspaceParent ? <button type="button" className="icon-button subtle" aria-label={`Add chat to ${workspaceParent.name}`} onClick={() => onAddAgent(workspaceParent.id)}><Icon name="plus" size={11} /></button> : null}
            {node.type === 'folder' && node.nodeKind === 'terminal' && workspaceParent ? <button type="button" className="icon-button subtle" aria-label={`Add terminal to ${workspaceParent.name}`} onClick={() => onAddTerminal(workspaceParent.id)}><Icon name="plus" size={11} /></button> : null}
          </div>
        );
      })}
    </div>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  return toast ? <div className={`toast ${toast.type}`}>{toast.msg}</div> : null;
}

function AgentBrowserApp() {
  const { toast, setToast } = useToast();
  const [root, setRoot] = useState<TreeNode>(createInitialRoot);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('ws-research');
  const [activePanel, setActivePanel] = useState<'workspaces' | 'history' | 'extensions' | 'settings' | 'account'>('workspaces');
  const [collapsed, setCollapsed] = useState(false);
  const [registryTask, setRegistryTask] = useState('');
  const [registryQuery, setRegistryQuery] = useState('');
  const [registryModels, setRegistryModels] = useState<HFModel[]>([]);
  const [installedModels, setInstalledModels] = useState<HFModel[]>([]);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [omnibar, setOmnibar] = useState('');
  const [openTabId, setOpenTabId] = useState<string | null>(null);
  const [editingFilePath, setEditingFilePath] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [showAddFileMenu, setShowAddFileMenu] = useState<string | null>(null);
  const [addFileName, setAddFileName] = useState('');
  const [pendingSearch, setPendingSearch] = useState<string | null>(null);
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [treeFilter, setTreeFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [clipboardIds, setClipboardIds] = useState<string[]>([]);
  const [renamingWorkspaceId, setRenamingWorkspaceId] = useState<string | null>(null);
  const [workspaceDraftName, setWorkspaceDraftName] = useState('');
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const slideTimeoutRef = useRef<number>(0);
  const omnibarRef = useRef<HTMLInputElement | null>(null);
  const [workspaceFilesByWorkspace, setWorkspaceFilesByWorkspace] = useState<Record<string, WorkspaceFile[]>>(() => loadWorkspaceFiles([...INITIAL_WORKSPACE_IDS]));
  const [terminalFsPathsBySession, setTerminalFsPathsBySession] = useState<Record<string, string[]>>({});
  const [activeSessionMode, setActiveSessionMode] = useState<'agent' | 'terminal'>('agent');
  const [activeAgentSessionId, setActiveAgentSessionId] = useState<string | null>(null);
  const [activeTerminalSessionId, setActiveTerminalSessionId] = useState<string | null>(null);

  const activeWorkspace = getWorkspace(root, activeWorkspaceId) ?? root;
  const visibleItems = useMemo(() => flattenTreeFiltered(root, treeFilter), [root, treeFilter]);
  const openTab = openTabId ? findNode(root, openTabId) : null;
  const openBrowserTab = openTab?.type === 'tab' && (openTab.nodeKind ?? 'browser') === 'browser' ? openTab : null;
  const workspaceByNodeId = useMemo(() => buildWorkspaceNodeMap(root), [root]);
  const activeWorkspaceFiles = workspaceFilesByWorkspace[activeWorkspaceId] ?? [];
  const activeWorkspaceCapabilities = useMemo(() => discoverWorkspaceCapabilities(activeWorkspaceFiles), [activeWorkspaceFiles]);
  const editingFile = editingFilePath ? activeWorkspaceFiles.find((f) => f.path === editingFilePath) ?? null : null;

  useEffect(() => {
    if (activeWorkspace.type !== 'workspace') return;
    const firstAgent = findFirstSessionId(activeWorkspace, 'agent');
    const firstTerminal = findFirstSessionId(activeWorkspace, 'terminal');
    setActiveAgentSessionId((current) => current && findNode(activeWorkspace, current) ? current : firstAgent);
    setActiveTerminalSessionId((current) => current && findNode(activeWorkspace, current) ? current : firstTerminal);
  }, [activeWorkspace]);

  useEffect(() => {
    setRoot((current) => ({
      ...current,
      children: (current.children ?? []).map((workspace) => workspace.type === 'workspace' ? ensureWorkspaceCategories(workspace) : workspace),
    }));
  }, []);

  // Sync workspace files + terminal virtual filesystems into the Files category per workspace.
  useEffect(() => {
    setRoot((current) => {
      const workspaces = current.children ?? [];
      const updated = workspaces.map((ws) => {
        if (ws.type !== 'workspace') return ws;
        const normalizedWorkspace = ensureWorkspaceCategories(ws);
        const files = workspaceFilesByWorkspace[ws.id] ?? [];
        const fileNodes: TreeNode[] = files.map((f) => ({
          id: `file:${ws.id}:${f.path}`,
          name: f.path.split('/').pop() ?? f.path,
          type: 'file' as const,
          filePath: f.path,
        }));
        const terminalCategory = getWorkspaceCategory(normalizedWorkspace, 'terminal');
        const terminalFsNodes: TreeNode[] = (terminalCategory?.children ?? [])
          .filter((child) => child.type === 'tab' && child.nodeKind === 'terminal')
          .map((terminalNode) => ({
            id: `vfs:${ws.id}:${terminalNode.id}`,
            name: `${terminalNode.name} FS`,
            type: 'folder',
            expanded: false,
            children: createVirtualFsTreeNodes(`vfs:${ws.id}:${terminalNode.id}`, terminalFsPathsBySession[terminalNode.id] ?? []),
          }));
        const nextChildren = (normalizedWorkspace.children ?? []).map((child) => child.nodeKind === 'files'
          ? { ...child, children: [...fileNodes, ...terminalFsNodes] }
          : child);
        return { ...normalizedWorkspace, children: nextChildren };
      });
      return { ...current, children: updated };
    });
  }, [terminalFsPathsBySession, workspaceFilesByWorkspace]);

  const switchWorkspace = useCallback((newId: string) => {
    if (newId === activeWorkspaceId) return;
    const workspaces = root.children ?? [];
    const oldIdx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
    const newIdx = workspaces.findIndex((w) => w.id === newId);
    setSlideDir(newIdx > oldIdx ? 'left' : 'right');
    setActiveWorkspaceId(newId);
    window.clearTimeout(slideTimeoutRef.current);
    slideTimeoutRef.current = window.setTimeout(() => setSlideDir(null), 300);
  }, [activeWorkspaceId, root]);

  const openWorkspaceSwitcher = useCallback(() => {
    setActivePanel('workspaces');
    setCollapsed(false);
    setShowWorkspaces(true);
  }, []);

  const jumpToWorkspaceByIndex = useCallback((index: number) => {
    const workspaces = root.children ?? [];
    const target = workspaces[index];
    if (!target) return;
    switchWorkspace(target.id);
  }, [root, switchWorkspace]);

  const openRenameWorkspace = useCallback((workspaceId: string) => {
    const workspace = getWorkspace(root, workspaceId);
    if (!workspace) return;
    setShowWorkspaces(false);
    setWorkspaceDraftName(workspace.name);
    setRenamingWorkspaceId(workspaceId);
  }, [root]);

  const createWorkspace = useCallback(() => {
    const name = nextWorkspaceName(root);
    const workspaceId = `ws-${createUniqueId()}`;
    const workspace = createWorkspaceNode({
      id: workspaceId,
      name,
      color: WORKSPACE_COLORS[(root.children ?? []).length % WORKSPACE_COLORS.length],
      browserTabs: [],
    });
    setRoot((current) => ({
      ...current,
      children: [
        ...(current.children ?? []),
        workspace,
      ],
    }));
    setActiveAgentSessionId(findFirstSessionId(workspace, 'agent'));
    setActiveTerminalSessionId(findFirstSessionId(workspace, 'terminal'));
    setWorkspaceFilesByWorkspace((current) => ({ ...current, [workspaceId]: [] }));
    setActiveWorkspaceId(workspaceId);
    setToast({ msg: `Created ${name}`, type: 'success' });
  }, [root, setToast]);

  const saveWorkspaceRename = useCallback(() => {
    const nextName = workspaceDraftName.trim();
    if (!renamingWorkspaceId || !nextName) {
      setRenamingWorkspaceId(null);
      return;
    }
    setRoot((current) => deepUpdate(current, renamingWorkspaceId, (workspace) => ({ ...workspace, name: nextName })));
    setToast({ msg: `Renamed workspace to ${nextName}`, type: 'success' });
    setRenamingWorkspaceId(null);
  }, [renamingWorkspaceId, setToast, workspaceDraftName]);

  const addSessionToWorkspace = useCallback((workspaceId: string, kind: 'agent' | 'terminal') => {
    let newSessionId: string | null = null;
    setRoot((current) => {
      const workspace = getWorkspace(current, workspaceId);
      if (!workspace) return current;
      const normalized = ensureWorkspaceCategories(workspace);
      const category = getWorkspaceCategory(normalized, kind);
      const nextIndex = (category?.children ?? []).filter((child) => child.type === 'tab' && child.nodeKind === kind).length + 1;
      const newSession = createSessionNode(workspaceId, kind, nextIndex);
      newSessionId = newSession.id;
      return deepUpdate(current, workspaceId, (node) => {
        const withCategories = ensureWorkspaceCategories(node);
        return {
          ...withCategories,
          expanded: true,
          children: (withCategories.children ?? []).map((child) => child.nodeKind === kind
            ? { ...child, expanded: true, children: [...(child.children ?? []), newSession] }
            : child),
        };
      });
    });
    switchWorkspace(workspaceId);
    setOpenTabId(null);
    setEditingFilePath(null);
    if (kind === 'agent') {
      if (newSessionId) setActiveAgentSessionId(newSessionId);
      setToast({ msg: 'New chat session created', type: 'success' });
      return;
    }
    if (newSessionId) setActiveTerminalSessionId(newSessionId);
    setToast({ msg: 'New terminal session created', type: 'success' });
  }, [setToast, switchWorkspace]);

  const pasteSelectionIntoWorkspace = useCallback((workspaceId: string) => {
    if (!clipboardIds.length) return;
    const destination = getWorkspace(root, workspaceId);
    if (!destination) return;

    const filesToMove: Array<{ file: WorkspaceFile; sourceWorkspaceId: string }> = [];
    const tabsToMove = new Set<string>();

    for (const id of clipboardIds) {
      const node = findNode(root, id);
      const sourceWorkspace = findWorkspaceForNode(root, id);
      if (!node || !sourceWorkspace) continue;
      if (node.type === 'file' && node.filePath) {
        const file = (workspaceFilesByWorkspace[sourceWorkspace.id] ?? []).find((entry) => entry.path === node.filePath);
        if (file) filesToMove.push({ file, sourceWorkspaceId: sourceWorkspace.id });
      }
      if (node.type === 'tab') tabsToMove.add(id);
    }

    if (filesToMove.length) {
      setWorkspaceFilesByWorkspace((current) => {
        const next = { ...current };
        for (const { file, sourceWorkspaceId } of filesToMove) {
          next[sourceWorkspaceId] = removeWorkspaceFile(next[sourceWorkspaceId] ?? [], file.path);
          next[workspaceId] = upsertWorkspaceFile(next[workspaceId] ?? [], file);
        }
        return next;
      });
    }

    if (tabsToMove.size) {
      setRoot((current) => {
        const movedTabs: TreeNode[] = [];
        const withoutMoved = (current.children ?? []).map((workspace) => deepUpdate(ensureWorkspaceCategories(workspace), workspace.id, (node) => ({
          ...node,
          children: (node.children ?? []).map((category) => ({
            ...category,
            children: (category.children ?? []).filter((child) => {
              if (tabsToMove.has(child.id)) {
                movedTabs.push(child);
                return false;
              }
              return true;
            }),
          })),
        })));
        const children = withoutMoved.map((workspace) => {
          if (workspace.id !== workspaceId) return workspace;
          return {
            ...workspace,
            expanded: true,
            children: (workspace.children ?? []).map((category) => ({
              ...category,
              expanded: true,
              children: category.nodeKind
                ? [...(category.children ?? []), ...movedTabs.filter((tab) => (tab.nodeKind ?? 'browser') === category.nodeKind)]
                : category.children,
            })),
          };
        });
        return { ...current, children: children as TreeNode[] };
      });
    }

    setClipboardIds([]);
    setSelectedIds([]);
    setSelectionAnchorId(null);
    setToast({ msg: `Pasted ${clipboardIds.length} item${clipboardIds.length === 1 ? '' : 's'} into ${destination.name}`, type: 'success' });
  }, [clipboardIds, root, setToast, workspaceFilesByWorkspace]);

  useCopilotReadable({
    description: 'Current agent browser workspace context',
    value: {
      activePanel,
      activeWorkspace: activeWorkspace.name,
      openTab: openBrowserTab?.name ?? null,
      installedModels: installedModels.map((model) => ({ id: model.id, task: model.task })),
      tabsInWorkspace: countTabs(activeWorkspace),
      workspaceFiles: activeWorkspaceFiles.map((file) => file.path),
      agentsInstructions: activeWorkspaceCapabilities.agents.map((file) => file.path),
      skills: activeWorkspaceCapabilities.skills.map((skill) => skill.name),
      plugins: activeWorkspaceCapabilities.plugins.map((plugin) => plugin.directory),
      hooks: activeWorkspaceCapabilities.hooks.map((hook) => hook.name),
    },
  }, [activePanel, activeWorkspace, installedModels, openBrowserTab, activeWorkspaceCapabilities, activeWorkspaceFiles]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchBrowserModels(registryQuery, registryTask, 25, controller.signal)
        .then(setRegistryModels)
        .catch((error) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          if (error instanceof Error && error.name === 'AbortError') return;
          setToast({ msg: error instanceof Error ? error.message : 'Registry search failed', type: 'error' });
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [registryQuery, registryTask, setToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(WORKSPACE_FILES_STORAGE_KEY, JSON.stringify(workspaceFilesByWorkspace));
      } catch (error) {
        setToast({
          msg: error instanceof Error ? error.message : 'Failed to persist workspace files locally',
          type: 'warning',
        });
      }
    }, WORKSPACE_FILE_STORAGE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [setToast, workspaceFilesByWorkspace]);

  useEffect(() => {
    if (!visibleItems.length) {
      setCursorId(null);
      return;
    }
    if (!cursorId || !visibleItems.some((item) => item.node.id === cursorId)) {
      setCursorId(visibleItems[0].node.id);
    }
  }, [cursorId, visibleItems]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowShortcuts(false);
        setShowWorkspaces(false);
        setShowAddFileMenu(null);
        setTreeFilter('');
        setSelectedIds([]);
        setSelectionAnchorId(null);
        setClipboardIds([]);
        setRenamingWorkspaceId(null);
        if (editingFilePath) setEditingFilePath(null);
        if (openTabId) setOpenTabId(null);
        return;
      }
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      if (event.key === '?') { event.preventDefault(); setShowShortcuts(true); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o' && !event.altKey) {
        event.preventDefault();
        openWorkspaceSwitcher();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        jumpToWorkspaceByIndex(Number(event.key) - 1);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        createWorkspace();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        const workspaces = root.children ?? [];
        const idx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
        if (event.key === 'ArrowLeft' && idx > 0) switchWorkspace(workspaces[idx - 1].id);
        if (event.key === 'ArrowRight' && idx < workspaces.length - 1) switchWorkspace(workspaces[idx + 1].id);
        return;
      }
      if (activePanel !== 'workspaces') return;

      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        omnibarRef.current?.focus();
        omnibarRef.current?.select();
        return;
      }

      const index = visibleItems.findIndex((item) => item.node.id === cursorId);
      const currentNode = cursorId ? findNode(root, cursorId) : null;
      const currentParent = cursorId ? findParent(root, cursorId) : null;
      const setRangeSelection = (targetIndex: number) => {
        const anchorId = selectionAnchorId ?? cursorId ?? visibleItems[targetIndex]?.node.id ?? null;
        if (!anchorId) return;
        const anchorIndex = visibleItems.findIndex((item) => item.node.id === anchorId);
        const [start, end] = [anchorIndex, targetIndex].sort((a, b) => a - b);
        setSelectedIds(visibleItems.slice(start, end + 1).map((item) => item.node.id));
        setSelectionAnchorId(anchorId);
      };

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelectedIds(visibleItems.map((item) => item.node.id));
        setSelectionAnchorId(cursorId);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x') {
        event.preventDefault();
        const nextClipboard = selectedIds.length ? selectedIds : cursorId ? [cursorId] : [];
        setClipboardIds(nextClipboard);
        setToast({ msg: nextClipboard.length ? `Cut ${nextClipboard.length} item${nextClipboard.length === 1 ? '' : 's'}` : 'Nothing selected to cut', type: nextClipboard.length ? 'info' : 'warning' });
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        const targetWorkspace = currentNode?.type === 'workspace'
          ? currentNode
          : currentParent?.type === 'workspace'
            ? currentParent
            : (cursorId ? findWorkspaceForNode(root, cursorId) : null) ?? getWorkspace(root, activeWorkspaceId);
        if (targetWorkspace) pasteSelectionIntoWorkspace(targetWorkspace.id);
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === ' ' && cursorId) {
        event.preventDefault();
        setSelectedIds((current) => current.includes(cursorId) ? current.filter((id) => id !== cursorId) : [...current, cursorId]);
        setSelectionAnchorId(cursorId);
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1 && /\S/.test(event.key)) {
        event.preventDefault();
        setTreeFilter((current) => `${current}${event.key.toLowerCase()}`);
        return;
      }
      if (event.key === 'Backspace' && treeFilter) {
        event.preventDefault();
        setTreeFilter((current) => current.slice(0, -1));
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = visibleItems[Math.min(visibleItems.length - 1, Math.max(0, index + 1))];
        if (next) {
          setCursorId(next.node.id);
          if (event.shiftKey) setRangeSelection(visibleItems.findIndex((item) => item.node.id === next.node.id));
        }
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prev = visibleItems[Math.max(0, index - 1)];
        if (prev) {
          setCursorId(prev.node.id);
          if (event.shiftKey) setRangeSelection(visibleItems.findIndex((item) => item.node.id === prev.node.id));
        }
      }
      if (event.key === 'Home' && visibleItems.length) {
        event.preventDefault();
        setCursorId(visibleItems[0].node.id);
      }
      if (event.key === 'End' && visibleItems.length) {
        event.preventDefault();
        setCursorId(visibleItems[visibleItems.length - 1].node.id);
      }
      if (event.key === 'ArrowRight' && cursorId) {
        if (currentNode && currentNode.type !== 'tab' && currentNode.type !== 'file' && !currentNode.expanded) {
          event.preventDefault();
          setRoot((current) => deepUpdate(current, currentNode.id, (entry) => ({ ...entry, expanded: true })));
          return;
        }
        if (currentNode?.type === 'workspace' && currentNode.children?.length) {
          event.preventDefault();
          setCursorId(currentNode.children[0].id);
          return;
        }
      }
      if (event.key === 'ArrowLeft' && cursorId) {
        if (currentNode && currentNode.type !== 'tab' && currentNode.type !== 'file' && currentNode.expanded) {
          event.preventDefault();
          setRoot((current) => deepUpdate(current, currentNode.id, (entry) => ({ ...entry, expanded: false })));
          return;
        }
        if (currentParent && currentParent.type !== 'root') {
          event.preventDefault();
          setCursorId(currentParent.id);
          return;
        }
      }
      if (event.key === 'Enter' && cursorId) {
        event.preventDefault();
        if (currentNode?.type === 'tab') handleOpenTreeTab(currentNode.id);
        if (currentNode?.type === 'file') handleOpenFileNode(currentNode.id);
        if (currentNode && currentNode.type !== 'tab' && currentNode.type !== 'file') {
          setRoot((current) => deepUpdate(current, currentNode.id, (entry) => ({ ...entry, expanded: !entry.expanded })));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePanel, activeWorkspaceId, clipboardIds, createWorkspace, cursorId, editingFilePath, handleOpenFileNode, jumpToWorkspaceByIndex, openTabId, openWorkspaceSwitcher, pasteSelectionIntoWorkspace, root, selectedIds, selectionAnchorId, setToast, switchWorkspace, treeFilter, visibleItems]);

  async function installModel(model: HFModel) {
    if (loadingModelId === model.id) return;
    if (installedModels.some((entry) => entry.id === model.id)) {
      setToast({ msg: `${model.name} is already installed`, type: 'info' });
      return;
    }

    setLoadingModelId(model.id);
    setToast({ msg: `Installing ${model.name}…`, type: 'info' });
    try {
      await browserInferenceEngine.loadModel(model.task, model.id, {
        // onStatus(phase, msg, pct): show download progress per TRD §7.1
        onStatus: (_phase, msg, pct) => setToast({ msg: pct != null ? `${msg} ${pct}%` : msg, type: 'info' }),
        onPhase: (phase) => setToast({ msg: phase, type: 'info' }),
        onError: (error) => setToast({ msg: error.message, type: 'error' }),
      });
      setInstalledModels((current) => current.some((entry) => entry.id === model.id) ? current : [...current, { ...model, status: 'installed' }]);
      setToast({ msg: `${model.name} installed`, type: 'success' });
    } catch (error) {
      console.error(`Failed to install model ${model.id}`, error);
      const message = error instanceof Error ? error.message : 'Unknown installation error';
      setToast({ msg: `Failed to install ${model.name}: ${message}`, type: 'error' });
    } finally {
      setLoadingModelId((current) => current === model.id ? null : current);
    }
  }

  function deleteModel(id: string) {
    setInstalledModels((current) => current.filter((m) => m.id !== id));
  }

  function handleOmnibarSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = classifyOmnibar(omnibar);
    if (result.intent === 'navigate') {
      const tab: TreeNode = {
        id: createUniqueId(),
        name: result.value.replace(/^https?:\/\//, '').slice(0, NEW_TAB_NAME_LENGTH),
        type: 'tab',
        nodeKind: 'browser',
        url: result.value,
        memoryTier: 'hot',
        memoryMB: DEFAULT_NEW_TAB_MEMORY_MB,
      };
      setRoot((current) => deepUpdate(current, activeWorkspaceId, (node) => {
        const workspace = ensureWorkspaceCategories(node);
        return {
          ...workspace,
          expanded: true,
          children: (workspace.children ?? []).map((child) => child.nodeKind === 'browser'
            ? { ...child, expanded: true, children: [...(child.children ?? []), tab] }
            : child),
        };
      }));
      setOpenTabId(tab.id);
      setActiveSessionMode('agent');
      setToast({ msg: `Opened ${result.value}`, type: 'success' });
    } else {
      setPendingSearch(result.value);
      setToast({ msg: `Queued search: ${result.value}`, type: 'info' });
    }
    setOmnibar('');
  }

  function handleAddFileToWorkspace(kind: WorkspaceFileKind, wsId: string) {
    const nextFile = createWorkspaceFileTemplate(kind, addFileName);
    setWorkspaceFilesByWorkspace((current) => ({
      ...current,
      [wsId]: upsertWorkspaceFile(current[wsId] ?? [], nextFile),
    }));
    setAddFileName('');
    setShowAddFileMenu(null);
    setEditingFilePath(nextFile.path);
    switchWorkspace(wsId);
    setOpenTabId(null);
    setToast({ msg: `Added ${nextFile.path}`, type: 'success' });
  }

  function handleRemoveFileNode(nodeId: string) {
    const node = findNode(root, nodeId);
    if (!node) return;
    const ownerWorkspace = findWorkspaceForNode(root, nodeId);
    if (node.type === 'file' && node.filePath) {
      if (!ownerWorkspace) return;
      setWorkspaceFilesByWorkspace((current) => ({
        ...current,
        [ownerWorkspace.id]: removeWorkspaceFile(current[ownerWorkspace.id] ?? [], node.filePath!),
      }));
      if (editingFilePath === node.filePath) setEditingFilePath(null);
      setToast({ msg: `Removed ${node.filePath}`, type: 'info' });
      return;
    }
    let nextAgentSessionId = activeAgentSessionId;
    let nextTerminalSessionId = activeTerminalSessionId;
    setRoot((current) => {
      const next = removeNodeById(current, nodeId);
      if (activeAgentSessionId === nodeId) {
        const workspace = ownerWorkspace ? getWorkspace(next, ownerWorkspace.id) : getWorkspace(next, activeWorkspaceId);
        nextAgentSessionId = workspace ? findFirstSessionId(workspace, 'agent') : null;
      }
      if (activeTerminalSessionId === nodeId) {
        const workspace = ownerWorkspace ? getWorkspace(next, ownerWorkspace.id) : getWorkspace(next, activeWorkspaceId);
        nextTerminalSessionId = workspace ? findFirstSessionId(workspace, 'terminal') : null;
      }
      return next;
    });
    if (openTabId === nodeId) setOpenTabId(null);
    if (activeAgentSessionId === nodeId) setActiveAgentSessionId(nextAgentSessionId ?? null);
    if (activeTerminalSessionId === nodeId) setActiveTerminalSessionId(nextTerminalSessionId ?? null);
  }

  function handleOpenFileNode(nodeId: string) {
    const node = findNode(root, nodeId);
    if (node?.filePath) {
      setEditingFilePath(node.filePath);
      setOpenTabId(null);
      // Switch to the workspace that owns this file
      const workspace = findWorkspaceForNode(root, nodeId);
      if (workspace) switchWorkspace(workspace.id);
    }
  }

  function handleOpenTreeTab(nodeId: string) {
    const node = findNode(root, nodeId);
    if (!node || node.type !== 'tab') return;
    const workspace = findWorkspaceForNode(root, nodeId);
    if (workspace) switchWorkspace(workspace.id);
    setEditingFilePath(null);
    if ((node.nodeKind ?? 'browser') === 'browser') {
      setOpenTabId(nodeId);
      return;
    }
    setOpenTabId(null);
    if (node.nodeKind === 'agent') {
      setActiveSessionMode('agent');
      setActiveAgentSessionId(nodeId);
      return;
    }
    if (node.nodeKind === 'terminal') {
      setActiveSessionMode('terminal');
      setActiveTerminalSessionId(nodeId);
    }
  }

  function renderSidebar() {
    if (activePanel === 'workspaces') {
      return (
        <div key={`ws-${activeWorkspaceId}`} className={`sidebar-content ${slideDir ? `ws-slide-${slideDir}` : ''}`}>
          <MemBar root={root} />
          <SidebarTree
            root={root}
            workspaceByNodeId={workspaceByNodeId}
            activeWorkspaceId={activeWorkspaceId}
            openTabId={openTabId}
            editingFilePath={editingFilePath}
            cursorId={cursorId}
            selectedIds={selectedIds}
            items={visibleItems}
            onCursorChange={setCursorId}
            onToggleFolder={(id) => {
              setRoot((current) => deepUpdate(current, id, (node) => ({ ...node, expanded: !node.expanded })));
              const toggled = findNode(root, id);
              if (toggled?.type === 'workspace') switchWorkspace(id);
            }}
            onOpenTab={handleOpenTreeTab}
            onCloseTab={handleRemoveFileNode}
            onOpenFile={handleOpenFileNode}
            onAddFile={(wsId) => setShowAddFileMenu(wsId)}
            onAddAgent={(wsId) => addSessionToWorkspace(wsId, 'agent')}
            onAddTerminal={(wsId) => addSessionToWorkspace(wsId, 'terminal')}
          />
        </div>
      );
    }
    if (activePanel === 'history') return <HistoryPanel />;
    if (activePanel === 'extensions') return <ExtensionsPanel workspaceName={activeWorkspace.name} capabilities={activeWorkspaceCapabilities} />;
    if (activePanel === 'settings') return <SettingsPanel registryModels={registryModels} installedModels={installedModels} task={registryTask} loadingModelId={loadingModelId} onTaskChange={setRegistryTask} onSearch={setRegistryQuery} onInstall={installModel} onDelete={deleteModel} />;
    return <section className="panel-scroll"><h2>Account</h2><p className="muted">Account policies and audit trails can live here.</p></section>;
  }

  return (
    <div className="app-shell">
      <nav className="activity-bar" aria-label="Primary navigation">
        <div className="activity-group">
          {PRIMARY_NAV.map(([id, icon, label]) => <button key={id} type="button" className={`activity-button ${activePanel === id ? 'active' : ''}`} onClick={() => { if (id === 'workspaces') { if (activePanel === 'workspaces') openWorkspaceSwitcher(); else { setActivePanel('workspaces'); setCollapsed(false); } return; } setActivePanel(id as typeof activePanel); setCollapsed(false); }} aria-label={label}><Icon name={icon as keyof typeof icons} size={16} color={activePanel === id ? '#7dd3fc' : '#71717a'} /></button>)}
        </div>
        <div className="activity-spacer" />
        <div className="activity-group">
          {SECONDARY_NAV.map(([id, icon, label]) => <button key={id} type="button" className={`activity-button ${activePanel === id ? 'active' : ''}`} onClick={() => { setActivePanel(id as typeof activePanel); setCollapsed(false); }} aria-label={label}><Icon name={icon as keyof typeof icons} size={16} color={activePanel === id ? '#7dd3fc' : '#71717a'} /></button>)}
        </div>
        <button type="button" className="activity-button" onClick={() => setCollapsed((current) => !current)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><Icon name="panelRight" size={16} color="#71717a" /></button>
      </nav>
      {!collapsed ? (
        <aside className="sidebar">
          <header className="sidebar-header">
            <div className="sidebar-title-row">
              <span className="panel-eyebrow">{activePanel === 'settings' ? 'Settings / Models' : activePanel === 'history' ? 'History' : activePanel === 'extensions' ? 'Extensions' : 'Workspaces'}</span>
            </div>
            <form className="omnibar" onSubmit={handleOmnibarSubmit}>
              <Icon name="search" size={13} color="#71717a" />
              <input ref={omnibarRef} aria-label="Omnibar" value={omnibar} onChange={(event) => setOmnibar(event.target.value)} placeholder="Search or navigate…" />
            </form>
            <div className="workspace-toolbar">
              <div className="workspace-command-row">
                <button
                  type="button"
                  className="workspace-toggle-pill"
                  aria-label="Toggle workspace overlay"
                  onClick={openWorkspaceSwitcher}
                  onDoubleClick={() => openRenameWorkspace(activeWorkspaceId)}
                >
                  <span className="workspace-swatch" style={{ background: activeWorkspace.color ?? '#60a5fa' }} />
                  <span className="workspace-toggle-copy">
                    <span className="workspace-toggle-label">Workspace</span>
                    <strong>{activeWorkspace.name}</strong>
                  </span>
                </button>
                <button type="button" className="workspace-hotkey-button" aria-label="Open keyboard shortcuts" onClick={() => setShowShortcuts(true)}>
                  <span>?</span>
                </button>
              </div>
              {treeFilter ? (
                <button type="button" className="workspace-filter-chip" onClick={() => setTreeFilter('')} aria-label="Clear workspace filter">
                  <span>Filtering: {treeFilter}</span>
                  <Icon name="x" size={10} />
                </button>
              ) : (
                <div className="workspace-helper-text">Type to filter • Ctrl+Alt+N new workspace • Double-click pill to rename</div>
              )}
            </div>
          </header>
          {renderSidebar()}
        </aside>
      ) : null}
      <main className="content-area">
        {editingFile ? (
          <FileEditorPanel
            file={editingFile}
            onSave={(nextFile, previousPath) => setWorkspaceFilesByWorkspace((current) => {
              const existing = current[activeWorkspaceId] ?? [];
              const withoutPrevious = previousPath && previousPath !== nextFile.path ? removeWorkspaceFile(existing, previousPath) : existing;
              return { ...current, [activeWorkspaceId]: upsertWorkspaceFile(withoutPrevious, nextFile) };
            })}
            onDelete={(path) => setWorkspaceFilesByWorkspace((current) => ({ ...current, [activeWorkspaceId]: removeWorkspaceFile(current[activeWorkspaceId] ?? [], path) }))}
            onClose={() => setEditingFilePath(null)}
            onToast={setToast}
          />
        ) : openBrowserTab ? (
          <PageOverlay tab={openBrowserTab} onClose={() => setOpenTabId(null)} />
        ) : (
          <ChatPanel
            installedModels={installedModels}
            pendingSearch={pendingSearch}
            onSearchConsumed={() => setPendingSearch(null)}
            onToast={setToast}
            workspaceName={activeWorkspace.name}
            workspaceFiles={activeWorkspaceFiles}
            workspaceCapabilities={activeWorkspaceCapabilities}
            activeAgentSessionId={activeAgentSessionId}
            activeTerminalSessionId={activeTerminalSessionId}
            activeMode={activeSessionMode}
            onSwitchMode={(mode) => {
              setActiveSessionMode(mode);
              setOpenTabId(null);
              if (mode === 'agent' && !activeAgentSessionId) {
                const first = findFirstSessionId(activeWorkspace, 'agent');
                if (first) setActiveAgentSessionId(first);
              }
              if (mode === 'terminal' && !activeTerminalSessionId) {
                const first = findFirstSessionId(activeWorkspace, 'terminal');
                if (first) setActiveTerminalSessionId(first);
              }
            }}
            onNewAgentSession={() => addSessionToWorkspace(activeWorkspaceId, 'agent')}
            onNewTerminalSession={() => addSessionToWorkspace(activeWorkspaceId, 'terminal')}
            onTerminalFsPathsChanged={(sessionId, paths) => setTerminalFsPathsBySession((current) => ({ ...current, [sessionId]: paths }))}
          />
        )}
      </main>
      {showAddFileMenu ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add file"><div className="modal-card compact"><div className="modal-header"><h2>Add file</h2><button type="button" className="icon-button" onClick={() => setShowAddFileMenu(null)}><Icon name="x" /></button></div><div className="add-file-form"><label className="file-editor-field"><span>Name (optional)</span><input aria-label="Capability name" value={addFileName} onChange={(event) => setAddFileName(event.target.value)} placeholder="e.g. review-pr" /></label><div className="add-file-buttons"><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('agents', showAddFileMenu)}>AGENTS.md</button><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('skill', showAddFileMenu)}>Skill</button><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('plugin', showAddFileMenu)}>Plugin</button><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('hook', showAddFileMenu)}>Hook</button></div></div></div></div> : null}
      {showWorkspaces ? <WorkspaceSwitcherOverlay workspaces={root.children ?? []} activeWorkspaceId={activeWorkspaceId} onSwitch={switchWorkspace} onCreateWorkspace={createWorkspace} onRenameWorkspace={openRenameWorkspace} onClose={() => setShowWorkspaces(false)} /> : null}
      {showShortcuts ? <ShortcutOverlay onClose={() => setShowShortcuts(false)} /> : null}
      {renamingWorkspaceId ? <RenameWorkspaceOverlay value={workspaceDraftName} onChange={setWorkspaceDraftName} onSave={saveWorkspaceRename} onClose={() => setRenamingWorkspaceId(null)} /> : null}
      <Toast toast={toast} />
    </div>
  );
}

export default function App() {
  return <AgentBrowserApp />;
}
