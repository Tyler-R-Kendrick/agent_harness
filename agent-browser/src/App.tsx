import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Cpu,
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
import { createCopilotBridgeSnapshot, toAiSdkMessages, toChatSdkTranscript } from './services/chatComposition';
import type { ChatMessage, Extension, HFModel, HistorySession, TreeNode } from './types';

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

const mockExtensions: Extension[] = [
  { id: 1, name: 'uBlock Origin', author: 'Raymond Hill', rating: 4.9, users: '10M+', category: 'Privacy', description: 'Efficient network filtering.', enabled: true, color: '#f87171' },
  { id: 2, name: 'React DevTools', author: 'Meta', rating: 4.8, users: '5M+', category: 'Dev Tools', description: 'Inspect component trees.', enabled: true, color: '#60a5fa' },
  { id: 3, name: 'Agent Notes', author: 'Agent Labs', rating: 4.5, users: '120K+', category: 'AI', description: 'Capture task notes inside the workspace.', enabled: false, color: '#a78bfa' },
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

function flattenTree(node: TreeNode, depth = 0): FlatTreeItem[] {
  return (node.children ?? []).flatMap((child) => [{ node: child, depth }, ...(child.expanded && child.children ? flattenTree(child, depth + 1) : [])]);
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

function classifyOmnibar(raw: string): { intent: 'navigate' | 'search'; value: string } {
  const value = raw.trim();
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value)) return { intent: 'navigate', value };
  if (/^localhost(:\d+)?(\/.*)?$/.test(value)) return { intent: 'navigate', value: `http://${value}` };
  if (/^([\w-]+\.)+[a-zA-Z]{2,}(\/.*)?$/.test(value)) return { intent: 'navigate', value: `https://${value}` };
  return { intent: 'search', value };
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
        <button type="button" className="icon-button"><Icon name="arrowLeft" /></button>
        <button type="button" className="icon-button"><Icon name="arrowRight" /></button>
        <button type="button" className="icon-button"><Icon name="refresh" /></button>
        <label className="address-bar"><Icon name="globe" size={12} color="#71717a" /><input aria-label="Address" value={address} onChange={(event) => setAddress(event.target.value)} /></label>
        <button type="button" className={`icon-button ${showInspector ? 'active' : ''}`} onClick={() => setShowInspector((current) => !current)}><Icon name="cpu" /></button>
        <button type="button" className={`icon-button ${showChat ? 'active' : ''}`} onClick={() => setShowChat((current) => !current)}><Icon name="messageSquare" /></button>
        <button type="button" className="icon-button" onClick={onClose}><Icon name="x" /></button>
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

function ChatPanel({ installedModels, pendingSearch, onSearchConsumed, onToast }: { installedModels: HFModel[]; pendingSearch: string | null; onSearchConsumed: () => void; onToast: (toast: Exclude<ToastState, null>) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: createUniqueId(), role: 'system', content: 'Agent browser ready. Local inference is backed by browser-runnable Hugging Face ONNX models.' }]);
  const [input, setInput] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (installedModels.length && !selectedModelId) setSelectedModelId(installedModels[0].id);
  }, [installedModels, selectedModelId]);

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
    const nextMessages: ChatMessage[] = [...messages, { id: createUniqueId(), role: 'user', content: text }, { id: assistantId, role: 'assistant', content: '', status: 'thinking' }];
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
          onDone: () => updateMessage(assistantId, { status: 'complete', streamedContent: tokenBuffer.trim(), loadingStatus: null }),
          onError: (error) => updateMessage(assistantId, { status: 'error', content: error.message, loadingStatus: null }),
        },
      );
    } catch (error) {
      onToast({ msg: error instanceof Error ? error.message : 'Local inference failed', type: 'error' });
    }
  }, [installedModels, messages, onToast, selectedModelId]);

  useEffect(() => {
    if (!pendingSearch) return;
    void sendMessage(`Search the web for: ${pendingSearch}`);
    onSearchConsumed();
  }, [pendingSearch, onSearchConsumed, sendMessage]);

  return (
    <section className="chat-panel" aria-label="Chat panel">
      <header className="chat-header">
        <div>
          <h2>Agent Chat</h2>
          <p>Composed with AI SDK message shapes and a local browser inference engine.</p>
        </div>
        <label>
          <span className="sr-only">Installed model</span>
          <select aria-label="Installed model" value={selectedModelId} onChange={(event) => setSelectedModelId(event.target.value)}>
            <option value="">Choose an installed model</option>
            {installedModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
          </select>
        </label>
      </header>
      <div className="message-list" role="log" aria-live="polite">
        {messages.map((message) => <ChatMessageView key={message.id} message={message} />)}
        <div ref={bottomRef} />
      </div>
      <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); void sendMessage(input); }}>
        <textarea aria-label="Chat input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask the local ONNX model…" rows={2} />
        <button type="submit" className="primary-button"><Icon name="send" size={14} color="#fff" />Send</button>
      </form>
    </section>
  );
}

function SettingsPanel({ registryModels, installedModels, task, onTaskChange, onSearch, onInstall }: { registryModels: HFModel[]; installedModels: HFModel[]; task: string; onTaskChange: (task: string) => void; onSearch: (query: string) => void; onInstall: (model: HFModel) => Promise<void> }) {
  return (
    <section className="panel-scroll" aria-label="Settings">
      <h2>Browser model registry</h2>
      <p className="muted">Only ONNX-optimized models from the Hugging Face registry that can run in-browser are shown here.</p>
      <div className="local-model-controls">
        <input aria-label="Hugging Face search" onChange={(event) => onSearch(event.target.value)} placeholder="Search Hugging Face ONNX registry" />
        <div className="chip-row">
          {TASK_OPTIONS.map((option) => <button key={option} type="button" className={`chip ${task === option ? 'active' : ''}`} onClick={() => onTaskChange(option)}>{option}</button>)}
        </div>
      </div>
      <div className="model-section">
        <h3>Installed models</h3>
        {installedModels.length ? installedModels.map((model) => <div key={model.id} className="model-card"><div><strong>{model.name}</strong><p>{model.author} · {model.task}</p></div><span className="badge connected">Installed</span></div>) : <p className="muted">No models installed yet.</p>}
      </div>
      <div className="model-section">
        <h3>Registry results</h3>
        {registryModels.map((model) => (
          <button key={model.id} type="button" className="model-card action" onClick={() => void onInstall(model)}>
            <div>
              <strong>{model.name}</strong>
              <p>{model.author} · {model.task}</p>
            </div>
            <span>{model.downloads.toLocaleString()} downloads</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function HistoryPanel() {
  return <section className="panel-scroll" aria-label="History"><h2>Session history</h2>{mockHistory.map((session) => <article key={session.id} className="list-card"><h3>{session.title}</h3><p className="muted">{session.date}</p><p>{session.preview}</p><ul>{session.events.map((entry) => <li key={entry}>{entry}</li>)}</ul></article>)}</section>;
}

function ExtensionsPanel({ extensions, onToggle }: { extensions: Extension[]; onToggle: (id: number) => void }) {
  return <section className="panel-scroll" aria-label="Extensions"><h2>Extensions</h2>{extensions.map((extension) => <article key={extension.id} className="list-card extension-card"><div className="extension-icon" style={{ background: `${extension.color}22` }}><Icon name="puzzle" color={extension.color} /></div><div><h3>{extension.name}</h3><p className="muted">{extension.author} · {extension.rating}★ · {extension.users}</p><p>{extension.description}</p></div><label className="switch"><input type="checkbox" aria-label={`Enable ${extension.name}`} checked={extension.enabled} onChange={() => onToggle(extension.id)} /><span /></label></article>)}</section>;
}

function SidebarTree({ root, activeWorkspaceId, openTabId, cursorId, onCursorChange, onToggleFolder, onOpenTab, onCloseTab }: { root: TreeNode; activeWorkspaceId: string; openTabId: string | null; cursorId: string | null; onCursorChange: (id: string) => void; onToggleFolder: (id: string) => void; onOpenTab: (id: string) => void; onCloseTab: (id: string) => void }) {
  const items = flattenTree(getWorkspace(root, activeWorkspaceId) ?? root);
  return (
    <div className="tree-panel">
      {items.map(({ node, depth }) => {
        const isFolder = node.type !== 'tab';
        return (
          <div key={node.id} className={`tree-row ${cursorId === node.id ? 'cursor' : ''} ${openTabId === node.id ? 'active' : ''}`} style={{ paddingLeft: `${12 + depth * 18}px` }}>
            <button type="button" className="tree-button" onFocus={() => onCursorChange(node.id)} onClick={() => isFolder ? onToggleFolder(node.id) : onOpenTab(node.id)}>
              {isFolder ? <Icon name={node.expanded ? 'folderOpen' : 'folder'} size={14} color={node.color ?? '#60a5fa'} /> : <span className="tier-dot" style={{ background: TIERS[node.memoryTier ?? 'cold'].color }} />}
              <span>{node.name}</span>
              <span className="tree-meta">{node.type === 'tab' ? `${node.memoryMB ?? 0}MB` : `${countTabs(node)} tabs`}</span>
            </button>
            {node.type === 'tab' ? <button type="button" className="icon-button subtle" onClick={() => onCloseTab(node.id)}><Icon name="x" size={12} /></button> : null}
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
  const [root, setRoot] = useState<TreeNode>(createInitialRoot());
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('ws-research');
  const [activePanel, setActivePanel] = useState<'workspaces' | 'chat' | 'history' | 'extensions' | 'settings' | 'account'>('workspaces');
  const [collapsed, setCollapsed] = useState(false);
  const [registryTask, setRegistryTask] = useState('text-generation');
  const [registryModels, setRegistryModels] = useState<HFModel[]>([]);
  const [installedModels, setInstalledModels] = useState<HFModel[]>([]);
  const [omnibar, setOmnibar] = useState('');
  const [openTabId, setOpenTabId] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [pendingSearch, setPendingSearch] = useState<string | null>(null);
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [extensions, setExtensions] = useState(mockExtensions);

  const activeWorkspace = getWorkspace(root, activeWorkspaceId) ?? root;
  const visibleItems = useMemo(() => flattenTree(activeWorkspace), [activeWorkspace]);
  const openTab = openTabId ? findNode(root, openTabId) : null;

  useEffect(() => {
    void searchBrowserModels('', registryTask).then(setRegistryModels).catch((error) => setToast({ msg: error instanceof Error ? error.message : 'Registry search failed', type: 'error' }));
  }, [registryTask]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '?') { setShowShortcuts(true); return; }
      if (activePanel !== 'workspaces') return;
      const index = visibleItems.findIndex((item) => item.node.id === cursorId);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = visibleItems[Math.min(visibleItems.length - 1, Math.max(0, index + 1))];
        if (next) setCursorId(next.node.id);
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prev = visibleItems[Math.max(0, index - 1)];
        if (prev) setCursorId(prev.node.id);
      }
      if (event.key === 'ArrowRight' && cursorId) {
        const node = findNode(root, cursorId);
        if (node && node.type !== 'tab' && !node.expanded) setRoot((current) => deepUpdate(current, node.id, (entry) => ({ ...entry, expanded: true })));
      }
      if (event.key === 'ArrowLeft' && cursorId) {
        const node = findNode(root, cursorId);
        if (node && node.type !== 'tab' && node.expanded) setRoot((current) => deepUpdate(current, node.id, (entry) => ({ ...entry, expanded: false })));
      }
      if (event.key === 'Enter' && cursorId) {
        const node = findNode(root, cursorId);
        if (node?.type === 'tab') setOpenTabId(node.id);
      }
      if (event.key === 'Escape') setShowShortcuts(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePanel, cursorId, root, visibleItems]);

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
      setActivePanel('chat');
      setToast({ msg: `Queued search: ${result.value}`, type: 'info' });
    }
    setOmnibar('');
  }

  function renderSidebar() {
    if (activePanel === 'workspaces') {
      return (
        <div className="sidebar-content">
          <MemBar root={activeWorkspace} />
          <SidebarTree root={root} activeWorkspaceId={activeWorkspaceId} openTabId={openTabId} cursorId={cursorId} onCursorChange={setCursorId} onToggleFolder={(id) => setRoot((current) => deepUpdate(current, id, (node) => ({ ...node, expanded: !node.expanded })))} onOpenTab={setOpenTabId} onCloseTab={(id) => {
            setRoot((current) => deepUpdate(current, activeWorkspaceId, (node) => ({ ...node, children: (node.children ?? []).filter((child) => child.id !== id) })));
            if (openTabId === id) setOpenTabId(null);
          }} />
        </div>
      );
    }
    if (activePanel === 'chat') return <ChatPanel installedModels={installedModels} pendingSearch={pendingSearch} onSearchConsumed={() => setPendingSearch(null)} onToast={setToast} />;
    if (activePanel === 'history') return <HistoryPanel />;
    if (activePanel === 'extensions') return <ExtensionsPanel extensions={extensions} onToggle={(id) => setExtensions((current) => current.map((entry) => entry.id === id ? { ...entry, enabled: !entry.enabled } : entry))} />;
    if (activePanel === 'settings') return <SettingsPanel registryModels={registryModels} installedModels={installedModels} task={registryTask} onTaskChange={setRegistryTask} onSearch={(query) => { void searchBrowserModels(query, registryTask).then(setRegistryModels).catch((error) => setToast({ msg: error instanceof Error ? error.message : 'Registry search failed', type: 'error' })); }} onInstall={installModel} />;
    return <section className="panel-scroll"><h2>Account</h2><p className="muted">Account policies and audit trails can live here.</p></section>;
  }

  return (
    <div className="app-shell">
      <nav className="activity-bar" aria-label="Primary navigation">
        {[
          ['workspaces', 'layers', 'Workspaces'],
          ['chat', 'messageSquare', 'Chat'],
          ['history', 'clock', 'History'],
          ['extensions', 'puzzle', 'Extensions'],
          ['settings', 'settings', 'Settings'],
          ['account', 'user', 'Account'],
        ].map(([id, icon, label]) => <button key={id} type="button" className={`activity-button ${activePanel === id ? 'active' : ''}`} onClick={() => { setActivePanel(id as typeof activePanel); setCollapsed(false); }} aria-label={label}><Icon name={icon as keyof typeof icons} size={16} color={activePanel === id ? '#60a5fa' : '#71717a'} /></button>)}
        <button type="button" className="activity-button" onClick={() => setCollapsed((current) => !current)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><Icon name="panelRight" size={16} color="#71717a" /></button>
      </nav>
      {!collapsed ? (
        <aside className="sidebar">
          <header className="sidebar-header">
            <form className="omnibar" onSubmit={handleOmnibarSubmit}>
              <Icon name="search" size={13} color="#71717a" />
              <input aria-label="Omnibar" value={omnibar} onChange={(event) => setOmnibar(event.target.value)} placeholder="Search or navigate…" />
            </form>
            <div className="workspace-pills">
              {(root.children ?? []).map((workspace) => <button key={workspace.id} type="button" className={`workspace-pill ${activeWorkspaceId === workspace.id ? 'active' : ''}`} onClick={() => setActiveWorkspaceId(workspace.id)}>{workspace.name}</button>)}
              <button type="button" className="workspace-pill add" onClick={() => setShowWorkspaces(true)}><Icon name="plus" size={10} /></button>
            </div>
          </header>
          {renderSidebar()}
        </aside>
      ) : null}
      <main className="content-area">{openTab ? <PageOverlay tab={openTab} onClose={() => setOpenTabId(null)} /> : <ChatPanel installedModels={installedModels} pendingSearch={pendingSearch} onSearchConsumed={() => setPendingSearch(null)} onToast={setToast} />}</main>
      {showWorkspaces ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Workspace switcher"><div className="modal-card"><div className="modal-header"><h2>Workspaces</h2><button type="button" className="icon-button" onClick={() => setShowWorkspaces(false)}><Icon name="x" /></button></div><div className="workspace-grid">{(root.children ?? []).map((workspace) => <button key={workspace.id} type="button" className="workspace-tile" onClick={() => { setActiveWorkspaceId(workspace.id); setShowWorkspaces(false); }}><span className="workspace-swatch" style={{ background: workspace.color ?? '#60a5fa' }} /><strong>{workspace.name}</strong><span>{countTabs(workspace)} tabs · {sumMemory(workspace)}MB</span></button>)}</div></div></div> : null}
      {showShortcuts ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><div className="modal-card compact"><div className="modal-header"><h2>Keyboard shortcuts</h2><button type="button" className="icon-button" onClick={() => setShowShortcuts(false)}><Icon name="x" /></button></div><ul className="shortcut-list"><li><kbd>↑ / ↓</kbd><span>Move through the tree</span></li><li><kbd>→ / ←</kbd><span>Expand or collapse folders</span></li><li><kbd>Enter</kbd><span>Open the selected tab</span></li><li><kbd>?</kbd><span>Open this overlay</span></li></ul></div></div> : null}
      <Toast toast={toast} />
    </div>
  );
}

export default function App() {
  return <AgentBrowserApp />;
}
