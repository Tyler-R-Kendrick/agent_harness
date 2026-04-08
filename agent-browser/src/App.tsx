import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { API_ENDPOINTS, MODEL_PROVIDERS } from './constants/providers';
import { HF_TASKS, SEED_MODELS } from './constants/models';
import type { ChatMessage, Extension, HistorySession, HFModel, ModelProvider, TreeNode } from './types';

type ToastState = { msg: string; type: 'info' | 'success' | 'error' | 'warning' } | null;
type FlatTreeItem = { node: TreeNode; depth: number; parentId: string | null };

type TjsCallbacks = {
  onStatus?: (msg: string) => void;
  onPhase?: (phase: string) => void;
  onToken?: (token: string) => void;
  onDone?: (result: unknown) => void;
  onError?: (error: Error) => void;
};

const TIERS = {
  hot: { color: '#f87171', label: 'Hot' },
  warm: { color: '#fbbf24', label: 'Warm' },
  cool: { color: '#60a5fa', label: 'Cool' },
  cold: { color: '#52525b', label: 'Cold' },
} as const;

const iconPaths = {
  layers: 'M12 2 2 7l10 5 10-5-10-5Zm0 10L2 7m10 5 10-5M2 17l10 5 10-5',
  messageSquare: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z',
  clock: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 4v6l4 2',
  puzzle: 'M19.4 13a1.4 1.4 0 0 0-1.4 1.4V17h-3v-2.6A1.4 1.4 0 0 0 13.6 13H11V9.4A1.4 1.4 0 0 0 9.6 8H7V5h3.6A1.4 1.4 0 0 0 12 3.6 1.6 1.6 0 1 1 15.2 4a1.4 1.4 0 0 0 1.4 1H20v3.4A1.4 1.4 0 0 0 21.4 10a1.6 1.6 0 1 1 0 3 1.4 1.4 0 0 0-1.4 0Z',
  settings: 'M12 8.5A3.5 3.5 0 1 0 15.5 12 3.5 3.5 0 0 0 12 8.5Zm7.4 3.5a7.6 7.6 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a7.3 7.3 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.3 7.3 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.3 7.3 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  panelRight: 'M3 3h18v18H3zM15 3v18',
  search: 'm21 21-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z',
  chevron: 'm9 18 6-6-6-6',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
  folderOpen: 'M3 7h18l-2 10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
  x: 'M18 6 6 18M6 6l12 12',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  loader: 'M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8',
  globe: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-7 10h14M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z',
  arrowLeft: 'M19 12H5m7 7-7-7 7-7',
  arrowRight: 'M5 12h14m-7 7 7-7-7-7',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
  crosshair: 'M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8M12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4Z',
  sparkles: 'M5 3l.8 1.9L7.7 5.8 5.8 6.7 5 8.5l-.8-1.8L2.3 5.8l1.9-.9ZM18 7l1.2 3 3 1.2-3 1.2L18 15l-1.2-2.6-3-1.2 3-1.2ZM10 12l1 2.5 2.5 1-2.5 1L10 19l-1-2.5-2.5-1 2.5-1Z',
  image: 'M21 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14M8.5 10.5h.01M21 15l-5-5L5 21',
  play: 'm5 3 14 9-14 9V3Z',
  fileText: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8M8 17h8M8 9h2',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  trash: 'M3 6h18M8 6V4h8v2m-1 0-1 14H10L9 6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'm2 2 20 20M10.6 10.7a3 3 0 0 0 4 4M9.9 4.2A11.6 11.6 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-3.2 4.3M6.3 6.3A18.7 18.7 0 0 0 2 12s3.5 8 10 8a11 11 0 0 0 5.2-1.3',
  checkCircle: 'M22 12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
  plus: 'M12 5v14M5 12h14',
  terminal: 'm4 17 6-6-6-6M12 19h8',
  cpu: 'M9 2H7v2H5a2 2 0 0 0-2 2v2H1v2h2v4H1v2h2v2a2 2 0 0 0 2 2h2v2h2v-2h6v2h2v-2h2a2 2 0 0 0 2-2v-2h2v-2h-2v-4h2V8h-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9Zm-2 6h10v8H7Z',
} as const;

const mockHistory: HistorySession[] = [
  { id: 1, title: 'Research Session', date: 'Today · 2:15 PM', preview: 'Explored transformers.js capabilities', events: ['Navigated to github.com', 'Asked about local inference', 'Opened MCP task tracker'] },
  { id: 2, title: 'Dev Debugging', date: 'Yesterday · 4:30 PM', preview: 'Investigated React worker rendering', events: ['Navigated to stackoverflow.com', 'Opened settings', 'Installed local model'] },
];

const mockExtensions: Extension[] = [
  { id: 1, name: 'uBlock Origin', author: 'Raymond Hill', rating: 4.9, users: '10M+', category: 'Privacy', description: 'Efficient network filtering.', enabled: true, color: '#f87171' },
  { id: 2, name: 'React DevTools', author: 'Meta', rating: 4.8, users: '5M+', category: 'Dev Tools', description: 'Inspect component trees.', enabled: true, color: '#60a5fa' },
  { id: 3, name: 'AI Summarizer', author: 'Agent Labs', rating: 4.5, users: '120K+', category: 'AI', description: 'Summarize pages without leaving context.', enabled: false, color: '#a78bfa' },
];

const workerSource = `
const _dynamicImport = new Function('url', 'return import(url)');
const cache = {};
self.onmessage = async (event) => {
  const { type, id, task, modelId, prompt, options } = event.data;
  try {
    if (type === 'ping') {
      self.postMessage({ type: 'pong', id });
      return;
    }
    const mod = await _dynamicImport('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3');
    const { pipeline, TextStreamer } = mod;
    const key = task + '::' + modelId;
    if (!cache[key]) {
      self.postMessage({ type: 'phase', id, phase: 'Downloading model…' });
      cache[key] = await pipeline(task, modelId, { dtype: 'q4', device: 'wasm' });
    }
    if (type === 'load') {
      self.postMessage({ type: 'status', id, msg: 'ready' });
      return;
    }
    if (type === 'generate') {
      const streamer = new TextStreamer(cache[key].tokenizer, {
        skip_prompt: true,
        callback_function(token) {
          self.postMessage({ type: 'token', id, token });
        },
      });
      const result = await cache[key](prompt, {
        max_new_tokens: 256,
        temperature: 0.7,
        do_sample: true,
        top_p: 0.9,
        ...options,
        streamer,
      });
      self.postMessage({ type: 'done', id, result });
    }
  } catch (error) {
    self.postMessage({ type: 'error', id, msg: error instanceof Error ? error.message : String(error) });
  }
};`;

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
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
          { id: makeId(), name: 'GitHub', type: 'tab', url: 'https://github.com', persisted: true, memoryTier: 'hot', memoryMB: 180 },
          { id: makeId(), name: 'Hugging Face', type: 'tab', url: 'https://huggingface.co', persisted: false, memoryTier: 'warm', memoryMB: 96 },
        ],
      },
      {
        id: 'ws-dev',
        name: 'Dev',
        type: 'workspace',
        expanded: true,
        activeMemory: false,
        color: '#34d399',
        children: [
          { id: makeId(), name: 'Stack Overflow', type: 'tab', url: 'https://stackoverflow.com', persisted: false, memoryTier: 'cool', memoryMB: 42 },
        ],
      },
    ],
  };
}

function Icon({ name, size = 16, color = 'currentColor', className = '' }: { name: keyof typeof iconPaths; size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {iconPaths[name].split('M').filter(Boolean).map((segment) => (
        <path key={segment} d={`M${segment}`} />
      ))}
    </svg>
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

function countTabs(node: TreeNode): number {
  if (node.type === 'tab') return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countTabs(child), 0);
}

function sumMemory(node: TreeNode): number {
  if (node.type === 'tab') return node.memoryMB ?? 0;
  return (node.children ?? []).reduce((sum, child) => sum + sumMemory(child), 0);
}

function flattenTabs(node: TreeNode): TreeNode[] {
  if (node.type === 'tab') return [node];
  return (node.children ?? []).flatMap(flattenTabs);
}

function flattenTree(node: TreeNode, parentId: string | null = null, depth = 0): FlatTreeItem[] {
  const result: FlatTreeItem[] = [];
  for (const child of node.children ?? []) {
    result.push({ node: child, depth, parentId });
    if (child.expanded && child.children?.length) result.push(...flattenTree(child, child.id, depth + 1));
  }
  return result;
}

function getWorkspace(root: TreeNode, workspaceId: string): TreeNode | null {
  return (root.children ?? []).find((node) => node.id === workspaceId) ?? null;
}

function classifyOmni(raw: string): { intent: 'navigate' | 'search'; url?: string; query?: string } {
  const value = raw.trim();
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value)) return { intent: 'navigate', url: value };
  if (/^localhost(:\d+)?(\/.*)?$/.test(value)) return { intent: 'navigate', url: `http://${value}` };
  if (/^([\w-]+\.)+[a-zA-Z]{2,}(\/.*)?$/.test(value)) return { intent: 'navigate', url: `https://${value}` };
  return { intent: 'search', query: value };
}

function buildTools() {
  return [
    {
      name: 'task_tracker',
      description: 'Show a kanban board for tasks.',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: { type: 'object' },
          },
        },
        required: ['tasks'],
      },
    },
  ];
}

function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  return { toast, setToast };
}

function useTjs() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<string, (payload: Record<string, unknown>) => void>());

  async function getWorker(): Promise<Worker> {
    if (workerRef.current) return workerRef.current;
    const blob = new Blob([workerSource], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    workerRef.current = worker;
    worker.onmessage = (event) => {
      const id = String(event.data.id ?? '');
      const cb = pendingRef.current.get(id);
      if (cb) cb(event.data as Record<string, unknown>);
    };
    const id = `ping-${makeId()}`;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Worker timeout')), 10_000);
      pendingRef.current.set(id, (payload) => {
        if (payload.type === 'pong') {
          window.clearTimeout(timer);
          pendingRef.current.delete(id);
          resolve();
        }
      });
      worker.postMessage({ type: 'ping', id });
    });
    return worker;
  }

  async function loadModel(task: string, modelId: string, onStatus?: (msg: string) => void) {
    const worker = await getWorker();
    const id = `load-${makeId()}`;
    await new Promise<void>((resolve, reject) => {
      pendingRef.current.set(id, (payload) => {
        if (payload.type === 'phase' && typeof payload.phase === 'string') onStatus?.(payload.phase);
        if (payload.type === 'status' && payload.msg === 'ready') {
          pendingRef.current.delete(id);
          onStatus?.('ready');
          resolve();
        }
        if (payload.type === 'error') {
          pendingRef.current.delete(id);
          reject(new Error(String(payload.msg ?? 'Unknown worker error')));
        }
      });
      worker.postMessage({ type: 'load', id, task, modelId });
    });
  }

  async function generate(input: { task: string; modelId: string; prompt: unknown; options?: Record<string, unknown> }, callbacks: TjsCallbacks) {
    const worker = await getWorker();
    const id = `gen-${makeId()}`;
    pendingRef.current.set(id, (payload) => {
      if (payload.type === 'phase' && typeof payload.phase === 'string') callbacks.onPhase?.(payload.phase);
      if (payload.type === 'status' && typeof payload.msg === 'string') callbacks.onStatus?.(payload.msg);
      if (payload.type === 'token' && typeof payload.token === 'string') callbacks.onToken?.(payload.token);
      if (payload.type === 'done') {
        pendingRef.current.delete(id);
        callbacks.onDone?.(payload.result);
      }
      if (payload.type === 'error') {
        pendingRef.current.delete(id);
        callbacks.onError?.(new Error(String(payload.msg ?? 'Unknown worker error')));
      }
    });
    worker.postMessage({ type: 'generate', id, ...input });
  }

  return { loadModel, generate };
}

function ThinkingBlock({ content, duration, isThinking }: { content?: string; duration?: number; isThinking?: boolean }) {
  const [open, setOpen] = useState(Boolean(isThinking));
  useEffect(() => {
    if (isThinking) setOpen(true);
  }, [isThinking]);
  if (!content && !isThinking) return null;
  return (
    <div className={`thinking-block ${isThinking ? 'thinking-active' : ''}`}>
      <button type="button" className="thinking-header" onClick={() => !isThinking && setOpen((current) => !current)} aria-expanded={open}>
        <span className="thinking-title">
          <Icon name={isThinking ? 'loader' : 'sparkles'} size={13} color="#a78bfa" className={isThinking ? 'spin' : ''} />
          {isThinking ? 'Thinking' : `Thought for ${duration ?? 0}s`}
        </span>
        {!isThinking && <Icon name="chevron" size={12} color="#a78bfa" className={open ? 'rotated' : ''} />}
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
        if (!memory) return null;
        return <div key={tier} style={{ width: `${(memory / total) * 100}%`, background: meta.color }} title={`${meta.label}: ${memory}MB`} />;
      })}
    </div>
  );
}

function TaskTrackerCard() {
  const lanes = {
    todo: ['Map user requirements', 'Search models'],
    progress: ['Implement worker streaming'],
    done: ['Create PWA shell'],
  };
  return (
    <div className="mcp-card task-grid">
      {Object.entries(lanes).map(([lane, tasks]) => (
        <div key={lane} className="mcp-pane">
          <h4>{lane === 'todo' ? 'To Do' : lane === 'progress' ? 'In Progress' : 'Done'}</h4>
          {tasks.map((task) => (
            <div key={task} className="mcp-pill">{task}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DataTableCard() {
  return (
    <div className="mcp-card">
      <table>
        <thead>
          <tr><th>Model</th><th>Provider</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr><td>Qwen3 0.6B</td><td>Local</td><td>Installed</td></tr>
          <tr><td>Claude 3.5 Sonnet</td><td>Anthropic</td><td>Ready</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function ChatMessageView({ message }: { message: ChatMessage }) {
  const content = message.streamedContent || message.content;
  return (
    <div className={`message ${message.role}`}>
      {(message.thinkingContent || message.isThinking) && (
        <ThinkingBlock content={message.thinkingContent} duration={message.thinkingDuration} isThinking={message.isThinking} />
      )}
      {content && <div className="message-bubble">{content}{message.status === 'streaming' && !message.isThinking && <span className="stream-cursor" />}</div>}
      {message.loadingStatus && <div className="message-status">{message.loadingStatus}</div>}
      {message.cards?.map((card) => (
        <div key={`${message.id}-${card.app}`}>
          {card.app === 'task_tracker' ? <TaskTrackerCard /> : <DataTableCard />}
        </div>
      ))}
    </div>
  );
}

function PageOverlay({ tab, onClose }: { tab: TreeNode; onClose: () => void }) {
  const [address, setAddress] = useState(tab.url ?? '');
  const [showChat, setShowChat] = useState(false);
  const [picking, setPicking] = useState(false);
  return (
    <section className="page-overlay" aria-label="Page overlay">
      <header className="page-toolbar">
        <button type="button" className="icon-button"><Icon name="arrowLeft" /></button>
        <button type="button" className="icon-button"><Icon name="arrowRight" /></button>
        <button type="button" className="icon-button"><Icon name="refresh" /></button>
        <label className="address-bar">
          <Icon name="globe" size={12} color="#6b7280" />
          <input aria-label="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
        </label>
        <button type="button" className={`icon-button ${picking ? 'active' : ''}`} onClick={() => setPicking((current) => !current)}><Icon name="crosshair" /></button>
        <button type="button" className={`icon-button ${showChat ? 'active' : ''}`} onClick={() => setShowChat((current) => !current)}><Icon name="messageSquare" /></button>
        <button type="button" className="icon-button" onClick={onClose}><Icon name="x" /></button>
      </header>
      <div className="page-body">
        <div className="page-canvas">
          <Icon name="globe" size={32} color="#3f3f46" />
          <p>{tab.url}</p>
          <span>Simulated browser view</span>
        </div>
        {picking && <div className="picker-overlay">Click anywhere to inspect</div>}
        {showChat && <aside className="page-chat-panel"><h3>Page Chat</h3><p>Use the main assistant to reason about this page.</p></aside>}
      </div>
    </section>
  );
}

function ChatPanel({ providers, pendingSearch, onConsumedSearch, onToast }: { providers: ModelProvider[]; pendingSearch: string | null; onConsumedSearch: () => void; onToast: (toast: Exclude<ToastState, null>) => void }) {
  const tjs = useTjs();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: makeId(), role: 'system', content: 'Agent browser ready. Ask me anything or navigate to a URL.' },
  ]);
  const [input, setInput] = useState('');
  const [providerId, setProviderId] = useState<'local' | string>('local');
  const [localModels, setLocalModels] = useState<HFModel[]>(SEED_MODELS);
  const [localModelId, setLocalModelId] = useState(SEED_MODELS[0]?.id ?? '');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!pendingSearch) return;
    void sendMessage(pendingSearch, true);
    onConsumedSearch();
  }, [pendingSearch]);

  function updateMessage(id: string, patch: Partial<ChatMessage>) {
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, ...patch } : message)));
  }

  async function installLocalModel(modelId: string) {
    const model = localModels.find((entry) => entry.id === modelId);
    if (!model) return;
    setLocalModels((current) => current.map((entry) => (entry.id === modelId ? { ...entry, status: 'loading' } : entry)));
    try {
      await tjs.loadModel(model.task, model.id, (msg) => onToast({ msg, type: 'info' }));
      setLocalModels((current) => current.map((entry) => (entry.id === modelId ? { ...entry, status: 'installed' } : entry)));
      onToast({ msg: `${model.name} installed`, type: 'success' });
    } catch (error) {
      setLocalModels((current) => current.map((entry) => (entry.id === modelId ? { ...entry, status: 'available' } : entry)));
      onToast({ msg: error instanceof Error ? error.message : 'Model install failed', type: 'error' });
    }
  }

  async function callCloudProvider(provider: ModelProvider, content: string) {
    const endpoint = API_ENDPOINTS[provider.id];
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (endpoint.header) headers[endpoint.header] = `${endpoint.prefix}${provider.apiKey}`;
    const body = provider.id === 'anthropic'
      ? {
          model: provider.models.find((model) => model.enabled)?.id,
          max_tokens: 1024,
          messages: [{ role: 'user', content }],
          tools: buildTools().map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })),
        }
      : {
          model: provider.models.find((model) => model.enabled)?.id,
          messages: [{ role: 'user', content }],
          functions: buildTools(),
          function_call: 'auto',
        };
    const response = await fetch(endpoint.url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Provider request failed: ${response.status}`);
    return response.json();
  }

  async function sendMessage(text: string, isSearch = false) {
    if (!text.trim()) return;
    const assistantId = makeId();
    const userText = isSearch ? `Search the web for: ${text}` : text;
    setMessages((current) => [...current, { id: makeId(), role: 'user', content: userText }, { id: assistantId, role: 'assistant', content: '', status: 'thinking' }]);
    setInput('');

    if (providerId === 'local') {
      const installedModel = localModels.find((model) => model.id === localModelId)?.status === 'installed';
      if (!installedModel) {
        updateMessage(assistantId, {
          status: 'complete',
          content: 'Install a local model from Settings before using on-device inference.',
          cards: [{ app: 'task_tracker', args: {} }, { app: 'data_table', args: {} }],
        });
        return;
      }
      let tokenBuffer = '';
      let thinkingBuffer = '';
      let inThinking = false;
      let thinkingStart = 0;
      try {
        await tjs.generate(
          {
            task: 'text-generation',
            modelId: localModelId,
            prompt: [
              { role: 'system', content: 'You are a helpful assistant in an agent-first browser.' },
              ...messages.slice(-6).map((message) => ({ role: message.role, content: message.content || message.streamedContent || '' })),
              { role: 'user', content: text },
            ],
          },
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
            onDone: () => updateMessage(assistantId, { status: 'complete', streamedContent: tokenBuffer.trim(), loadingStatus: null, cards: [{ app: 'data_table', args: {} }] }),
            onError: (error) => updateMessage(assistantId, { status: 'error', content: error.message, loadingStatus: null }),
          },
        );
      } catch (error) {
        updateMessage(assistantId, { status: 'error', content: error instanceof Error ? error.message : 'Local generation failed' });
      }
      return;
    }

    const provider = providers.find((entry) => entry.id === providerId);
    if (!provider?.apiKey) {
      updateMessage(assistantId, { status: 'error', content: 'Configure an API key in Settings first.' });
      return;
    }
    try {
      updateMessage(assistantId, { loadingStatus: 'Calling provider…' });
      const response = await callCloudProvider(provider, text);
      const content = provider.id === 'anthropic'
        ? (response.content ?? []).filter((block: { type: string }) => block.type === 'text').map((block: { text: string }) => block.text).join('')
        : response.choices?.[0]?.message?.content ?? '';
      updateMessage(assistantId, { status: 'complete', streamedContent: content || 'No text returned.', loadingStatus: null, cards: [{ app: 'task_tracker', args: {} }] });
    } catch (error) {
      updateMessage(assistantId, { status: 'error', content: error instanceof Error ? error.message : 'Provider request failed', loadingStatus: null });
    }
  }

  return (
    <section className="chat-panel" aria-label="Chat panel">
      <header className="chat-header">
        <div>
          <h2>Agent Chat</h2>
          <p>Switch between local and cloud inference without blocking the UI thread.</p>
        </div>
        <div className="chat-header-controls">
          <label>
            <span className="sr-only">Model provider</span>
            <select aria-label="Model provider" value={providerId} onChange={(event) => setProviderId(event.target.value)}>
              <option value="local">Local model</option>
              {providers.filter((provider) => provider.status === 'connected').map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </select>
          </label>
          {providerId === 'local' && (
            <label>
              <span className="sr-only">Local model</span>
              <select aria-label="Local model" value={localModelId} onChange={(event) => setLocalModelId(event.target.value)}>
                {localModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
            </label>
          )}
        </div>
      </header>
      <div className="message-list" role="log" aria-live="polite">
        {messages.map((message) => <ChatMessageView key={message.id} message={message} />)}
        <div ref={bottomRef} />
      </div>
      <div className="quick-actions">
        {localModels.slice(0, 2).map((model) => (
          <button key={model.id} type="button" className="secondary-button" onClick={() => void installLocalModel(model.id)} disabled={model.status === 'loading'}>
            {model.status === 'installed' ? `${model.name} installed` : `Install ${model.name}`}
          </button>
        ))}
      </div>
      <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); void sendMessage(input); }}>
        <textarea aria-label="Chat input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask the agent, or use the omnibar to navigate…" rows={2} />
        <button type="submit" className="primary-button"><Icon name="send" size={14} color="#fff" />Send</button>
      </form>
    </section>
  );
}

function SidebarTree({ root, activeWorkspaceId, openTabId, cursorId, onCursorChange, onWorkspaceToggle, onSelectTab, onCloseTab }: { root: TreeNode; activeWorkspaceId: string; openTabId: string | null; cursorId: string | null; onCursorChange: (id: string) => void; onWorkspaceToggle: (workspaceId: string) => void; onSelectTab: (tabId: string) => void; onCloseTab: (tabId: string) => void }) {
  const workspace = getWorkspace(root, activeWorkspaceId) ?? root;
  const items = useMemo(() => flattenTree(workspace), [workspace]);

  return (
    <div className="tree-panel">
      {items.map(({ node, depth }) => {
        const isFolder = node.type !== 'tab';
        return (
          <div key={node.id} className={`tree-row ${cursorId === node.id ? 'cursor' : ''} ${openTabId === node.id ? 'active' : ''}`} style={{ paddingLeft: `${12 + depth * 18}px` }}>
            <button type="button" className="tree-button" onClick={() => (isFolder ? onWorkspaceToggle(node.id) : onSelectTab(node.id))} onFocus={() => onCursorChange(node.id)}>
              {isFolder ? <Icon name={node.expanded ? 'folderOpen' : 'folder'} size={14} color={node.color ?? '#60a5fa'} /> : <span className="tier-dot" style={{ background: TIERS[node.memoryTier ?? 'cold'].color }} />}
              <span>{node.name}</span>
              {node.type === 'tab' && <span className="tree-meta">{node.memoryMB ?? 0}MB</span>}
              {isFolder && <span className="tree-meta">{countTabs(node)} tabs</span>}
            </button>
            {node.type === 'tab' && <button type="button" className="icon-button subtle" onClick={() => onCloseTab(node.id)}><Icon name="x" size={12} /></button>}
          </div>
        );
      })}
    </div>
  );
}

function SettingsPanel({ providers, onProvidersChange, installedModels, onInstallLocalModel }: { providers: ModelProvider[]; onProvidersChange: (providers: ModelProvider[]) => void; installedModels: HFModel[]; onInstallLocalModel: (id: string) => Promise<void> }) {
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(providers[0]?.id ?? null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [task, setTask] = useState<string>('text-generation');
  const [results, setResults] = useState<HFModel[]>([]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      const response = await fetch(`https://huggingface.co/api/models?search=${encodeURIComponent(query)}&filter=onnx,${task}&limit=8`);
      if (!response.ok) return;
      const payload = (await response.json()) as Array<{ id: string; downloads?: number; likes?: number; pipeline_tag?: string }>;
      setResults(payload.map((entry) => ({
        id: entry.id,
        name: entry.id.split('/').slice(-1)[0] ?? entry.id,
        author: entry.id.split('/')[0] ?? 'unknown',
        task: entry.pipeline_tag ?? task,
        downloads: entry.downloads ?? 0,
        likes: entry.likes ?? 0,
        tags: ['onnx'],
        sizeMB: null,
        status: 'available',
      })));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [query, task]);

  return (
    <section className="panel-scroll" aria-label="Settings">
      <h2>Provider settings</h2>
      <div className="provider-list">
        {providers.map((provider) => (
          <article key={provider.id} className="provider-card">
            <button type="button" className="provider-header" onClick={() => setExpandedProviderId((current) => (current === provider.id ? null : provider.id))}>
              <span className="provider-name"><span className="provider-dot" style={{ background: provider.color }} />{provider.name}</span>
              <span className={`badge ${provider.status === 'connected' ? 'connected' : ''}`}>{provider.status === 'connected' ? 'Connected' : 'Not configured'}</span>
            </button>
            {expandedProviderId === provider.id && (
              <div className="provider-body">
                <div className="inline-field">
                  <input type={showKeys[provider.id] ? 'text' : 'password'} aria-label={`${provider.name} API key`} value={provider.apiKey} onChange={(event) => onProvidersChange(providers.map((item) => item.id === provider.id ? { ...item, apiKey: event.target.value } : item))} placeholder={`${provider.name} API key`} />
                  <button type="button" className="secondary-button" onClick={() => setShowKeys((current) => ({ ...current, [provider.id]: !current[provider.id] }))}><Icon name={showKeys[provider.id] ? 'eyeOff' : 'eye'} size={14} /></button>
                </div>
                <div className="checkbox-list">
                  {provider.models.map((model) => (
                    <label key={model.id}>
                      <input type="checkbox" checked={model.enabled} onChange={(event) => onProvidersChange(providers.map((item) => item.id === provider.id ? { ...item, models: item.models.map((candidate) => candidate.id === model.id ? { ...candidate, enabled: event.target.checked } : candidate) } : item))} />
                      <span>{model.name}</span>
                    </label>
                  ))}
                </div>
                <button type="button" className="primary-button" onClick={() => onProvidersChange(providers.map((item) => item.id === provider.id ? { ...item, status: item.apiKey ? 'connected' : 'not_configured' } : item))}>Save provider</button>
              </div>
            )}
          </article>
        ))}
      </div>
      <h2>Local models</h2>
      <div className="local-model-controls">
        <input aria-label="Hugging Face search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Hugging Face ONNX models" />
        <div className="chip-row">
          {HF_TASKS.map((entry) => (
            <button key={entry} type="button" className={`chip ${task === entry ? 'active' : ''}`} onClick={() => setTask(entry)}>{entry}</button>
          ))}
        </div>
      </div>
      <div className="model-section">
        <h3>Installed</h3>
        {(installedModels.filter((model) => model.status === 'installed').length ? installedModels.filter((model) => model.status === 'installed') : SEED_MODELS.filter((model) => model.status === 'installed')).map((model) => (
          <div key={model.id} className="model-card"><div><strong>{model.name}</strong><p>{model.author} · {model.task}</p></div><span className="badge connected">Installed</span></div>
        ))}
      </div>
      <div className="model-section">
        <h3>Recommended</h3>
        {SEED_MODELS.map((model) => (
          <button key={model.id} type="button" className="model-card action" onClick={() => void onInstallLocalModel(model.id)}>
            <div><strong>{model.name}</strong><p>{model.author} · {model.task}</p></div><span>{model.sizeMB ?? '—'}MB</span>
          </button>
        ))}
      </div>
      {results.length > 0 && (
        <div className="model-section">
          <h3>Search results</h3>
          {results.map((model) => <div key={model.id} className="model-card"><div><strong>{model.name}</strong><p>{model.author} · {model.task}</p></div><span>{model.downloads.toLocaleString()} downloads</span></div>)}
        </div>
      )}
    </section>
  );
}

function HistoryPanel() {
  return (
    <section className="panel-scroll" aria-label="History">
      <h2>Session history</h2>
      {mockHistory.map((session) => (
        <article key={session.id} className="list-card">
          <h3>{session.title}</h3>
          <p className="muted">{session.date}</p>
          <p>{session.preview}</p>
          <ul>
            {session.events.map((event) => <li key={event}>{event}</li>)}
          </ul>
        </article>
      ))}
    </section>
  );
}

function ExtensionsPanel({ extensions, onToggle }: { extensions: Extension[]; onToggle: (id: number) => void }) {
  return (
    <section className="panel-scroll" aria-label="Extensions">
      <h2>Extensions</h2>
      {extensions.map((extension) => (
        <article key={extension.id} className="list-card extension-card">
          <div className="extension-icon" style={{ background: `${extension.color}22` }}><Icon name="puzzle" color={extension.color} /></div>
          <div>
            <h3>{extension.name}</h3>
            <p className="muted">{extension.author} · {extension.rating}★ · {extension.users}</p>
            <p>{extension.description}</p>
          </div>
          <label className="switch">
            <input type="checkbox" aria-label={`Enable ${extension.name}`} checked={extension.enabled} onChange={() => onToggle(extension.id)} />
            <span />
          </label>
        </article>
      ))}
    </section>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return <div className={`toast ${toast.type}`}>{toast.msg}</div>;
}

function App() {
  const { toast, setToast } = useToast();
  const tjs = useTjs();
  const [root, setRoot] = useState<TreeNode>(createInitialRoot());
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('ws-research');
  const [activePanel, setActivePanel] = useState<'workspaces' | 'chat' | 'history' | 'extensions' | 'settings' | 'account'>('workspaces');
  const [collapsed, setCollapsed] = useState(false);
  const [providers, setProviders] = useState<ModelProvider[]>(MODEL_PROVIDERS);
  const [installedModels, setInstalledModels] = useState<HFModel[]>(SEED_MODELS);
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
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === '?') {
        setShowShortcuts(true);
        return;
      }
      if (activePanel !== 'workspaces') return;
      const currentIndex = visibleItems.findIndex((item) => item.node.id === cursorId);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = visibleItems[Math.min(visibleItems.length - 1, Math.max(0, currentIndex + 1))];
        if (next) setCursorId(next.node.id);
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const next = visibleItems[Math.max(0, currentIndex - 1)];
        if (next) setCursorId(next.node.id);
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
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activePanel, cursorId, root, visibleItems]);

  async function handleInstallLocalModel(modelId: string) {
    const target = installedModels.find((model) => model.id === modelId) ?? SEED_MODELS.find((model) => model.id === modelId);
    if (!target) return;
    setInstalledModels((current) => current.map((model) => model.id === modelId ? { ...model, status: 'loading' } : model));
    try {
      await tjs.loadModel(target.task, modelId, (msg) => setToast({ msg, type: 'info' }));
      setInstalledModels((current) => current.map((model) => model.id === modelId ? { ...model, status: 'installed' } : model));
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : 'Model installation failed', type: 'error' });
      setInstalledModels((current) => current.map((model) => model.id === modelId ? { ...model, status: 'available' } : model));
    }
  }

  function handleOmnibarSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = classifyOmni(omnibar);
    if (result.intent === 'navigate' && result.url) {
      const tab: TreeNode = {
        id: makeId(),
        name: result.url.replace(/^https?:\/\//, '').slice(0, 28),
        type: 'tab',
        url: result.url,
        memoryTier: 'hot',
        memoryMB: 80 + Math.floor(Math.random() * 120),
      };
      setRoot((current) => deepUpdate(current, activeWorkspaceId, (node) => ({ ...node, expanded: true, children: [...(node.children ?? []), tab] })));
      setOpenTabId(tab.id);
      setToast({ msg: `Opened ${result.url}`, type: 'success' });
    } else if (result.query) {
      setPendingSearch(result.query);
      setActivePanel('chat');
      setToast({ msg: `Searching for “${result.query}”`, type: 'info' });
    }
    setOmnibar('');
  }

  function toggleWorkspace(id: string) {
    setRoot((current) => deepUpdate(current, id, (node) => ({ ...node, expanded: !node.expanded })));
  }

  function renderSidebar() {
    if (activePanel === 'workspaces') {
      return (
        <div className="sidebar-content">
          <MemBar root={activeWorkspace} />
          <SidebarTree root={root} activeWorkspaceId={activeWorkspaceId} openTabId={openTabId} cursorId={cursorId} onCursorChange={setCursorId} onWorkspaceToggle={toggleWorkspace} onSelectTab={setOpenTabId} onCloseTab={(id) => {
            setRoot((current) => deepUpdate(current, activeWorkspaceId, (node) => ({ ...node, children: (node.children ?? []).filter((child) => child.id !== id) })));
            if (openTabId === id) setOpenTabId(null);
          }} />
        </div>
      );
    }
    if (activePanel === 'chat') return <ChatPanel providers={providers} pendingSearch={pendingSearch} onConsumedSearch={() => setPendingSearch(null)} onToast={setToast} />;
    if (activePanel === 'history') return <HistoryPanel />;
    if (activePanel === 'extensions') return <ExtensionsPanel extensions={extensions} onToggle={(id) => setExtensions((current) => current.map((entry) => entry.id === id ? { ...entry, enabled: !entry.enabled } : entry))} />;
    if (activePanel === 'settings') return <SettingsPanel providers={providers} onProvidersChange={setProviders} installedModels={installedModels} onInstallLocalModel={handleInstallLocalModel} />;
    return <section className="panel-scroll"><h2>Account</h2><p>Profile and policy controls can be layered in here as needed.</p></section>;
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
        ].map(([id, icon, label]) => (
          <button key={id} type="button" className={`activity-button ${activePanel === id ? 'active' : ''}`} onClick={() => { setActivePanel(id as typeof activePanel); setCollapsed(false); }} aria-label={label}>
            <Icon name={icon as keyof typeof iconPaths} size={16} color={activePanel === id ? '#60a5fa' : '#71717a'} />
          </button>
        ))}
        <button type="button" className="activity-button" onClick={() => setCollapsed((current) => !current)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <Icon name="panelRight" size={16} color="#71717a" />
        </button>
      </nav>
      {!collapsed && (
        <aside className="sidebar">
          <header className="sidebar-header">
            <form className="omnibar" onSubmit={handleOmnibarSubmit}>
              <Icon name="search" size={13} color="#71717a" />
              <input aria-label="Omnibar" value={omnibar} onChange={(event) => setOmnibar(event.target.value)} placeholder="Search, URLs, localhost…" />
            </form>
            <div className="workspace-pills">
              {(root.children ?? []).map((workspace) => (
                <button key={workspace.id} type="button" className={`workspace-pill ${activeWorkspaceId === workspace.id ? 'active' : ''}`} onClick={() => setActiveWorkspaceId(workspace.id)}>{workspace.name}</button>
              ))}
              <button type="button" className="workspace-pill add" onClick={() => setShowWorkspaces(true)}><Icon name="plus" size={10} /></button>
            </div>
          </header>
          {renderSidebar()}
        </aside>
      )}
      <main className="content-area">
        {openTab ? <PageOverlay tab={openTab} onClose={() => setOpenTabId(null)} /> : <ChatPanel providers={providers} pendingSearch={pendingSearch} onConsumedSearch={() => setPendingSearch(null)} onToast={setToast} />}
      </main>
      {showWorkspaces && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Workspace switcher">
          <div className="modal-card">
            <div className="modal-header"><h2>Workspaces</h2><button type="button" className="icon-button" onClick={() => setShowWorkspaces(false)}><Icon name="x" /></button></div>
            <div className="workspace-grid">
              {(root.children ?? []).map((workspace) => (
                <button key={workspace.id} type="button" className="workspace-tile" onClick={() => { setActiveWorkspaceId(workspace.id); setShowWorkspaces(false); }}>
                  <span className="workspace-swatch" style={{ background: workspace.color ?? '#60a5fa' }} />
                  <strong>{workspace.name}</strong>
                  <span>{countTabs(workspace)} tabs · {sumMemory(workspace)}MB</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {showShortcuts && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
          <div className="modal-card compact">
            <div className="modal-header"><h2>Keyboard shortcuts</h2><button type="button" className="icon-button" onClick={() => setShowShortcuts(false)}><Icon name="x" /></button></div>
            <ul className="shortcut-list">
              <li><kbd>↑ / ↓</kbd><span>Move through the tree</span></li>
              <li><kbd>→ / ←</kbd><span>Expand or collapse folders</span></li>
              <li><kbd>Enter</kbd><span>Open a selected tab</span></li>
              <li><kbd>?</kbd><span>Open this overlay</span></li>
            </ul>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </div>
  );
}

export default App;
