import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent } from 'react';
import {
  Bot,
  CheckCircle2,
  CircleDot,
  GitBranch,
  Image,
  Plus,
  Play,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  WORKFLOW_CANVAS_MEDIA_TYPE,
  createWorkflowCanvasFromServerlessWorkflow,
  createWorkflowCanvasRuntimePlan,
  getWorkflowCanvasFeatureInventory,
  runWorkflowCanvasLocally,
  type ServerlessWorkflowDocument,
  type WorkflowCanvasDocument,
  type WorkflowCanvasRunResult,
  type WorkflowCanvasNode,
} from './index.js';

type WorkflowCanvasRunState = 'idle' | 'complete';

export interface WorkflowCanvasWorkspaceFile {
  path: string;
  content: string;
  updatedAt: string;
  extensionOwnership?: {
    extensionId: string;
    extensionName?: string;
    locked?: boolean;
  };
}

interface WorkflowCanvasWidget {
  id: string;
  title: string;
  prompt: string;
  x: number;
  y: number;
  createdAt: string;
}

export interface WorkflowCanvasRendererProps {
  workspaceName?: string;
  workspaceFiles?: WorkflowCanvasWorkspaceFile[];
  onWorkspaceFilesChange?: (files: WorkflowCanvasWorkspaceFile[]) => void;
}

interface WorkflowCanvasNodeMeta {
  title: string;
  shortKind: string;
  source: 'n8n' | 'OpenAI Agent Builder' | 'Higgsfield Canvas' | 'Agent Harness';
  intent: string;
  input: string;
  output: string;
  cost: string;
  requirement: string;
}

interface WorkflowCanvasCatalogItem {
  label: string;
  icon: typeof CircleDot;
  group: string;
  detail: string;
}

type WorkflowCanvasContextMenu =
  | { mode: 'menu'; x: number; y: number }
  | { mode: 'widget'; x: number; y: number }
  | null;

const WORKFLOW_CANVAS_ARTIFACT_PATH = 'workflow-canvas/campaign-launch.json';
const WORKFLOW_CANVAS_RUNTIME_INPUT = {
  goal: 'Launch workflow canvas runtime',
  channels: ['email', 'social'],
};
const WORKFLOW_CANVAS_RUNTIME_CREDENTIALS = {
  'credential:cms-production': 'configured',
  'model:gpt-image': 'configured',
};

const WORKFLOW_CANVAS_SAMPLE_WORKFLOW: ServerlessWorkflowDocument = {
  dsl: '1.0.0',
  namespace: 'agent-harness.workflow-canvas',
  name: 'campaign-launch',
  version: '1.0.0',
  description: 'Research, generate, review, and publish a campaign workflow.',
  do: [
    {
      webhookIntake: {
        listen: { to: 'campaign.requested' },
        output: { as: '.request' },
      },
    },
    {
      researchAgent: {
        call: { ref: 'agent.research' },
        with: { goal: '${ .request.goal }', channels: '${ .request.channels }' },
        retry: { limit: 2 },
        output: { as: '.research' },
      },
    },
    {
      normalizeBrief: {
        set: {
          audience: '${ .research.audience }',
          visualPrompt: '${ .research.visualPrompt }',
          channels: '${ .request.channels }',
        },
      },
    },
    {
      generateCampaignMedia: {
        call: { ref: 'image.generate' },
        with: { model: 'gpt-image', prompt: '${ .visualPrompt }', aspectRatio: '16:9' },
        timeout: 'PT3M',
        output: { as: '.campaign.media' },
      },
    },
    {
      humanApproval: {
        call: 'human.review',
        with: { channel: 'slack', message: 'Approve campaign media and copy.' },
        output: { as: '.approved' },
      },
    },
    {
      routeDecision: {
        switch: [
          {
            when: '${ .approved == true }',
            then: [
              {
                publishCampaign: {
                  call: 'http.post',
                  with: {
                    url: 'https://cms.example/campaigns',
                    credentialRef: 'credential:cms-production',
                    body: '${ .campaign }',
                  },
                  output: { as: '.publishResult' },
                },
              },
            ],
          },
          {
            when: '${ .approved != true }',
            then: [
              {
                requestRevision: {
                  set: { status: 'needs-revision', owner: 'creative-ops' },
                },
              },
            ],
          },
        ],
      },
    },
  ],
};

const WORKFLOW_CANVAS_NODE_META: Record<string, WorkflowCanvasNodeMeta> = {
  webhookIntake: {
    title: 'Webhook intake',
    shortKind: 'Trigger',
    source: 'n8n',
    intent: 'Starts the workflow from a campaign request event and keeps the original payload pinned for replay.',
    input: 'campaign.requested CloudEvent',
    output: '.request',
    cost: 'No generation credit',
    requirement: 'Manual test, webhook trigger, replayable input',
  },
  researchAgent: {
    title: 'Research agent',
    shortKind: 'AI agent',
    source: 'OpenAI Agent Builder',
    intent: 'Calls a specialist research step with typed inputs before downstream generation nodes consume the brief.',
    input: '.request.goal',
    output: '.research',
    cost: 'Model token budget',
    requirement: 'Typed input/output, retry policy',
  },
  normalizeBrief: {
    title: 'Normalize brief',
    shortKind: 'Transform',
    source: 'n8n',
    intent: 'Shapes research output into stable fields for prompt, audience, and channel routing.',
    input: '.research',
    output: '.audience, .visualPrompt, .channels',
    cost: 'No generation credit',
    requirement: 'Expression/code-node parity',
  },
  generateCampaignMedia: {
    title: 'Generate campaign media',
    shortKind: 'Media generation',
    source: 'Higgsfield Canvas',
    intent: 'Routes the normalized prompt into an image generation node so media outputs can branch downstream.',
    input: '.visualPrompt',
    output: '.campaign.media',
    cost: 'Credit estimate: 4 image credits',
    requirement: 'Timeout, model choice, rerun only this node',
  },
  humanApproval: {
    title: 'Human approval',
    shortKind: 'Human review',
    source: 'OpenAI Agent Builder',
    intent: 'Pauses before publishing and records an explicit approve/revise decision.',
    input: '.campaign.media',
    output: '.approved',
    cost: 'No generation credit',
    requirement: 'Human-in-the-loop gate',
  },
  routeDecision: {
    title: 'Route decision',
    shortKind: 'Branch',
    source: 'n8n',
    intent: 'Splits approved and revision-needed paths without leaving the canvas.',
    input: '.approved',
    output: 'publish or revise branch',
    cost: 'No generation credit',
    requirement: 'Switch, merge, filter parity',
  },
  'routeDecision.publishCampaign': {
    title: 'Publish campaign',
    shortKind: 'HTTP action',
    source: 'n8n',
    intent: 'Posts the approved campaign package into the destination CMS.',
    input: '.campaign',
    output: '.publishResult',
    cost: 'No generation credit',
    requirement: 'Credential reference, HTTP node',
  },
  'routeDecision.requestRevision': {
    title: 'Request revision',
    shortKind: 'Revision state',
    source: 'Agent Harness',
    intent: 'Stores revision status as a workspace artifact-friendly state transition.',
    input: '.approved',
    output: '.status',
    cost: 'No generation credit',
    requirement: 'Artifact-backed state',
  },
};

const WORKFLOW_CANVAS_NODE_LAYOUT: Record<string, { x: number; y: number }> = {
  webhookIntake: { x: 32, y: 176 },
  researchAgent: { x: 270, y: 118 },
  normalizeBrief: { x: 508, y: 118 },
  generateCampaignMedia: { x: 746, y: 72 },
  humanApproval: { x: 984, y: 118 },
  routeDecision: { x: 1222, y: 118 },
  'routeDecision.publishCampaign': { x: 1460, y: 62 },
  'routeDecision.requestRevision': { x: 1460, y: 224 },
};

const WORKFLOW_CANVAS_CATALOG: WorkflowCanvasCatalogItem[] = [
  { label: 'Webhook trigger', icon: CircleDot, group: 'Triggers', detail: 'Manual, schedule, webhook, chat, event stream' },
  { label: 'AI agent', icon: Bot, group: 'Agents', detail: 'Specialist agent, typed input/output, trace preview' },
  { label: 'HTTP action', icon: Zap, group: 'Actions', detail: 'App action, credential reference, retry policy' },
  { label: 'Branch', icon: GitBranch, group: 'Flow', detail: 'Switch, merge, loop, filter, subworkflow' },
  { label: 'Human approval', icon: ShieldCheck, group: 'Review', detail: 'Pause, approve, reject, comment, audit trail' },
  { label: 'Media generation', icon: Image, group: 'Creative', detail: 'Prompt, reference, image, video, rerun costs' },
];

const WORKFLOW_CANVAS_FEATURE_PLAN = [
  {
    title: 'Node catalog and templates',
    userStory: 'As a builder, I can start from trigger, agent, action, branch, review, or media nodes without leaving the pane.',
    status: 'Implemented in this pane',
  },
  {
    title: 'Infinite graph canvas',
    userStory: 'As a workflow designer, I can inspect an n8n/OpenAI/Higgsfield-style graph with typed connections and branch paths.',
    status: 'Implemented with scrollable graph and selectable nodes',
  },
  {
    title: 'Node inspector',
    userStory: 'As an operator, I can click any node and see inputs, outputs, execution policy, source parity, and cost data.',
    status: 'Implemented with per-node details',
  },
  {
    title: 'Execution replay',
    userStory: 'As a debugger, I can run or replay the workflow and keep status visible next to the graph.',
    status: 'Implemented as deterministic local replay state',
  },
  {
    title: 'Artifact export',
    userStory: 'As an engineer, I can save the canvas as an Agent Harness workflow artifact backed by Serverless Workflow JSON.',
    status: 'Implemented with workspace-file persistence',
  },
  {
    title: 'Runtime adapters',
    userStory: 'As a production owner, I can resolve HTTP, model, credential, worker, approval, and binding adapters before a run.',
    status: 'Implemented with local adapter readiness',
  },
];

function nodeMeta(node: WorkflowCanvasNode): WorkflowCanvasNodeMeta {
  return WORKFLOW_CANVAS_NODE_META[node.id]!;
}

function nodePosition(node: WorkflowCanvasNode): { x: number; y: number } {
  return WORKFLOW_CANVAS_NODE_LAYOUT[node.id]!;
}

function nodeStatus(node: WorkflowCanvasNode, runState: WorkflowCanvasRunState): string {
  if (runState === 'complete') return node.id === 'routeDecision.requestRevision' ? 'skipped' : 'complete';
  if (node.id === 'webhookIntake') return 'ready';
  return 'idle';
}

function edgePath(canvas: WorkflowCanvasDocument, fromId: string, toId: string): string {
  const from = canvas.nodes.find((node) => node.id === fromId)!;
  const to = canvas.nodes.find((node) => node.id === toId)!;
  const fromPosition = nodePosition(from);
  const toPosition = nodePosition(to);
  const startX = fromPosition.x + 190;
  const startY = fromPosition.y + 54;
  const endX = toPosition.x;
  const endY = toPosition.y + 54;
  const bend = Math.max(62, Math.abs(endX - startX) * 0.42);
  return `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`;
}

function upsertWorkflowCanvasWorkspaceFile(
  files: readonly WorkflowCanvasWorkspaceFile[],
  nextFile: WorkflowCanvasWorkspaceFile,
): WorkflowCanvasWorkspaceFile[] {
  const existingIndex = files.findIndex((file) => file.path === nextFile.path);
  if (existingIndex === -1) return [...files, nextFile];
  const updatedFiles = [...files];
  updatedFiles[existingIndex] = nextFile;
  return updatedFiles;
}

function savedWorkflowCanvasFiles(workspaceFiles: readonly WorkflowCanvasWorkspaceFile[]): WorkflowCanvasWorkspaceFile[] {
  return workspaceFiles
    .filter((file) => file.path.startsWith('workflow-canvas/') && file.path.endsWith('.json'))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function widgetTitleFromPrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, ' ').split(' ').slice(0, 3).join(' ');
}

function widgetIdFromTitle(title: string, index: number): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `widget-${index + 1}-${slug}`;
}

function formatRuntimeValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return 'null';
  return String(value);
}

export function WorkflowCanvasRenderer({
  workspaceName = 'Workflow workspace',
  workspaceFiles = [],
  onWorkspaceFilesChange = () => undefined,
}: WorkflowCanvasRendererProps) {
  const canvas = useMemo(
    () => createWorkflowCanvasFromServerlessWorkflow(WORKFLOW_CANVAS_SAMPLE_WORKFLOW, {
      id: 'campaign-launch',
      title: 'Campaign launch workflow',
    }),
    [],
  );
  const inventory = useMemo(() => getWorkflowCanvasFeatureInventory(), []);
  const runtimePlan = useMemo(
    () => createWorkflowCanvasRuntimePlan(canvas, {
      input: WORKFLOW_CANVAS_RUNTIME_INPUT,
      credentials: WORKFLOW_CANVAS_RUNTIME_CREDENTIALS,
    }),
    [canvas],
  );
  const [selectedNodeId, setSelectedNodeId] = useState(canvas.nodes[0]!.id);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<WorkflowCanvasWidget[]>([]);
  const [runState, setRunState] = useState<WorkflowCanvasRunState>('idle');
  const [lastRun, setLastRun] = useState<WorkflowCanvasRunResult | null>(null);
  const [saveStatus, setSaveStatus] = useState('Ready to save workflow-canvas/campaign-launch.json');
  const [contextMenu, setContextMenu] = useState<WorkflowCanvasContextMenu>(null);
  const [widgetPrompt, setWidgetPrompt] = useState('');
  const widgetPromptRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedNode = canvas.nodes.find((node) => node.id === selectedNodeId)!;
  const selectedWidget = widgets.find((widget) => widget.id === selectedWidgetId) ?? null;
  const selectedMeta = nodeMeta(selectedNode);
  const selectedBindings = runtimePlan.bindings.filter((binding) => binding.nodeId === selectedNodeId);
  const selectedIntegration = runtimePlan.integrations.find((integration) => integration.nodeId === selectedNodeId) ?? null;
  const savedFiles = savedWorkflowCanvasFiles(workspaceFiles);
  const completedCount = canvas.nodes.filter((node) => nodeStatus(node, runState) === 'complete').length;
  const retryLabel = { true: 'retry-aware', false: 'single pass' }[String(canvas.executionModel.retryable)];
  const timeoutLabel = { true: 'timeout-aware', false: 'no timeout' }[String(canvas.executionModel.timeoutAware)];

  useEffect(() => {
    if (contextMenu?.mode === 'widget') widgetPromptRef.current?.focus();
  }, [contextMenu]);

  const saveCanvas = () => {
    const updatedAt = new Date().toISOString();
    const artifact = {
      mediaType: WORKFLOW_CANVAS_MEDIA_TYPE,
      canvas,
      widgets,
      workflow: canvas.workflow,
      featurePlan: WORKFLOW_CANVAS_FEATURE_PLAN,
      runtimePlan,
      lastRun,
      research: {
        sources: inventory.sources,
        screenshotReferences: inventory.screenshotReferences,
      },
    };
    onWorkspaceFilesChange(upsertWorkflowCanvasWorkspaceFile(workspaceFiles, {
      path: WORKFLOW_CANVAS_ARTIFACT_PATH,
      updatedAt,
      content: JSON.stringify(artifact, null, 2),
      extensionOwnership: {
        extensionId: 'agent-harness.ext.workflow-canvas',
        extensionName: 'Workflow canvas orchestration',
        locked: true,
      },
    }));
    setSaveStatus(`Saved ${WORKFLOW_CANVAS_ARTIFACT_PATH}`);
  };

  const runWorkflow = () => {
    const run = runWorkflowCanvasLocally(canvas, {
      input: WORKFLOW_CANVAS_RUNTIME_INPUT,
      credentials: WORKFLOW_CANVAS_RUNTIME_CREDENTIALS,
      approvals: { humanApproval: true },
    });
    setLastRun(run);
    setRunState('complete');
  };

  const resetWorkflow = () => {
    setRunState('idle');
    setLastRun(null);
  };

  const openCanvasContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setWidgetPrompt('');
    setContextMenu({
      mode: 'menu',
      x: Math.max(12, event.clientX - rect.left),
      y: Math.max(12, event.clientY - rect.top),
    });
  };

  const openWidgetDialog = () => {
    setContextMenu({ ...contextMenu!, mode: 'widget' });
  };

  const createWidget = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = widgetPrompt.trim().replace(/\s+/g, ' ');
    if (!prompt) return;
    const title = widgetTitleFromPrompt(prompt);
    const menu = contextMenu!;
    const nextWidget: WorkflowCanvasWidget = {
      id: widgetIdFromTitle(title, widgets.length),
      title,
      prompt,
      x: Math.max(24, Math.min(1490, menu.x - 95)),
      y: Math.max(24, Math.min(276, menu.y - 54)),
      createdAt: new Date().toISOString(),
    };
    setWidgets((current) => [...current, nextWidget]);
    setSelectedWidgetId(nextWidget.id);
    setContextMenu(null);
    setWidgetPrompt('');
  };

  return (
    <section
      className="workflow-canvas-workbench"
      role="region"
      aria-label="Workflow canvas workbench"
      data-testid="workflow-canvas-plugin-renderer"
      data-plugin-id="agent-harness.ext.workflow-canvas"
    >
      <header className="workflow-canvas-topbar">
        <div className="workflow-canvas-title">
          <span>{workspaceName}</span>
          <h2>Workflow Canvas</h2>
          <p>Campaign launch workflow · Serverless Workflow 1.0 · {canvas.nodes.length} nodes · {canvas.edges.length} edges</p>
        </div>
        <div className="workflow-canvas-actions">
          <button type="button" onClick={runWorkflow} aria-label="Run workflow">
            <Play size={15} aria-hidden="true" />
          </button>
          <button type="button" onClick={resetWorkflow} aria-label="Reset workflow replay">
            <RefreshCcw size={15} aria-hidden="true" />
          </button>
          <button type="button" onClick={saveCanvas} aria-label="Save canvas artifact">
            <Save size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="workflow-canvas-layout">
        <section className="workflow-canvas-catalog" aria-label="Workflow node catalog">
          <div className="workflow-canvas-rail-heading">
            <Search size={14} aria-hidden="true" />
            <strong>Node catalog</strong>
          </div>
          <div className="workflow-canvas-catalog-list">
            {WORKFLOW_CANVAS_CATALOG.map((item) => {
              const CatalogIcon = item.icon;
              return (
                <button key={item.label} type="button" className="workflow-canvas-catalog-row">
                  <CatalogIcon size={15} aria-hidden="true" />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.group}</small>
                  </span>
                  <em>{item.detail}</em>
                </button>
              );
            })}
          </div>
          <div className="workflow-canvas-plan-list" aria-label="Workflow canvas feature plan">
            {WORKFLOW_CANVAS_FEATURE_PLAN.map((item) => (
              <article key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.status}</span>
              </article>
            ))}
          </div>
        </section>

        <section
          className="workflow-canvas-stage"
          aria-label="Workflow orchestration canvas"
          onContextMenu={openCanvasContextMenu}
        >
          <div className="workflow-canvas-stagebar">
            <div className="workflow-canvas-legend">
              <span>n8n replay</span>
              <span>OpenAI typed edge</span>
              <span>Higgsfield branch</span>
            </div>
            <output>{runState === 'complete' ? `${completedCount}/${canvas.nodes.length} complete` : 'Draft ready'}</output>
          </div>
          <div className="workflow-canvas-map-shell">
            <div className="workflow-canvas-map">
              <svg className="workflow-canvas-edges" viewBox="0 0 1688 386" aria-hidden="true">
                {canvas.edges.map((edge) => (
                  <g key={edge.id}>
                    <path d={edgePath(canvas, edge.from, edge.to)} />
                    {edge.label !== 'next' ? (
                      <text
                        x={nodePosition(canvas.nodes.find((node) => node.id === edge.to)!).x - 42}
                        y={nodePosition(canvas.nodes.find((node) => node.id === edge.to)!).y + 48}
                      >
                        {edge.label.includes('!=') ? 'revise' : 'approved'}
                      </text>
                    ) : null}
                  </g>
                ))}
              </svg>
              {canvas.nodes.map((node) => {
                const meta = nodeMeta(node);
                const position = nodePosition(node);
                const status = nodeStatus(node, runState);
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={`workflow-canvas-node workflow-canvas-node--${node.kind}${!selectedWidget && node.id === selectedNode.id ? ' is-selected' : ''}`}
                    style={{ left: position.x, top: position.y } as CSSProperties}
                    aria-label={`Inspect ${meta.title}`}
                    aria-pressed={!selectedWidget && node.id === selectedNode.id}
                    onClick={() => {
                      setSelectedNodeId(node.id);
                      setSelectedWidgetId(null);
                    }}
                  >
                    <span className="workflow-canvas-node-topline">
                      <small>{meta.shortKind}</small>
                      <i data-status={status}>{status}</i>
                    </span>
                    <strong>{meta.title}</strong>
                    <span>{meta.output}</span>
                  </button>
                );
              })}
              {widgets.map((widget) => (
                <button
                  key={widget.id}
                  type="button"
                  className={`workflow-canvas-node workflow-canvas-node--widget${selectedWidget?.id === widget.id ? ' is-selected' : ''}`}
                  style={{ left: widget.x, top: widget.y } as CSSProperties}
                  aria-label={`Inspect ${widget.title} widget`}
                  aria-pressed={selectedWidget?.id === widget.id}
                  onClick={() => setSelectedWidgetId(widget.id)}
                >
                  <span className="workflow-canvas-node-topline">
                    <small>Widget</small>
                    <i data-status="ready">ready</i>
                  </span>
                  <strong>{widget.title}</strong>
                  <span>{widget.prompt}</span>
                </button>
              ))}
            </div>
          </div>
          {contextMenu?.mode === 'menu' ? (
            <div
              className="workflow-canvas-context-menu"
              role="menu"
              aria-label="Workflow canvas context menu"
              style={{ left: contextMenu.x, top: contextMenu.y } as CSSProperties}
            >
              <button type="button" role="menuitem" onClick={openWidgetDialog}>
                <Plus size={14} aria-hidden="true" />
                <span>Create Widget</span>
              </button>
            </div>
          ) : null}
          {contextMenu?.mode === 'widget' ? (
            <div
              className="workflow-canvas-widget-dialog"
              role="dialog"
              aria-label="Create workflow widget"
              style={{ left: contextMenu.x, top: contextMenu.y } as CSSProperties}
            >
              <form onSubmit={createWidget}>
                <label>
                  <span>Widget prompt</span>
                  <textarea
                    ref={widgetPromptRef}
                    aria-label="Widget prompt"
                    value={widgetPrompt}
                    onChange={(event) => setWidgetPrompt(event.target.value)}
                  />
                </label>
                <div className="workflow-canvas-widget-dialog-actions">
                  <button type="button" onClick={() => setContextMenu(null)}>Cancel</button>
                  <button type="submit" disabled={!widgetPrompt.trim()}>Create widget</button>
                </div>
              </form>
            </div>
          ) : null}
        </section>

        <section className="workflow-canvas-inspector" aria-label="Workflow node inspector">
          <div className="workflow-canvas-rail-heading">
            <CheckCircle2 size={14} aria-hidden="true" />
            <strong>Inspector</strong>
          </div>
          <div className="workflow-canvas-inspector-card">
            {selectedWidget ? (
              <>
                <span>Widget</span>
                <h3>{selectedWidget.title}</h3>
                <p>{selectedWidget.prompt}</p>
                <dl>
                  <dt>Input</dt>
                  <dd>Canvas context prompt</dd>
                  <dt>Output</dt>
                  <dd>{selectedWidget.title} widget</dd>
                  <dt>Policy</dt>
                  <dd>Prompt-backed, local canvas widget</dd>
                  <dt>Cost</dt>
                  <dd>No generation credit</dd>
                  <dt>Source</dt>
                  <dd>Source: Agent Harness</dd>
                </dl>
              </>
            ) : (
              <>
                <span>{selectedMeta.shortKind}</span>
                <h3>{selectedMeta.title}</h3>
                <p>{selectedMeta.intent}</p>
                <dl>
                  <dt>Input</dt>
                  <dd>{selectedMeta.input}</dd>
                  <dt>Output</dt>
                  <dd>{selectedMeta.output}</dd>
                  <dt>Policy</dt>
                  <dd>{selectedMeta.requirement}</dd>
                  <dt>Cost</dt>
                  <dd>{selectedMeta.cost}</dd>
                  <dt>Source</dt>
                  <dd>Source: {selectedMeta.source}</dd>
                  {selectedIntegration ? (
                    <>
                      <dt>Integration {selectedIntegration.provider}</dt>
                      <dd>{selectedIntegration.operation} · {selectedIntegration.status}</dd>
                    </>
                  ) : null}
                  {selectedBindings.map((binding) => (
                    <Fragment key={binding.id}>
                      <dt>Binding {binding.target}</dt>
                      <dd>{binding.sourcePath}{' -> '}{formatRuntimeValue(binding.preview)}</dd>
                    </Fragment>
                  ))}
                </dl>
              </>
            )}
          </div>
          <section className="workflow-canvas-saved" aria-label="Saved workflow canvases">
            <strong>Saved workflow canvases</strong>
            {savedFiles.length ? savedFiles.map((file) => <span key={file.path}>{file.path}</span>) : <span>No saved canvases yet</span>}
          </section>
        </section>
      </div>

      <footer className="workflow-canvas-runner">
        <section aria-label="Workflow execution replay">
          <div className="workflow-canvas-runner-heading">
            <strong>{lastRun || runState === 'complete' ? 'Run complete' : 'Execution replay'}</strong>
            <span>{lastRun ? `${lastRun.status} · ` : ''}{retryLabel} · {timeoutLabel}</span>
          </div>
          <ol>
            {(lastRun?.steps ?? canvas.nodes).map((entry) => {
              const node = 'nodeId' in entry
                ? canvas.nodes.find((candidate) => candidate.id === entry.nodeId)!
                : entry;
              const meta = nodeMeta(node);
              const status = 'nodeId' in entry ? entry.status : nodeStatus(node, runState);
              return (
                <li key={node.id}>
                  <span data-status={status === 'success' ? 'complete' : status} />
                  <strong>{'nodeId' in entry ? entry.nodeId : meta.title}</strong>
                  <small>{status}</small>
                </li>
              );
            })}
          </ol>
        </section>
        <section aria-label="Workflow integration readiness">
          <div className="workflow-canvas-runner-heading">
            <strong>Integration readiness</strong>
            <span>{runtimePlan.readyIntegrationCount}/{runtimePlan.integrationCount} ready</span>
          </div>
          <div className="workflow-canvas-runtime-list">
            {runtimePlan.integrations.map((integration) => (
              <span key={integration.id}>
                {integration.provider} · {integration.operation}{integration.credentialRef ? ` · ${integration.credentialRef}` : ''}
              </span>
            ))}
          </div>
        </section>
        <section aria-label="Workflow binding map">
          <div className="workflow-canvas-runner-heading">
            <strong>Binding map</strong>
            <span>{runtimePlan.bindingCount} data bindings</span>
          </div>
          <div className="workflow-canvas-runtime-list">
            {runtimePlan.bindings.slice(0, 6).map((binding) => (
              <span key={binding.id}>
                {binding.target} · {binding.sourcePath} · {formatRuntimeValue(binding.preview)}
              </span>
            ))}
          </div>
        </section>
        <section aria-label="Workflow canvas research sources">
          <div className="workflow-canvas-runner-heading">
            <strong>Research sources</strong>
            <span>{inventory.screenshotReferences.length} screenshot references</span>
          </div>
          <div className="workflow-canvas-source-list">
            {inventory.sources.map((source) => <span key={source.id}>{source.label}</span>)}
          </div>
          <p role="status" aria-label="Workflow canvas save status">{saveStatus}</p>
        </section>
      </footer>
    </section>
  );
}

export const WorkflowCanvasWorkbench = WorkflowCanvasRenderer;
