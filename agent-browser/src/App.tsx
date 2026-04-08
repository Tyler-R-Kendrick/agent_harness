import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCopilotReadable } from '@copilotkit/react-core';
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
import { formatBrowserInferenceResult } from './services/browserInferenceRuntime';
import { appendPendingLocalTurn, createCopilotBridgeSnapshot, toAiSdkMessages, toChatSdkTranscript } from './services/chatComposition';
import type { ChatMessage, HFModel, HistorySession, IntegrationSurface, TreeNode } from './types';

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
const WORKSPACE_INTEGRATIONS_STORAGE_KEY = 'agent-browser.workspace-integrations';
const PRIMARY_NAV = [
  ['workspaces', 'layers', 'Exploration'],
  ['history', 'clock', 'History'],
  ['extensions', 'puzzle', 'Extensions'],
] as const;
const SECONDARY_NAV = [
  ['settings', 'settings', 'Settings'],
  ['account', 'user', 'Account'],
] as const;

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

const mockIntegrations: IntegrationSurface[] = [
  {
    id: 'agents-md',
    name: 'AGENTS.md',
    kind: 'agents',
    source: 'Workspace instructions',
    description: 'Load repository-scoped AGENTS.md files so the harness can inherit task guidance, safety notes, and delegation hints.',
    enabled: true,
    color: '#60a5fa',
    badges: ['Repository rules', 'Nested overrides'],
  },
  {
    id: 'agent-skills',
    name: 'agent-skills',
    kind: 'skills',
    source: 'Reusable skill packs',
    description: 'Expose skill bundles as first-class harness capabilities so agents can discover and invoke curated workflows.',
    enabled: true,
    color: '#a78bfa',
    badges: ['Task routing', 'Reusable prompts'],
  },
  {
    id: 'plugins',
    name: 'Plugins',
    kind: 'plugins',
    source: 'Manifest + registry ingestion',
    description: 'Accept direct plugin manifests and the marketplace.json catalog format for plugin discovery, enablement, and metadata.',
    enabled: true,
    color: '#f59e0b',
    badges: ['marketplace.json', 'Plugin manifests'],
  },
  {
    id: 'hooks',
    name: 'Hooks',
    kind: 'hooks',
    source: 'Lifecycle automation',
    description: 'Register pre-task, post-task, and validation hooks so harness automation can wrap execution without changing core flows.',
    enabled: false,
    color: '#34d399',
    badges: ['Pre-task', 'Post-task'],
  },
  {
    id: 'remote-mcps',
    name: 'Remote MCPs',
    kind: 'mcps',
    source: 'Remote connections only',
    description: 'Allow MCP servers over remote transports while intentionally rejecting local stdio-style MCP wiring in the harness.',
    enabled: true,
    color: '#f87171',
    badges: ['Remote only', 'HTTP / SSE'],
    constraint: 'Local MCP transports are blocked by policy.',
  },
];

function cloneIntegrations(integrations = mockIntegrations): IntegrationSurface[] {
  return integrations.map((integration) => ({ ...integration, badges: [...integration.badges] }));
}

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

function createDefaultWorkspaceIntegrations(root: TreeNode): Record<string, IntegrationSurface[]> {
  return Object.fromEntries((root.children ?? []).map((workspace) => [workspace.id, cloneIntegrations()]));
}

function isStoredIntegration(value: unknown): value is Partial<IntegrationSurface> & { id: string } {
  return Boolean(value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string');
}

function sanitizeBadges(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.filter((badge: unknown): badge is string => typeof badge === 'string') : fallback;
}

function loadWorkspaceIntegrations(root: TreeNode): Record<string, IntegrationSurface[]> {
  const fallback = createDefaultWorkspaceIntegrations(root);
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(WORKSPACE_INTEGRATIONS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return Object.fromEntries(Object.entries(fallback).map(([workspaceId, defaults]) => {
      const storedItems = Array.isArray(parsed?.[workspaceId]) ? parsed[workspaceId] : [];
      return [workspaceId, defaults.map((integration) => {
        const stored = storedItems.find((item) => isStoredIntegration(item) && item.id === integration.id);
        return stored
          ? {
              ...integration,
              enabled: typeof stored.enabled === 'boolean' ? stored.enabled : integration.enabled,
              badges: sanitizeBadges(stored.badges, integration.badges),
              description: typeof stored.description === 'string' ? stored.description : integration.description,
              source: typeof stored.source === 'string' ? stored.source : integration.source,
              constraint: typeof stored.constraint === 'string' ? stored.constraint : integration.constraint,
            }
          : { ...integration, badges: [...integration.badges] };
      })];
    }));
  } catch {
    return fallback;
  }
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

function WorkspaceStoragePanel({ workspaceName, integrations, onToggle }: { workspaceName: string; integrations: IntegrationSurface[]; onToggle: (id: string) => void }) {
  const enabledCount = integrations.filter((integration) => integration.enabled).length;
  return (
    <section className="workspace-storage" aria-label="Workspace storage">
      <div className="panel-section-header">
        <span>Workspace storage</span>
        <span className="muted">Persisted in local storage</span>
      </div>
      <div className="integration-overview">
        <div className="list-card integration-summary-card">
          <span className="badge">Active workspace</span>
          <strong>{workspaceName}</strong>
          <p className="muted">{enabledCount} enabled · {integrations.length} stored support records</p>
        </div>
        <div className="list-card integration-summary-card">
          <span className="badge">Persistence</span>
          <strong>Browser local storage</strong>
          <p className="muted">AGENTS.md, skills, plugins, hooks, and remote MCP settings are stored under this browser profile.</p>
        </div>
      </div>
      <div className="integration-list">
        {integrations.map((integration) => (
          <article key={integration.id} className="list-card extension-card">
            <div className="extension-icon" style={{ background: `linear-gradient(135deg, ${integration.color}33, rgba(15,23,42,.5))` }}>
              <Icon name="puzzle" color={integration.color} />
            </div>
            <div className="extension-content">
              <div className="extension-title-row">
                <h3>{integration.name}</h3>
                <span className="badge">{integration.source}</span>
              </div>
              <div className="extension-badges">
                {integration.badges.map((badge) => <span key={badge} className="chip mini">{badge}</span>)}
              </div>
              <p>{integration.description}</p>
              {integration.constraint ? <p className="muted">{integration.constraint}</p> : null}
            </div>
            <label className="switch">
              <input type="checkbox" aria-label={`Enable ${integration.name}`} checked={integration.enabled} onChange={() => onToggle(integration.id)} />
              <span />
            </label>
          </article>
        ))}
      </div>
    </section>
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

function ChatPanel({ installedModels, pendingSearch, onSearchConsumed, onToast }: { installedModels: HFModel[]; pendingSearch: string | null; onSearchConsumed: () => void; onToast: (toast: Exclude<ToastState, null>) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: createUniqueId(), role: 'system', content: 'Agent browser ready. Local inference is backed by browser-runnable Hugging Face ONNX models.' }]);
  const [input, setInput] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef(messages);

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
  }, [installedModels, onToast, selectedModelId]);

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
          <p>I'm your workspace assistant with access to MCP apps, local models, and exploration context.</p>
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
      <div className="context-strip">Context: {installedModels.length} active local models · {messages.length} chat messages · {pendingSearch ? 'web search queued' : 'workspace ready'}</div>
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

function ExtensionsPanel({ workspaceName }: { workspaceName: string }) {
  return (
    <section className="panel-scroll extensions-panel" aria-label="Extensions">
      <span className="panel-eyebrow">Extensions</span>
      <h2>Extension marketplace</h2>
      <p className="muted">Workspace-scoped harness support now lives in Exploration so it can be stored with the active workspace.</p>
      <div className="integration-overview">
        <div className="list-card integration-summary-card">
          <span className="badge">Moved</span>
          <strong>Workspace-local support</strong>
          <p className="muted">Open Exploration to manage AGENTS.md, agent-skills, plugins, hooks, and remote-only MCP settings for {workspaceName}.</p>
        </div>
      </div>
    </section>
  );
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
  const [root, setRoot] = useState<TreeNode>(() => createInitialRoot());
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('ws-research');
  const [activePanel, setActivePanel] = useState<'workspaces' | 'history' | 'extensions' | 'settings' | 'account'>('workspaces');
  const [collapsed, setCollapsed] = useState(false);
  const [registryTask, setRegistryTask] = useState('text-generation');
  const [registryQuery, setRegistryQuery] = useState('');
  const [registryModels, setRegistryModels] = useState<HFModel[]>([]);
  const [installedModels, setInstalledModels] = useState<HFModel[]>([]);
  const [omnibar, setOmnibar] = useState('');
  const [openTabId, setOpenTabId] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [pendingSearch, setPendingSearch] = useState<string | null>(null);
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [workspaceIntegrations, setWorkspaceIntegrations] = useState<Record<string, IntegrationSurface[]>>(() => loadWorkspaceIntegrations(root));

  const activeWorkspace = getWorkspace(root, activeWorkspaceId) ?? root;
  const visibleItems = useMemo(() => flattenTree(activeWorkspace), [activeWorkspace]);
  const openTab = openTabId ? findNode(root, openTabId) : null;
  const activeWorkspaceIntegrations = workspaceIntegrations[activeWorkspaceId] ?? cloneIntegrations();

  useCopilotReadable({
    description: 'Current agent browser workspace context',
    value: {
      activePanel,
      activeWorkspace: activeWorkspace.name,
      openTab: openTab?.name ?? null,
      installedModels: installedModels.map((model) => ({ id: model.id, task: model.task })),
      tabsInWorkspace: countTabs(activeWorkspace),
    },
  }, [activePanel, activeWorkspace, installedModels, openTab]);

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
      window.localStorage.setItem(WORKSPACE_INTEGRATIONS_STORAGE_KEY, JSON.stringify(workspaceIntegrations));
    }, 120);
    return () => window.clearTimeout(timer);
  }, [workspaceIntegrations]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setShowShortcuts(false); return; }
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
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
      setToast({ msg: `Queued search: ${result.value}`, type: 'info' });
    }
    setOmnibar('');
  }

  function renderSidebar() {
    if (activePanel === 'workspaces') {
      return (
        <div className="sidebar-content">
          <div className="explore-hero">
            <span className="panel-eyebrow">Exploration</span>
            <h2>Workspace graph</h2>
            <p className="muted">Browse directories, pinned tabs, and active memory from a single exploration surface.</p>
          </div>
          <MemBar root={activeWorkspace} />
          <SidebarTree root={root} activeWorkspaceId={activeWorkspaceId} openTabId={openTabId} cursorId={cursorId} onCursorChange={setCursorId} onToggleFolder={(id) => setRoot((current) => deepUpdate(current, id, (node) => ({ ...node, expanded: !node.expanded })))} onOpenTab={setOpenTabId} onCloseTab={(id) => {
            setRoot((current) => deepUpdate(current, activeWorkspaceId, (node) => ({ ...node, children: (node.children ?? []).filter((child) => child.id !== id) })));
            if (openTabId === id) setOpenTabId(null);
          }} />
          <WorkspaceStoragePanel
            workspaceName={activeWorkspace.name}
            integrations={activeWorkspaceIntegrations}
            onToggle={(id) => setWorkspaceIntegrations((current) => ({
              ...current,
              [activeWorkspaceId]: (current[activeWorkspaceId] ?? cloneIntegrations()).map((entry) => entry.id === id ? { ...entry, enabled: !entry.enabled } : entry),
            }))}
          />
        </div>
      );
    }
    if (activePanel === 'history') return <HistoryPanel />;
    if (activePanel === 'extensions') return <ExtensionsPanel workspaceName={activeWorkspace.name} />;
    if (activePanel === 'settings') return <SettingsPanel registryModels={registryModels} installedModels={installedModels} task={registryTask} onTaskChange={setRegistryTask} onSearch={setRegistryQuery} onInstall={installModel} />;
    return <section className="panel-scroll"><h2>Account</h2><p className="muted">Account policies and audit trails can live here.</p></section>;
  }

  return (
    <div className="app-shell">
      <nav className="activity-bar" aria-label="Primary navigation">
        <div className="activity-group">
          {PRIMARY_NAV.map(([id, icon, label]) => <button key={id} type="button" className={`activity-button ${activePanel === id ? 'active' : ''}`} onClick={() => { setActivePanel(id as typeof activePanel); setCollapsed(false); }} aria-label={label}><Icon name={icon as keyof typeof icons} size={16} color={activePanel === id ? '#7dd3fc' : '#71717a'} /></button>)}
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
              <span className="panel-eyebrow">{activePanel === 'settings' ? 'Settings / Models' : activePanel === 'history' ? 'History' : activePanel === 'extensions' ? 'Extensions' : 'Exploration'}</span>
            </div>
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
