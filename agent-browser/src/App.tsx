import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCopilotReadable } from '@copilotkit/react-core';
import {
  ArrowLeft,
  ArrowRight,
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
  User,
  X,
} from 'lucide-react';
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
import type { ChatMessage, HFModel, HistorySession, TreeNode, WorkspaceCapabilities, WorkspaceFile, WorkspaceFileKind } from './types';

type ToastState = { msg: string; type: 'info' | 'success' | 'error' | 'warning' } | null;
type FlatTreeItem = { node: TreeNode; depth: number };

const TIERS = {
  hot: { color: '#f87171', label: 'Hot' },
  warm: { color: '#fbbf24', label: 'Warm' },
  cool: { color: '#60a5fa', label: 'Cool' },
  cold: { color: '#52525b', label: 'Cold' },
} as const;

const TASK_OPTIONS = ['text-generation', 'text-classification', 'question-answering', 'feature-extraction', 'summarization'];
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
} as const;

const mockHistory: HistorySession[] = [
  { id: 1, title: 'Research Session', date: 'Today · 2:15 PM', preview: 'Investigated browser-safe ONNX models', events: ['Opened Hugging Face registry', 'Installed an ONNX model', 'Streamed a local response'] },
  { id: 2, title: 'UX Session', date: 'Yesterday · 4:30 PM', preview: 'Tuned keyboard navigation and overlays', events: ['Moved through workspace tree', 'Opened shortcut overlay', 'Validated page overlay'] },
];

function createUniqueId() {
  return crypto.randomUUID();
}

function createInitialRoot(): TreeNode {
  return {
    id: 'root',
    name: 'Root',
    type: 'root',
    expanded: true,
    children: [
      {
        id: 'ws-research',
        name: 'Research',
        type: 'workspace',
        expanded: true,
        activeMemory: true,
        color: '#60a5fa',
        children: [
          { id: createUniqueId(), name: 'Hugging Face', type: 'tab', url: 'https://huggingface.co/models?library=transformers.js', persisted: true, memoryTier: 'hot', memoryMB: 165 },
          { id: createUniqueId(), name: 'Transformers.js', type: 'tab', url: 'https://huggingface.co/docs/transformers.js', persisted: false, memoryTier: 'warm', memoryMB: 88 },
        ],
      },
      {
        id: 'ws-build',
        name: 'Build',
        type: 'workspace',
        expanded: true,
        activeMemory: true,
        color: '#34d399',
        children: [
          { id: createUniqueId(), name: 'CopilotKit docs', type: 'tab', url: 'https://docs.copilotkit.ai', persisted: false, memoryTier: 'cool', memoryMB: 44 },
        ],
      },
    ],
  };
}

function Icon({ name, size = 16, color = 'currentColor', className = '' }: { name: keyof typeof icons; size?: number; color?: string; className?: string }) {
  const IconComponent: LucideIcon = icons[name];
  return <IconComponent size={size} color={color} className={className} aria-hidden="true" strokeWidth={1.8} />;
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

function flattenTabs(node: TreeNode): TreeNode[] {
  if (node.type === 'tab') return [node];
  return (node.children ?? []).flatMap(flattenTabs);
}

function countTabs(node: TreeNode): number {
  return flattenTabs(node).length;
}

function sumMemory(node: TreeNode): number {
  return flattenTabs(node).reduce((sum, tab) => sum + (tab.memoryMB ?? 0), 0);
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

function MemBar({ root }: { root: TreeNode }) {
  const tabs = flattenTabs(root);
  const total = Math.max(1, tabs.reduce((sum, tab) => sum + (tab.memoryMB ?? 0), 0));
  return (
    <div className="mem-bar" aria-label="Memory distribution">
      {Object.entries(TIERS).map(([tier, meta]) => {
        const memory = tabs.filter((tab) => tab.memoryTier === tier).reduce((sum, tab) => sum + (tab.memoryMB ?? 0), 0);
        return memory ? <div key={tier} style={{ width: `${(memory / total) * 100}%`, background: meta.color }} title={`${meta.label}: ${memory}MB`} /> : null;
      })}
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

function ChatPanel({
  installedModels,
  pendingSearch,
  onSearchConsumed,
  onToast,
  workspaceName,
  workspaceFiles,
  workspaceCapabilities,
}: {
  installedModels: HFModel[];
  pendingSearch: string | null;
  onSearchConsumed: () => void;
  onToast: (toast: Exclude<ToastState, null>) => void;
  workspaceName: string;
  workspaceFiles: WorkspaceFile[];
  workspaceCapabilities: WorkspaceCapabilities;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: createUniqueId(), role: 'system', content: 'Agent browser ready. Local inference is backed by browser-runnable Hugging Face ONNX models.' }]);
  const [input, setInput] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef(messages);
  const workspacePromptContext = useMemo(() => buildWorkspacePromptContext(workspaceFiles), [workspaceFiles]);

  useEffect(() => {
    if (installedModels.length && !selectedModelId) setSelectedModelId(installedModels[0].id);
  }, [installedModels, selectedModelId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function updateMessage(id: string, patch: Partial<ChatMessage>) {
    setMessages((current) => current.map((message) => message.id === id ? { ...message, ...patch } : message));
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const model = installedModels.find((entry) => entry.id === selectedModelId);
    const assistantId = createUniqueId();
    const nextMessages = appendPendingLocalTurn(messagesRef.current, text, { userId: createUniqueId(), assistantId });
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
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
  }, [installedModels, onToast, selectedModelId, workspaceName, workspacePromptContext]);

  useEffect(() => {
    if (!pendingSearch) return;
    void sendMessage(`Search the web for: ${pendingSearch}`);
    onSearchConsumed();
  }, [pendingSearch, onSearchConsumed, sendMessage]);

  return (
    <section className="chat-panel" aria-label="Chat panel">
      <header className="chat-header">
        <div className="chat-heading">
          <span className="panel-eyebrow">Workspace assistant</span>
          <h2>Agent Chat</h2>
          <p>I'm your workspace assistant with access to local models, exploration context, and the capability files stored in {workspaceName}.</p>
        </div>
      </header>
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
            <select aria-label="Installed model" value={selectedModelId} onChange={(event) => setSelectedModelId(event.target.value)}>
              <option value="">Choose an installed model</option>
              {installedModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
            </select>
          </label>
          <button type="submit" className="primary-button accent"><Icon name="send" size={14} color="#07130f" />Send</button>
        </div>
      </form>
    </section>
  );
}

function SettingsPanel({ registryModels, installedModels, task, onTaskChange, onSearch, onInstall }: { registryModels: HFModel[]; installedModels: HFModel[]; task: string; onTaskChange: (task: string) => void; onSearch: (query: string) => void; onInstall: (model: HFModel) => Promise<void> }) {
  return (
    <section className="panel-scroll settings-panel" aria-label="Settings">
      <span className="panel-eyebrow">Settings / Models</span>
      <div className="settings-switcher">
        <button type="button" className="activity-inline-button">Providers</button>
        <button type="button" className="activity-inline-button active">Local</button>
      </div>
      <div className="local-model-controls">
        <input aria-label="Hugging Face search" onChange={(event) => onSearch(event.target.value)} placeholder="Search local model registry" />
        <div className="chip-row">
          {TASK_OPTIONS.map((option) => <button key={option} type="button" className={`chip ${task === option ? 'active' : ''}`} onClick={() => onTaskChange(option)}>{option}</button>)}
        </div>
      </div>
      <div className="panel-section-header">
        <span>Results ({registryModels.length})</span>
        <span className="muted">{installedModels.length} models loaded</span>
      </div>
      <div className="model-section settings-result-list">
        {registryModels.map((model) => (
          <button key={model.id} type="button" className="model-card action" onClick={() => void onInstall(model)}>
            <div className="model-card-icon"><Icon name="layers" size={15} color="#60a5fa" /></div>
            <div className="model-card-body">
              <strong>{model.name}</strong>
              <span className="chip mini">{model.task}</span>
              <p>{model.author}</p>
              <small>{model.downloads.toLocaleString()} downloads · {model.likes.toLocaleString()} likes</small>
            </div>
            <span className="secondary-button">Load</span>
          </button>
        ))}
        {!registryModels.length ? <p className="muted">Search the local Hugging Face ONNX registry to populate the model drawer.</p> : null}
      </div>
      <div className="model-section">
        <h3>Installed models</h3>
        {installedModels.length ? installedModels.map((model) => <div key={model.id} className="model-card installed"><div className="model-card-body"><strong>{model.name}</strong><p>{model.author} · {model.task}</p></div><span className="badge connected">Installed</span></div>) : <p className="muted">No models installed yet.</p>}
      </div>
    </section>
  );
}

function HistoryPanel() {
  return <section className="panel-scroll history-panel" aria-label="History"><span className="panel-eyebrow">History</span><h2>Recent sessions</h2><p className="muted">Pick up where you left off across research, build, and UX investigations.</p>{mockHistory.map((session) => <article key={session.id} className="list-card history-card"><div className="history-card-header"><div><h3>{session.title}</h3><p className="muted">{session.date}</p></div><span className="badge">{session.events.length} events</span></div><p>{session.preview}</p><ul>{session.events.map((entry) => <li key={entry}>{entry}</li>)}</ul></article>)}</section>;
}

function ExtensionsPanel({ workspaceName, capabilities }: { workspaceName: string; capabilities: WorkspaceCapabilities }) {
  return (
    <section className="panel-scroll extensions-panel" aria-label="Extensions">
      <span className="panel-eyebrow">Extensions</span>
      <h2>Workspace plugin manifests</h2>
      <p className="muted">Plugin support is discovered from standards-based manifests stored in the active workspace.</p>
      <div className="integration-overview">
        <div className="list-card integration-summary-card">
          <span className="badge">Active workspace</span>
          <strong>{workspaceName}</strong>
          <p className="muted">{capabilities.plugins.length} plugin manifests · {capabilities.hooks.length} hooks discovered</p>
        </div>
      </div>
      {capabilities.plugins.length ? (
        <div className="integration-list">
          {capabilities.plugins.map((plugin) => (
            <article key={plugin.path} className="list-card extension-card">
              <div className="extension-icon">
                <Icon name="puzzle" color="#f59e0b" />
              </div>
              <div className="extension-content">
                <div className="extension-title-row">
                  <h3>{plugin.directory}</h3>
                  <span className="badge">{plugin.manifestName}</span>
                </div>
                <p>{plugin.path}</p>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="muted">No plugin manifests stored yet. Add one from Exploration to register a plugin bundle in this workspace.</p>}
    </section>
  );
}

function WorkspaceSwitcherOverlay({
  workspaces,
  activeWorkspaceId,
  onSwitch,
  onCreateWorkspace,
  onRenameWorkspace,
  onClose,
}: {
  workspaces: TreeNode[];
  activeWorkspaceId: string;
  onSwitch: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
  onRenameWorkspace: (workspaceId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = workspaces.filter((workspace) => workspace.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Workspace switcher" onClick={onClose}>
      <div className="modal-card workspace-switcher-card">
        <div className="modal-header workspace-switcher-header" onClick={(event) => event.stopPropagation()}>
          <div>
            <span className="panel-eyebrow">Workspace overlay</span>
            <h2>Workspaces</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close workspace switcher"><Icon name="x" /></button>
        </div>
        <div className="workspace-switcher-body" onClick={(event) => event.stopPropagation()}>
          <label className="omnibar workspace-switcher-search">
            <Icon name="search" size={13} color="#71717a" />
            <input aria-label="Search workspaces" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspaces…" />
          </label>
          <div className="workspace-overlay-toolbar">
            <div className="workspace-hero-card">
              <span className="badge">Focused workspace</span>
              <strong>{workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name ?? 'Workspace'}</strong>
              <p className="muted">Use Ctrl+1-9 to jump, Ctrl+Alt+←/→ to cycle, or Ctrl+Alt+N to create a new one.</p>
            </div>
            <button type="button" className="secondary-button" onClick={onCreateWorkspace}>New workspace</button>
          </div>
          <div className="workspace-list">
            {filtered.map((workspace, index) => (
              <div
                key={workspace.id}
                className={`workspace-list-item ${workspace.id === activeWorkspaceId ? 'active' : ''}`}
                onDoubleClick={() => onRenameWorkspace(workspace.id)}
              >
                <button
                  type="button"
                  className="workspace-list-button"
                  onClick={() => {
                    onSwitch(workspace.id);
                    onClose();
                  }}
                >
                  <span className="workspace-swatch" style={{ background: workspace.color ?? '#60a5fa' }} />
                  <span className="workspace-list-copy">
                    <strong>{workspace.name}</strong>
                    <span>{countTabs(workspace)} tabs · {sumMemory(workspace)}MB</span>
                  </span>
                  <span className="workspace-hotkey-chip">{index < 9 ? `Ctrl+${index + 1}` : 'Ctrl+'}</span>
                </button>
              </div>
            ))}
          </div>
          <div className="workspace-switcher-footer">
            <span>Press Esc or click outside to close</span>
            <kbd>?</kbd>
          </div>
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

function SidebarTree({ activeWorkspaceId, openTabId, editingFilePath, cursorId, selectedIds, onCursorChange, onToggleFolder, onOpenTab, onCloseTab, onOpenFile, onAddFile, items }: { activeWorkspaceId: string; openTabId: string | null; editingFilePath: string | null; cursorId: string | null; selectedIds: string[]; onCursorChange: (id: string) => void; onToggleFolder: (id: string) => void; onOpenTab: (id: string) => void; onCloseTab: (id: string) => void; onOpenFile: (id: string) => void; onAddFile: (workspaceId: string) => void; items: FlatTreeItem[] }) {
  return (
    <div className="tree-panel" role="tree" aria-label="Workspace tree">
      {items.map(({ node, depth }) => {
        const isFolder = node.type !== 'tab' && node.type !== 'file';
        const isWorkspace = node.type === 'workspace';
        const isFile = node.type === 'file';
        const isActiveWs = isWorkspace && node.id === activeWorkspaceId;
        const isEditingFile = isFile && node.filePath === editingFilePath;
        const isSelected = selectedIds.includes(node.id);
        return (
          <div key={node.id} role="treeitem" className={`tree-row ${isWorkspace ? 'ws-node' : ''} ${isActiveWs ? 'ws-active' : ''} ${cursorId === node.id ? 'cursor' : ''} ${openTabId === node.id ? 'active' : ''} ${isEditingFile ? 'active' : ''} ${isSelected ? 'selected' : ''} ${isFile ? 'file-node' : ''}`} style={{ paddingLeft: `${depth * 16}px` }}>
            <button type="button" className="tree-button" onFocus={() => onCursorChange(node.id)} onClick={() => isFile ? onOpenFile(node.id) : isFolder ? onToggleFolder(node.id) : onOpenTab(node.id)}>
              {isFile ? <Icon name="file" size={12} color="#a5b4fc" /> : isFolder ? <Icon name={node.expanded ? 'folderOpen' : 'folder'} size={isWorkspace ? 13 : 12} color={node.color ?? '#60a5fa'} /> : <span className="tier-dot" style={{ background: TIERS[node.memoryTier ?? 'cold'].color }} />}
              <span>{node.name}</span>
              {node.type === 'tab' ? <span className="tree-meta">{node.memoryMB ?? 0}MB</span> : null}
              {isWorkspace ? <span className="tree-meta">{countTabs(node)} tabs</span> : null}
            </button>
            {node.type === 'tab' ? <button type="button" className="icon-button subtle" aria-label={`Close ${node.name}`} onClick={() => onCloseTab(node.id)}><Icon name="x" size={12} /></button> : null}
            {isFile ? <button type="button" className="icon-button subtle" aria-label={`Remove ${node.name}`} onClick={() => onCloseTab(node.id)}><Icon name="x" size={12} /></button> : null}
            {isWorkspace ? <button type="button" className="icon-button subtle" aria-label={`Add file to ${node.name}`} onClick={() => onAddFile(node.id)}><Icon name="plus" size={11} /></button> : null}
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
  const [registryTask, setRegistryTask] = useState('text-generation');
  const [registryQuery, setRegistryQuery] = useState('');
  const [registryModels, setRegistryModels] = useState<HFModel[]>([]);
  const [installedModels, setInstalledModels] = useState<HFModel[]>([]);
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

  const activeWorkspace = getWorkspace(root, activeWorkspaceId) ?? root;
  const visibleItems = useMemo(() => flattenTreeFiltered(root, treeFilter), [root, treeFilter]);
  const openTab = openTabId ? findNode(root, openTabId) : null;
  const activeWorkspaceFiles = workspaceFilesByWorkspace[activeWorkspaceId] ?? [];
  const activeWorkspaceCapabilities = useMemo(() => discoverWorkspaceCapabilities(activeWorkspaceFiles), [activeWorkspaceFiles]);
  const editingFile = editingFilePath ? activeWorkspaceFiles.find((f) => f.path === editingFilePath) ?? null : null;

  // Sync workspace files into the tree as 'file' nodes under each workspace
  useEffect(() => {
    setRoot((current) => {
      const workspaces = current.children ?? [];
      const updated = workspaces.map((ws) => {
        const files = workspaceFilesByWorkspace[ws.id] ?? [];
        const nonFileChildren = (ws.children ?? []).filter((c) => c.type !== 'file');
        const fileNodes: TreeNode[] = files.map((f) => ({
          id: `file:${ws.id}:${f.path}`,
          name: f.path.split('/').pop() ?? f.path,
          type: 'file' as const,
          filePath: f.path,
        }));
        return { ...ws, children: [...nonFileChildren, ...fileNodes] };
      });
      return { ...current, children: updated };
    });
  }, [workspaceFilesByWorkspace]);

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
    setRoot((current) => ({
      ...current,
      children: [
        ...(current.children ?? []),
        {
          id: workspaceId,
          name,
          type: 'workspace',
          expanded: true,
          activeMemory: true,
          color: WORKSPACE_COLORS[(current.children ?? []).length % WORKSPACE_COLORS.length],
          children: [],
        },
      ],
    }));
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
        let movedTabs: TreeNode[] = [];
        const children = (current.children ?? []).map((workspace) => {
          const remaining = (workspace.children ?? []).filter((child) => {
            if (tabsToMove.has(child.id)) {
              movedTabs = [...movedTabs, child];
              return false;
            }
            return true;
          });
          return { ...workspace, children: remaining };
        }).map((workspace) => workspace.id === workspaceId ? { ...workspace, expanded: true, children: [...(workspace.children ?? []), ...movedTabs] } : workspace);
        return { ...current, children };
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
      openTab: openTab?.name ?? null,
      installedModels: installedModels.map((model) => ({ id: model.id, task: model.task })),
      tabsInWorkspace: countTabs(activeWorkspace),
      workspaceFiles: activeWorkspaceFiles.map((file) => file.path),
      agentsInstructions: activeWorkspaceCapabilities.agents.map((file) => file.path),
      skills: activeWorkspaceCapabilities.skills.map((skill) => skill.name),
      plugins: activeWorkspaceCapabilities.plugins.map((plugin) => plugin.directory),
      hooks: activeWorkspaceCapabilities.hooks.map((hook) => hook.name),
    },
  }, [activePanel, activeWorkspace, installedModels, openTab, activeWorkspaceCapabilities, activeWorkspaceFiles]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchBrowserModels(registryQuery, registryTask, 12, controller.signal)
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
        const targetWorkspace = currentNode?.type === 'workspace' ? currentNode : currentParent?.type === 'workspace' ? currentParent : getWorkspace(root, activeWorkspaceId);
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
        if (currentNode?.type === 'tab') setOpenTabId(currentNode.id);
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
    setToast({ msg: `Installing ${model.name}…`, type: 'info' });
    await browserInferenceEngine.loadModel(model.task, model.id, {
      onPhase: (phase) => setToast({ msg: phase, type: 'info' }),
      onError: (error) => setToast({ msg: error.message, type: 'error' }),
    });
    setInstalledModels((current) => current.some((entry) => entry.id === model.id) ? current : [...current, { ...model, status: 'installed' }]);
    setToast({ msg: `${model.name} installed`, type: 'success' });
  }

  function handleOmnibarSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = classifyOmnibar(omnibar);
    if (result.intent === 'navigate') {
      const tab: TreeNode = {
        id: createUniqueId(),
        name: result.value.replace(/^https?:\/\//, '').slice(0, NEW_TAB_NAME_LENGTH),
        type: 'tab',
        url: result.value,
        memoryTier: 'hot',
        memoryMB: DEFAULT_NEW_TAB_MEMORY_MB,
      };
      setRoot((current) => deepUpdate(current, activeWorkspaceId, (node) => ({ ...node, expanded: true, children: [...(node.children ?? []), tab] })));
      setOpenTabId(tab.id);
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
    // Find which workspace this file belongs to and remove it
    for (const ws of root.children ?? []) {
      const fileNode = (ws.children ?? []).find((c) => c.id === nodeId && c.type === 'file');
      if (fileNode?.filePath) {
        setWorkspaceFilesByWorkspace((current) => ({
          ...current,
          [ws.id]: removeWorkspaceFile(current[ws.id] ?? [], fileNode.filePath!),
        }));
        if (editingFilePath === fileNode.filePath) setEditingFilePath(null);
        setToast({ msg: `Removed ${fileNode.filePath}`, type: 'info' });
        return;
      }
    }
    // If not a file node, it's a tab - remove from tree
    setRoot((current) => ({ ...current, children: (current.children ?? []).map((ws) => ({ ...ws, children: (ws.children ?? []).filter((child) => child.id !== nodeId) })) }));
    if (openTabId === nodeId) setOpenTabId(null);
  }

  function handleOpenFileNode(nodeId: string) {
    const node = findNode(root, nodeId);
    if (node?.filePath) {
      setEditingFilePath(node.filePath);
      setOpenTabId(null);
      // Switch to the workspace that owns this file
      for (const ws of root.children ?? []) {
        if ((ws.children ?? []).some((c) => c.id === nodeId)) {
          switchWorkspace(ws.id);
          break;
        }
      }
    }
  }

  function renderSidebar() {
    if (activePanel === 'workspaces') {
      return (
        <div key={`ws-${activeWorkspaceId}`} className={`sidebar-content ${slideDir ? `ws-slide-${slideDir}` : ''}`}>
          <MemBar root={root} />
          <SidebarTree activeWorkspaceId={activeWorkspaceId} openTabId={openTabId} editingFilePath={editingFilePath} cursorId={cursorId} selectedIds={selectedIds} items={visibleItems} onCursorChange={setCursorId} onToggleFolder={(id) => { setRoot((current) => deepUpdate(current, id, (node) => ({ ...node, expanded: !node.expanded }))); const toggled = findNode(root, id); if (toggled?.type === 'workspace') switchWorkspace(id); }} onOpenTab={(id) => { setOpenTabId(id); setEditingFilePath(null); for (const ws of root.children ?? []) { if ((ws.children ?? []).some((c) => c.id === id)) { switchWorkspace(ws.id); break; } } }} onCloseTab={handleRemoveFileNode} onOpenFile={handleOpenFileNode} onAddFile={(wsId) => setShowAddFileMenu(wsId)} />
        </div>
      );
    }
    if (activePanel === 'history') return <HistoryPanel />;
    if (activePanel === 'extensions') return <ExtensionsPanel workspaceName={activeWorkspace.name} capabilities={activeWorkspaceCapabilities} />;
    if (activePanel === 'settings') return <SettingsPanel registryModels={registryModels} installedModels={installedModels} task={registryTask} onTaskChange={setRegistryTask} onSearch={setRegistryQuery} onInstall={installModel} />;
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
      <main className="content-area">{editingFile ? <FileEditorPanel file={editingFile} onSave={(nextFile, previousPath) => setWorkspaceFilesByWorkspace((current) => { const existing = current[activeWorkspaceId] ?? []; const withoutPrevious = previousPath && previousPath !== nextFile.path ? removeWorkspaceFile(existing, previousPath) : existing; return { ...current, [activeWorkspaceId]: upsertWorkspaceFile(withoutPrevious, nextFile) }; })} onDelete={(path) => setWorkspaceFilesByWorkspace((current) => ({ ...current, [activeWorkspaceId]: removeWorkspaceFile(current[activeWorkspaceId] ?? [], path) }))} onClose={() => setEditingFilePath(null)} onToast={setToast} /> : openTab ? <PageOverlay tab={openTab} onClose={() => setOpenTabId(null)} /> : <ChatPanel installedModels={installedModels} pendingSearch={pendingSearch} onSearchConsumed={() => setPendingSearch(null)} onToast={setToast} workspaceName={activeWorkspace.name} workspaceFiles={activeWorkspaceFiles} workspaceCapabilities={activeWorkspaceCapabilities} />}</main>
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
