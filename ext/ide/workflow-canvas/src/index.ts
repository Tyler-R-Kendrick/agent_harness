import type {
  ArtifactBody,
  ArtifactSnapshot,
  HarnessPlugin,
} from 'harness-core';

export const WORKFLOW_CANVAS_MEDIA_TYPE = 'application/vnd.agent-harness.workflow-canvas+json';

export type WorkflowCanvasNodeKind =
  | 'trigger'
  | 'action'
  | 'branch'
  | 'transform'
  | 'human-review'
  | 'event'
  | 'media-generation';

export interface ServerlessWorkflowDocument {
  dsl: '1.0.0';
  namespace?: string;
  name: string;
  version: string;
  description?: string;
  do: ServerlessWorkflowTask[];
}

export type ServerlessWorkflowTask = Record<string, ServerlessWorkflowTaskBody>;

export interface ServerlessWorkflowTaskBody {
  listen?: unknown;
  call?: unknown;
  set?: unknown;
  switch?: Array<{
    when?: string;
    then?: ServerlessWorkflowTask[];
  }>;
  retry?: unknown;
  timeout?: unknown;
  [key: string]: unknown;
}

export interface WorkflowCanvasNode {
  id: string;
  label: string;
  kind: WorkflowCanvasNodeKind;
  taskName: string;
  dslTask: ServerlessWorkflowTaskBody;
  catalogCategory: string;
  position: { x: number; y: number };
}

export interface WorkflowCanvasEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface WorkflowCanvasDocument {
  id: string;
  title: string;
  specVersion: 'cncf-serverless-workflow-1.0';
  source: {
    kind: 'serverless-workflow';
    workflowName: string;
    namespace?: string;
    version: string;
  };
  workflow: ServerlessWorkflowDocument;
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
  featureParity: FeatureParityTarget[];
  executionModel: {
    engine: 'serverless-workflow';
    retryable: boolean;
    timeoutAware: boolean;
    queueModeReady: boolean;
    credentialMode: 'references-only';
  };
}

export interface WorkflowCanvasArtifact {
  canvas: WorkflowCanvasDocument;
  workflow: ServerlessWorkflowDocument;
}

export interface WorkflowCanvasSource {
  id: 'cncf-serverless-workflow' | 'n8n' | 'higgsfield-canvas';
  label: string;
  url: string;
  notes: string[];
}

export interface WorkflowCanvasScreenshotReference {
  label: string;
  product: 'n8n' | 'Higgsfield Canvas';
  url: string;
}

export interface FeatureParityTarget {
  product: 'n8n' | 'Higgsfield Canvas' | 'Agent Harness';
  features: string[];
}

export interface WorkflowCanvasFeatureInventory {
  sources: WorkflowCanvasSource[];
  screenshotReferences: WorkflowCanvasScreenshotReference[];
  parityTargets: FeatureParityTarget[];
  userFlows: string[];
}

export interface WorkflowValidationSummary {
  dsl: string;
  namespace: string | null;
  name: string;
  version: string;
  taskCount: number;
  triggerCount: number;
  branchCount: number;
  humanReviewCount: number;
}

export interface WorkflowValidationResult {
  valid: boolean;
  issues: string[];
  summary?: WorkflowValidationSummary;
}

export interface CreateWorkflowCanvasOptions {
  id?: string;
  title?: string;
}

interface CreateWorkflowCanvasArgs extends CreateWorkflowCanvasOptions {
  workflow?: unknown;
}

interface WorkflowCanvasIdArgs {
  id?: string;
}

interface ExportWorkflowCanvasArgs extends WorkflowCanvasIdArgs {
  workflow?: unknown;
}

const FEATURE_INVENTORY: WorkflowCanvasFeatureInventory = {
  sources: [
    {
      id: 'cncf-serverless-workflow',
      label: 'CNCF Serverless Workflow',
      url: 'https://www.cncf.io/projects/serverless-workflow/',
      notes: [
        'Official CNCF project for the Serverless Workflow DSL.',
        'Portable workflow definition and execution contract.',
      ],
    },
    {
      id: 'n8n',
      label: 'n8n workflow automation',
      url: 'https://n8n.io/features/',
      notes: [
        'Visual workflow builder with triggers, actions, credentials, executions, debugging, AI nodes, and queue mode.',
        'Primary feature parity target for automation and operations workflows.',
      ],
    },
    {
      id: 'higgsfield-canvas',
      label: 'Higgsfield Canvas',
      url: 'https://higgsfield.ai/canvas-intro',
      notes: [
        'Node-based creative workspace for prompts, references, generated media, multi-model routing, collaboration, and templates.',
        'Primary feature parity target for media-generation workflow canvases.',
      ],
    },
  ],
  screenshotReferences: [
    {
      label: 'n8n blank workflow canvas',
      product: 'n8n',
      url: 'https://docs.n8n.io/_images/courses/level-one/chapter-one/l1-c1-canvas.png',
    },
    {
      label: 'n8n completed tutorial workflow',
      product: 'n8n',
      url: 'https://docs.n8n.io/_images/try-it-out/tutorial-first.png',
    },
    {
      label: 'n8n AI nodes workflow',
      product: 'n8n',
      url: 'https://n8niostorageaccount.blob.core.windows.net/n8nio-strapi-blobs-stage/assets/ai_nodes_4a8d75e57c.webp',
    },
    {
      label: 'Higgsfield node composition',
      product: 'Higgsfield Canvas',
      url: 'https://higgsfield.ai/cdn-cgi/image/fit%3Dscale-down%2Cformat%3Dwebp%2Conerror%3Dredirect%2Cwidth%3D1920%2Cquality%3D85/https%3A//static.higgsfield.ai/canvas/feature-1.png',
    },
    {
      label: 'Higgsfield multi-model picker',
      product: 'Higgsfield Canvas',
      url: 'https://higgsfield.ai/cdn-cgi/image/fit%3Dscale-down%2Cformat%3Dwebp%2Conerror%3Dredirect%2Cwidth%3D1920%2Cquality%3D85/https%3A//static.higgsfield.ai/canvas/feature-2.png',
    },
    {
      label: 'Higgsfield collaboration canvas',
      product: 'Higgsfield Canvas',
      url: 'https://higgsfield.ai/cdn-cgi/image/fit%3Dscale-down%2Cformat%3Dwebp%2Conerror%3Dredirect%2Cwidth%3D1920%2Cquality%3D85/https%3A//static.higgsfield.ai/canvas/feature-3.png',
    },
  ],
  parityTargets: [
    {
      product: 'n8n',
      features: [
        'visual-builder',
        'triggers',
        'actions',
        'expressions-code',
        'credentials',
        'templates',
        'executions-debugging',
        'human-in-the-loop',
        'queue-mode',
      ],
    },
    {
      product: 'Higgsfield Canvas',
      features: [
        'infinite-node-board',
        'prompt-reference-generation-nodes',
        'multi-model-graph',
        'media-generation',
        'collaboration-comments',
        'templates',
        'asset-reuse',
        'per-node-credit-costs',
      ],
    },
    {
      product: 'Agent Harness',
      features: [
        'cncf-serverless-workflow-dsl',
        'artifact-backed-canvases',
        'plugin-marketplace-installation',
        'agentbus-execution-traces',
        'renderer-pane-contributions',
      ],
    },
  ],
  userFlows: [
    'create-from-scratch',
    'build-from-template',
    'configure-credentials',
    'test-node',
    'run-workflow',
    'debug-execution',
    'retry-failed-run',
    'build-ai-agent',
    'branch-multi-model-generation',
    'collaborate-and-comment',
    'duplicate-template-and-rerun-changed-nodes',
  ],
};

const GRID_X = 240;
const GRID_Y = 150;

export function getWorkflowCanvasFeatureInventory(): WorkflowCanvasFeatureInventory {
  return clone(FEATURE_INVENTORY);
}

export function validateServerlessWorkflowDocument(value: unknown): WorkflowValidationResult {
  const issues = validateWorkflowShape(value);
  if (issues.length > 0) {
    return { valid: false, issues };
  }
  const workflow = value as ServerlessWorkflowDocument;
  return {
    valid: true,
    issues: [],
    summary: summarizeWorkflow(workflow),
  };
}

export function createWorkflowCanvasFromServerlessWorkflow(
  value: unknown,
  options: CreateWorkflowCanvasOptions = {},
): WorkflowCanvasDocument {
  const validation = validateServerlessWorkflowDocument(value);
  if (!validation.valid) {
    throw new Error(`Invalid Serverless Workflow document: ${validation.issues.join(' ')}`);
  }
  const workflow = clone(value as ServerlessWorkflowDocument);
  const graph = buildGraph(workflow.do);

  return {
    id: normalizedId(options.id ?? workflow.name),
    title: options.title?.trim() || titleFromWorkflow(workflow),
    specVersion: 'cncf-serverless-workflow-1.0',
    source: {
      kind: 'serverless-workflow',
      workflowName: workflow.name,
      ...(workflow.namespace === undefined ? {} : { namespace: workflow.namespace }),
      version: workflow.version,
    },
    workflow,
    nodes: graph.nodes,
    edges: graph.edges,
    featureParity: getWorkflowCanvasFeatureInventory().parityTargets,
    executionModel: {
      engine: 'serverless-workflow',
      retryable: graph.retryable,
      timeoutAware: graph.timeoutAware,
      queueModeReady: true,
      credentialMode: 'references-only',
    },
  };
}

export function decodeWorkflowCanvasArtifact(value: WorkflowCanvasArtifact | string): WorkflowCanvasArtifact {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!isRecord(parsed)) {
    throw new Error('Workflow canvas artifact must be an object.');
  }
  if (!isRecord(parsed.workflow) || !validateServerlessWorkflowDocument(parsed.workflow).valid) {
    throw new Error('Workflow canvas artifact needs a Serverless Workflow document.');
  }
  const canvas = isWorkflowCanvasDocument(parsed.canvas)
    ? clone(parsed.canvas)
    : createWorkflowCanvasFromServerlessWorkflow(parsed.workflow);
  return {
    canvas,
    workflow: clone(parsed.workflow as unknown as ServerlessWorkflowDocument),
  };
}

export function createWorkflowCanvasPlugin(): HarnessPlugin {
  return {
    id: 'workflow-canvas',
    register({ artifacts, commands, tools }) {
      tools.register({
        id: 'workflow-canvas.inventory',
        label: 'Workflow canvas feature inventory',
        description: 'Return the n8n, Higgsfield Canvas, and CNCF Serverless Workflow parity inventory.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => getWorkflowCanvasFeatureInventory(),
      });

      tools.register({
        id: 'workflow-canvas.validate',
        label: 'Validate Serverless Workflow',
        description: 'Validate a CNCF Serverless Workflow document before storing it as a canvas.',
        inputSchema: {
          type: 'object',
          properties: { workflow: { type: 'object' } },
          required: ['workflow'],
          additionalProperties: false,
        },
        execute: async (rawArgs) => validateServerlessWorkflowDocument((rawArgs as CreateWorkflowCanvasArgs).workflow),
      });

      tools.register({
        id: 'workflow-canvas.create',
        label: 'Create workflow canvas',
        description: 'Create and persist a workflow canvas artifact from a CNCF Serverless Workflow document.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            workflow: { type: 'object' },
          },
          required: ['workflow'],
          additionalProperties: false,
        },
        execute: async (rawArgs) => {
          const args = rawArgs as CreateWorkflowCanvasArgs;
          const canvas = createWorkflowCanvasFromServerlessWorkflow(args.workflow, args);
          const artifact = await artifacts.create({
            id: args.id?.trim() || canvas.id,
            title: args.title?.trim() || canvas.title,
            data: JSON.stringify({ canvas, workflow: canvas.workflow }),
            mediaType: WORKFLOW_CANVAS_MEDIA_TYPE,
            metadata: metadataForCanvas(canvas),
          });
          return canvasResult(artifactSnapshotFrom(canvas, artifact));
        },
      });

      tools.register({
        id: 'workflow-canvas.read',
        label: 'Read workflow canvas',
        description: 'Read a persisted workflow canvas artifact.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
          additionalProperties: false,
        },
        execute: async (rawArgs) => {
          const id = readCanvasId(rawArgs as WorkflowCanvasIdArgs);
          const snapshot = await readCanvasArtifact(artifacts, id);
          if (!snapshot) {
            throw new Error(`Unknown workflow canvas: ${id}`);
          }
          return canvasResult(snapshot);
        },
      });

      tools.register({
        id: 'workflow-canvas.export',
        label: 'Export workflow canvas',
        description: 'Export a workflow canvas artifact or raw workflow as Serverless Workflow JSON.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            workflow: { type: 'object' },
          },
          additionalProperties: false,
        },
        execute: async (rawArgs) => {
          const args = rawArgs as ExportWorkflowCanvasArgs;
          if (args.workflow !== undefined) {
            return {
              format: 'serverless-workflow+json',
              workflow: createWorkflowCanvasFromServerlessWorkflow(args.workflow).workflow,
            };
          }
          const id = readCanvasId(args);
          const snapshot = await readCanvasArtifact(artifacts, id);
          if (!snapshot) {
            throw new Error(`Unknown workflow canvas: ${id}`);
          }
          return {
            format: 'serverless-workflow+json',
            workflow: decodeArtifactSnapshot(snapshot).workflow,
          };
        },
      });

      commands.register({
        id: 'workflow-canvas.new',
        usage: '/workflow <goal>',
        description: 'Draft a workflow canvas using CNCF Serverless Workflow.',
        pattern: /^\/workflow(?:\s+(?<goal>.+))?$/i,
        target: {
          type: 'prompt-template',
          template: (_args, match) => {
            const goal = match.groups.goal?.trim() || 'a new automation';
            return [
              `Draft a Serverless Workflow 1.0.0 document and Agent Harness workflow canvas for ${goal}.`,
              'Include n8n-parity nodes for trigger, action, credentials, debugging, and human review where relevant.',
              'Include Higgsfield Canvas-parity media nodes when the workflow generates or transforms images/video.',
            ].join('\n');
          },
        },
      });
    },
  };
}

export function WorkflowCanvasRenderer(): null {
  return null;
}

async function readCanvasArtifact(
  artifacts: { read: (id: string) => Promise<ArtifactSnapshot | undefined> },
  id: string,
): Promise<ArtifactSnapshot | undefined> {
  try {
    return await artifacts.read(id);
  } catch (error) {
    if (error instanceof Error && error.message === `Unknown artifact: ${id}`) {
      return undefined;
    }
    throw error;
  }
}

function validateWorkflowShape(value: unknown): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) {
    return ['Workflow must be an object.'];
  }
  if (value.dsl !== '1.0.0') {
    issues.push('Workflow dsl must be "1.0.0".');
  }
  if (typeof value.name !== 'string' || !value.name.trim()) {
    issues.push('Workflow name is required.');
  }
  if (typeof value.version !== 'string' || !value.version.trim()) {
    issues.push('Workflow version is required.');
  }
  if (!Array.isArray(value.do) || value.do.length === 0) {
    issues.push('Workflow do must contain at least one task.');
  } else {
    issues.push(...validateTasks(value.do));
  }
  return issues;
}

function validateTasks(tasks: unknown[], prefix = ''): string[] {
  return tasks.flatMap((task) => {
    if (!isRecord(task)) {
      return [`Task ${prefix || 'entry'} must be an object.`];
    }
    const entries = Object.entries(task);
    if (entries.length !== 1) {
      const label = prefix || entries.map(([name]) => name).join(',') || 'entry';
      return [`Task ${label} must contain exactly one named step.`];
    }
    const [[name, body]] = entries;
    if (!isRecord(body)) {
      return [`Task "${prefix}${name}" must be an object.`];
    }
    return Array.isArray(body.switch)
      ? body.switch.flatMap((branch, index) => validateBranch(branch, `${prefix}${name}.${index}.`))
      : [];
  });
}

function validateBranch(branch: unknown, prefix: string): string[] {
  if (!isRecord(branch)) {
    return [`Switch branch ${prefix} must be an object.`];
  }
  if (branch.then === undefined) {
    return [];
  }
  if (!Array.isArray(branch.then)) {
    return [`Switch branch ${prefix}then must be a task array.`];
  }
  return validateTasks(branch.then, prefix);
}

function summarizeWorkflow(workflow: ServerlessWorkflowDocument): WorkflowValidationSummary {
  const allTasks = flattenTasks(workflow.do);
  return {
    dsl: workflow.dsl,
    namespace: workflow.namespace ?? null,
    name: workflow.name,
    version: workflow.version,
    taskCount: allTasks.length,
    triggerCount: allTasks.filter((task) => task.kind === 'trigger').length,
    branchCount: allTasks.filter((task) => task.kind === 'branch').length,
    humanReviewCount: allTasks.filter((task) => task.kind === 'human-review').length,
  };
}

function buildGraph(tasks: ServerlessWorkflowTask[]) {
  const nodes: WorkflowCanvasNode[] = [];
  const edges: WorkflowCanvasEdge[] = [];
  let previousTopLevelNodeId: string | null = null;
  let retryable = false;
  let timeoutAware = false;

  tasks.forEach((task, index) => {
    const topLevel = addTaskNode(task, index, '', nodes);
    retryable = retryable || topLevel.retryable;
    timeoutAware = timeoutAware || topLevel.timeoutAware;
    if (previousTopLevelNodeId !== null) {
      edges.push(edge(previousTopLevelNodeId, topLevel.id, 'next'));
    }
    previousTopLevelNodeId = topLevel.id;

    for (const branch of topLevel.branches) {
      branch.tasks.forEach((nestedTask, branchIndex) => {
        const nested = addTaskNode(nestedTask, branchIndex, `${topLevel.id}.`, nodes);
        retryable = retryable || nested.retryable;
        timeoutAware = timeoutAware || nested.timeoutAware;
        edges.push(edge(topLevel.id, nested.id, branch.label));
      });
    }
  });

  return { nodes, edges, retryable, timeoutAware };
}

function addTaskNode(
  task: ServerlessWorkflowTask,
  index: number,
  prefix: string,
  nodes: WorkflowCanvasNode[],
) {
  const [taskName, body] = Object.entries(task)[0] as [string, ServerlessWorkflowTaskBody];
  const id = `${prefix}${taskName}`;
  const kind = classifyTask(body);
  nodes.push({
    id,
    label: labelFromTaskName(taskName),
    kind,
    taskName,
    dslTask: clone(body),
    catalogCategory: catalogCategoryFor(kind),
    position: { x: index * GRID_X, y: prefix ? GRID_Y : 0 },
  });
  return {
    id,
    retryable: body.retry !== undefined,
    timeoutAware: body.timeout !== undefined,
    branches: branchTasks(body),
  };
}

function branchTasks(body: ServerlessWorkflowTaskBody): Array<{ label: string; tasks: ServerlessWorkflowTask[] }> {
  return Array.isArray(body.switch)
    ? body.switch.map((branch) => ({
      label: typeof branch.when === 'string' ? branch.when : 'else',
      tasks: Array.isArray(branch.then) ? branch.then : [],
    }))
    : [];
}

function flattenTasks(tasks: ServerlessWorkflowTask[]): Array<{ kind: WorkflowCanvasNodeKind }> {
  return tasks.flatMap((task) => {
    const [, body] = Object.entries(task)[0] as [string, ServerlessWorkflowTaskBody];
    return [
      { kind: classifyTask(body) },
      ...branchTasks(body).flatMap((branch) => flattenTasks(branch.tasks)),
    ];
  });
}

function classifyTask(body: ServerlessWorkflowTaskBody): WorkflowCanvasNodeKind {
  if (body.listen !== undefined) return 'trigger';
  if (Array.isArray(body.switch)) return 'branch';
  if (body.set !== undefined) return 'transform';
  if (isHumanReviewCall(body.call)) return 'human-review';
  if (isMediaGenerationCall(body.call)) return 'media-generation';
  if (body.call !== undefined) return 'action';
  return 'event';
}

function isHumanReviewCall(call: unknown): boolean {
  return call === 'human.review' || (isRecord(call) && call.ref === 'human.review');
}

function isMediaGenerationCall(call: unknown): boolean {
  const value = typeof call === 'string'
    ? call
    : isRecord(call) && typeof call.ref === 'string'
      ? call.ref
      : '';
  return value.includes('image.') || value.includes('video.') || value.includes('media.');
}

function catalogCategoryFor(kind: WorkflowCanvasNodeKind): string {
  const categories: Record<WorkflowCanvasNodeKind, string> = {
    trigger: 'Triggers',
    action: 'Actions',
    branch: 'Flow',
    transform: 'Data transformation',
    'human-review': 'Human in the loop',
    event: 'Events',
    'media-generation': 'Media generation',
  };
  return categories[kind];
}

function edge(from: string, to: string, label: string): WorkflowCanvasEdge {
  return {
    id: `${from}-to-${to}`,
    from,
    to,
    label,
  };
}

function canvasResult(snapshot: ArtifactSnapshot) {
  const artifact = snapshot.artifact;
  const decoded = decodeArtifactSnapshot(snapshot);
  return {
    id: artifact.id,
    title: artifact.title ?? decoded.canvas.title,
    mediaType: artifact.mediaType ?? null,
    nodeCount: decoded.canvas.nodes.length,
    edgeCount: decoded.canvas.edges.length,
    workflow: decoded.workflow,
    canvas: decoded.canvas,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  };
}

function artifactSnapshotFrom(canvas: WorkflowCanvasDocument, artifact: ArtifactSnapshot['artifact']): ArtifactSnapshot {
  return {
    artifact,
    data: JSON.stringify({ canvas, workflow: canvas.workflow }),
    mediaType: WORKFLOW_CANVAS_MEDIA_TYPE,
    metadata: metadataForCanvas(canvas),
  };
}

function decodeArtifactSnapshot(snapshot: ArtifactBody): WorkflowCanvasArtifact {
  if (typeof snapshot.data !== 'string') {
    throw new Error('Workflow canvas artifact data must be JSON.');
  }
  return decodeWorkflowCanvasArtifact(snapshot.data);
}

function metadataForCanvas(canvas: WorkflowCanvasDocument): Record<string, unknown> {
  return {
    artifactKind: 'workflow-canvas',
    workflowName: canvas.workflow.name,
    nodeCount: canvas.nodes.length,
    edgeCount: canvas.edges.length,
    dsl: canvas.workflow.dsl,
  };
}

function readCanvasId(args: WorkflowCanvasIdArgs): string {
  const id = args.id?.trim();
  if (!id) {
    throw new Error('Workflow canvas id is required.');
  }
  return id;
}

function titleFromWorkflow(workflow: ServerlessWorkflowDocument): string {
  return workflow.description?.trim() || labelFromTaskName(workflow.name);
}

function labelFromTaskName(value: string): string {
  const spaced = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function normalizedId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workflow-canvas';
}

function isWorkflowCanvasDocument(value: unknown): value is WorkflowCanvasDocument {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && value.specVersion === 'cncf-serverless-workflow-1.0'
    && Array.isArray(value.nodes)
    && Array.isArray(value.edges)
    && isRecord(value.workflow)
    && validateServerlessWorkflowDocument(value.workflow).valid;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
