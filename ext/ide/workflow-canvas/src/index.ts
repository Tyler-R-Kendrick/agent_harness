import type {
  ArtifactBody,
  ArtifactSnapshot,
  HarnessPlugin,
} from 'harness-core';

export {
  WorkflowCanvasRenderer,
  WorkflowCanvasWorkbench,
} from './WorkflowCanvasWorkbench.js';
export type {
  WorkflowCanvasRendererProps,
  WorkflowCanvasWorkspaceFile,
} from './WorkflowCanvasWorkbench.js';

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

export type WorkflowCanvasIntegrationKind =
  | 'trigger'
  | 'agent'
  | 'transform'
  | 'model'
  | 'human-review'
  | 'http';

export type WorkflowCanvasIntegrationStatus = 'ready' | 'needs-credential';

export interface WorkflowCanvasIntegration {
  id: string;
  nodeId: string;
  label: string;
  provider: 'n8n' | 'Agent Harness' | 'Higgsfield Canvas';
  kind: WorkflowCanvasIntegrationKind;
  operation: string;
  credentialRef?: string;
  status: WorkflowCanvasIntegrationStatus;
}

export interface WorkflowCanvasBinding {
  id: string;
  nodeId: string;
  target: string;
  expression: string;
  sourcePath: string;
  sourceNodeId: string | null;
  preview: unknown;
}

export interface WorkflowCanvasRuntimePlan {
  workflowName: string;
  bindingCount: number;
  integrationCount: number;
  readyIntegrationCount: number;
  bindings: WorkflowCanvasBinding[];
  integrations: WorkflowCanvasIntegration[];
  gaps: string[];
}

export type WorkflowCanvasRunStatus = 'success' | 'blocked';
export type WorkflowCanvasStepStatus = 'success' | 'skipped';

export interface WorkflowCanvasStepBinding {
  target: string;
  sourcePath: string;
  value: unknown;
}

export interface WorkflowCanvasRunStep {
  nodeId: string;
  label: string;
  status: WorkflowCanvasStepStatus;
  integrationId: string | null;
  startedAt: string;
  finishedAt: string;
  input: unknown;
  output: unknown;
  bindings: WorkflowCanvasStepBinding[];
  skippedReason?: string;
}

export interface WorkflowCanvasRunResult {
  runId: string;
  workflowName: string;
  status: WorkflowCanvasRunStatus;
  startedAt: string;
  finishedAt: string;
  stepCount: number;
  steps: WorkflowCanvasRunStep[];
  finalState: Record<string, unknown>;
  runtimePlan: WorkflowCanvasRuntimePlan;
  issues: string[];
  executionArtifactId?: string;
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

interface WorkflowCanvasRuntimeArgs extends WorkflowCanvasIdArgs {
  workflow?: unknown;
  input?: unknown;
  credentials?: Record<string, unknown>;
  approvals?: Record<string, boolean>;
  now?: string;
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

export function createWorkflowCanvasRuntimePlan(
  value: unknown,
  options: Pick<WorkflowCanvasRuntimeArgs, 'input' | 'credentials'> = {},
): WorkflowCanvasRuntimePlan {
  const canvas = isWorkflowCanvasDocument(value)
    ? clone(value)
    : createWorkflowCanvasFromServerlessWorkflow(value);
  const outputPaths = outputPathByNode(canvas.workflow.do);
  const previewState = createPreviewState(canvas.workflow, options.input);
  const credentials = options.credentials ?? {};
  const bindings = collectWorkflowBindings(canvas.workflow.do, '', outputPaths, previewState);
  const integrations = collectWorkflowIntegrations(canvas.workflow.do, '', credentials);
  const gaps = integrations
    .filter((integration) => integration.status === 'needs-credential' && integration.credentialRef)
    .map((integration) => `Integration ${integration.nodeId} needs credential reference ${integration.credentialRef}.`);

  return {
    workflowName: canvas.workflow.name,
    bindingCount: bindings.length,
    integrationCount: integrations.length,
    readyIntegrationCount: integrations.filter((integration) => integration.status === 'ready').length,
    bindings,
    integrations,
    gaps,
  };
}

export function runWorkflowCanvasLocally(
  value: unknown,
  options: Pick<WorkflowCanvasRuntimeArgs, 'input' | 'credentials' | 'approvals' | 'now'> = {},
): WorkflowCanvasRunResult {
  const canvas = isWorkflowCanvasDocument(value)
    ? clone(value)
    : createWorkflowCanvasFromServerlessWorkflow(value);
  const startedAt = normalizeRunTimestamp(options.now);
  const state: Record<string, unknown> = {};
  const input = normalizeRunInput(options.input);
  const runtimePlan = createWorkflowCanvasRuntimePlan(canvas, {
    input,
    credentials: options.credentials,
  });
  const steps: WorkflowCanvasRunStep[] = [];

  if (runtimePlan.gaps.length === 0) {
    executeTaskList(canvas.workflow.do, {
      prefix: '',
      canvas,
      input,
      state,
      runtimePlan,
      steps,
      now: startedAt,
      approvals: options.approvals ?? {},
    });
  }

  const status: WorkflowCanvasRunStatus = runtimePlan.gaps.length === 0 ? 'success' : 'blocked';
  return {
    runId: `${canvas.workflow.name}-${timestampSlug(startedAt)}`,
    workflowName: canvas.workflow.name,
    status,
    startedAt,
    finishedAt: startedAt,
    stepCount: steps.filter((step) => step.status === 'success').length,
    steps,
    finalState: clone(state),
    runtimePlan,
    issues: runtimePlan.gaps,
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
        id: 'workflow-canvas.bindings',
        label: 'Resolve workflow canvas bindings',
        description: 'Resolve node data bindings and integration readiness for a workflow canvas.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            workflow: { type: 'object' },
            input: { type: 'object' },
            credentials: { type: 'object' },
          },
          additionalProperties: false,
        },
        execute: async (rawArgs) => {
          const args = rawArgs as WorkflowCanvasRuntimeArgs;
          const canvas = await resolveWorkflowCanvasForRuntime(artifacts, args, 'Workflow canvas bindings need a workflow or canvas id.');
          return createWorkflowCanvasRuntimePlan(canvas, args);
        },
      });

      tools.register({
        id: 'workflow-canvas.integrations',
        label: 'Check workflow canvas integrations',
        description: 'Return integration adapters, credential references, readiness, and missing setup gaps.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            workflow: { type: 'object' },
            input: { type: 'object' },
            credentials: { type: 'object' },
          },
          additionalProperties: false,
        },
        execute: async (rawArgs) => {
          const args = rawArgs as WorkflowCanvasRuntimeArgs;
          const canvas = await resolveWorkflowCanvasForRuntime(artifacts, args, 'Workflow canvas integrations need a workflow or canvas id.');
          return createWorkflowCanvasRuntimePlan(canvas, args);
        },
      });

      tools.register({
        id: 'workflow-canvas.run',
        label: 'Run workflow canvas locally',
        description: 'Execute a deterministic local workflow replay with resolved bindings, integrations, and persisted run history.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            workflow: { type: 'object' },
            input: { type: 'object' },
            credentials: { type: 'object' },
            approvals: { type: 'object' },
            now: { type: 'string' },
          },
          additionalProperties: false,
        },
        execute: async (rawArgs) => {
          const args = rawArgs as WorkflowCanvasRuntimeArgs;
          const canvas = await resolveWorkflowCanvasForRuntime(artifacts, args, 'Workflow canvas run needs a workflow or canvas id.');
          const run = runWorkflowCanvasLocally(canvas, args);
          const artifactId = `${canvas.id}-run-${run.runId}`;
          await artifacts.create({
            id: artifactId,
            title: `${canvas.title} run ${run.runId}`,
            data: JSON.stringify({ canvas, workflow: canvas.workflow, run }, null, 2),
            mediaType: WORKFLOW_CANVAS_MEDIA_TYPE,
            metadata: {
              artifactKind: 'workflow-canvas-run',
              workflowName: canvas.workflow.name,
              status: run.status,
              stepCount: run.stepCount,
            },
          });
          return { ...run, executionArtifactId: artifactId };
        },
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

async function resolveWorkflowCanvasForRuntime(
  artifacts: { read: (id: string) => Promise<ArtifactSnapshot | undefined> },
  args: WorkflowCanvasRuntimeArgs,
  missingMessage: string,
): Promise<WorkflowCanvasDocument> {
  if (args.workflow !== undefined) {
    return createWorkflowCanvasFromServerlessWorkflow(args.workflow);
  }
  const id = args.id?.trim();
  if (!id) {
    throw new Error(missingMessage);
  }
  const snapshot = await readCanvasArtifact(artifacts, id);
  if (!snapshot) {
    throw new Error(`Unknown workflow canvas: ${id}`);
  }
  return decodeArtifactSnapshot(snapshot).canvas;
}

interface RuntimeExecutionContext {
  prefix: string;
  canvas: WorkflowCanvasDocument;
  input: Record<string, unknown>;
  state: Record<string, unknown>;
  runtimePlan: WorkflowCanvasRuntimePlan;
  steps: WorkflowCanvasRunStep[];
  now: string;
  approvals: Record<string, boolean>;
}

function executeTaskList(tasks: ServerlessWorkflowTask[], context: RuntimeExecutionContext): void {
  for (const task of tasks) {
    executeTask(task, context);
  }
}

function executeTask(task: ServerlessWorkflowTask, context: RuntimeExecutionContext): void {
  const [taskName, body] = Object.entries(task)[0] as [string, ServerlessWorkflowTaskBody];
  const nodeId = `${context.prefix}${taskName}`;
  if (Array.isArray(body.switch)) {
    executeSwitchTask(nodeId, body, context);
    return;
  }

  const before = clone(context.state);
  const integration = context.runtimePlan.integrations.find((entry) => entry.nodeId === nodeId) ?? null;
  const bindingValues = bindingsForNode(context.runtimePlan, nodeId, context.state);
  const output = executeTaskBody(nodeId, body, context);

  context.steps.push({
    nodeId,
    label: nodeLabel(context.canvas, nodeId),
    status: 'success',
    integrationId: integration?.id ?? null,
    startedAt: context.now,
    finishedAt: context.now,
    input: before,
    output,
    bindings: bindingValues,
  });
}

function executeSwitchTask(
  nodeId: string,
  body: ServerlessWorkflowTaskBody,
  context: RuntimeExecutionContext,
): void {
  const branches = branchTasks(body);
  const bindingValues = bindingsForNode(context.runtimePlan, nodeId, context.state);
  const matchedIndex = branches.findIndex((branch) => branchMatches(branch.label, context.state));
  context.steps.push({
    nodeId,
    label: nodeLabel(context.canvas, nodeId),
    status: 'success',
    integrationId: null,
    startedAt: context.now,
    finishedAt: context.now,
    input: clone(context.state),
    output: {
      branch: matchedIndex === -1 ? null : branches[matchedIndex]!.label,
    },
    bindings: bindingValues,
  });

  branches.forEach((branch, index) => {
    if (index === matchedIndex) {
      executeTaskList(branch.tasks, { ...context, prefix: `${nodeId}.` });
      return;
    }
    skipTaskList(branch.tasks, context, `${nodeId}.`, `Branch condition did not match: ${branch.label}`);
  });
}

function executeTaskBody(
  nodeId: string,
  body: ServerlessWorkflowTaskBody,
  context: RuntimeExecutionContext,
): unknown {
  if (body.listen !== undefined) {
    const output = clone(context.input);
    setPath(context.state, taskOutputPath(body, nodeId, 'listen'), output);
    return output;
  }
  if (body.set !== undefined) {
    const output = evaluateValue(body.set, context.state);
    if (isRecord(output)) {
      for (const [key, value] of Object.entries(output)) {
        setPath(context.state, `.${key}`, value);
      }
    }
    return output;
  }
  if (body.call !== undefined) {
    return executeCallTask(nodeId, body, context);
  }
  return null;
}

function executeCallTask(
  nodeId: string,
  body: ServerlessWorkflowTaskBody,
  context: RuntimeExecutionContext,
): unknown {
  const ref = callRef(body.call);
  const withArgs = evaluateValue(isRecord(body.with) ? body.with : {}, context.state) as Record<string, unknown>;
  const outputPath = taskOutputPath(body, nodeId, ref);
  const output = callOutput(ref, nodeId, withArgs, context);
  setPath(context.state, outputPath, output);
  return output;
}

function callOutput(
  ref: string,
  nodeId: string,
  args: Record<string, unknown>,
  context: RuntimeExecutionContext,
): unknown {
  if (ref === 'agent.research') {
    const goal = stringValue(args.goal, 'Launch workflow canvas runtime');
    const channels = stringArrayValue(args.channels);
    return {
      audience: 'Campaign operators',
      visualPrompt: `${goal} for ${channels.join(', ') || 'owned channels'}`,
      sources: ['workspace://brand', 'web://competitive-research'],
    };
  }
  if (isMediaGenerationRef(ref)) {
    return {
      model: stringValue(args.model, 'gpt-image'),
      prompt: stringValue(args.prompt, 'Campaign visual'),
      aspectRatio: stringValue(args.aspectRatio, '16:9'),
      assets: ['artifact://campaign-media/hero.png'],
    };
  }
  if (ref === 'human.review') {
    return context.approvals[nodeId] ?? true;
  }
  if (ref === 'http.post') {
    return {
      status: 202,
      url: stringValue(args.url, 'https://example.invalid'),
      body: args.body ?? null,
      credentialRef: typeof args.credentialRef === 'string' ? args.credentialRef : null,
    };
  }
  return {
    ref,
    nodeId,
    args,
  };
}

function skipTaskList(
  tasks: ServerlessWorkflowTask[],
  context: RuntimeExecutionContext,
  prefix: string,
  reason: string,
): void {
  for (const task of tasks) {
    const [taskName, body] = Object.entries(task)[0] as [string, ServerlessWorkflowTaskBody];
    const nodeId = `${prefix}${taskName}`;
    context.steps.push({
      nodeId,
      label: nodeLabel(context.canvas, nodeId),
      status: 'skipped',
      integrationId: null,
      startedAt: context.now,
      finishedAt: context.now,
      input: clone(context.state),
      output: null,
      bindings: [],
      skippedReason: reason,
    });
    for (const branch of branchTasks(body)) {
      skipTaskList(branch.tasks, context, `${nodeId}.`, reason);
    }
  }
}

function bindingsForNode(
  runtimePlan: WorkflowCanvasRuntimePlan,
  nodeId: string,
  state: Record<string, unknown>,
): WorkflowCanvasStepBinding[] {
  return runtimePlan.bindings
    .filter((binding) => binding.nodeId === nodeId)
    .map((binding) => ({
      target: binding.target,
      sourcePath: binding.sourcePath,
      value: evaluateExpression(binding.expression, state),
    }));
}

function branchMatches(label: string, state: Record<string, unknown>): boolean {
  if (label === 'else') {
    return true;
  }
  return evaluateExpression(label, state) === true;
}

function collectWorkflowBindings(
  tasks: ServerlessWorkflowTask[],
  prefix: string,
  outputPaths: Map<string, string[]>,
  previewState: Record<string, unknown>,
): WorkflowCanvasBinding[] {
  return tasks.flatMap((task) => {
    const [taskName, body] = Object.entries(task)[0] as [string, ServerlessWorkflowTaskBody];
    const nodeId = `${prefix}${taskName}`;
    const ownBindings = collectBindingsFromValue(body.with, `${nodeId}:with`, nodeId, 'with', outputPaths, previewState)
      .concat(collectBindingsFromValue(body.set, `${nodeId}:set`, nodeId, 'set', outputPaths, previewState))
      .concat(Array.isArray(body.switch)
        ? body.switch.flatMap((branch, index) => typeof branch.when === 'string'
          ? [bindingFromExpression(
            `${nodeId}:switch:${index}`,
            nodeId,
            `switch.${index}.when`,
            branch.when,
            outputPaths,
            previewState,
          )]
          : [])
        : []);
    const nestedBindings = branchTasks(body)
      .flatMap((branch) => collectWorkflowBindings(branch.tasks, `${nodeId}.`, outputPaths, previewState));
    return [...ownBindings, ...nestedBindings];
  });
}

function collectBindingsFromValue(
  value: unknown,
  idPrefix: string,
  nodeId: string,
  targetPrefix: string,
  outputPaths: Map<string, string[]>,
  previewState: Record<string, unknown>,
): WorkflowCanvasBinding[] {
  if (typeof value === 'string' && expressionBody(value) !== null) {
    return [bindingFromExpression(idPrefix, nodeId, targetPrefix, value, outputPaths, previewState)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectBindingsFromValue(
      item,
      `${idPrefix}:${index}`,
      nodeId,
      `${targetPrefix}.${index}`,
      outputPaths,
      previewState,
    ));
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, nested]) => collectBindingsFromValue(
      nested,
      `${idPrefix}:${key}`,
      nodeId,
      `${targetPrefix}.${key}`,
      outputPaths,
      previewState,
    ));
  }
  return [];
}

function bindingFromExpression(
  id: string,
  nodeId: string,
  target: string,
  expression: string,
  outputPaths: Map<string, string[]>,
  previewState: Record<string, unknown>,
): WorkflowCanvasBinding {
  const sourcePath = sourcePathFromExpression(expression);
  return {
    id,
    nodeId,
    target,
    expression,
    sourcePath,
    sourceNodeId: sourceNodeForPath(outputPaths, sourcePath),
    preview: sourcePath ? getPath(previewState, sourcePath) ?? null : null,
  };
}

function collectWorkflowIntegrations(
  tasks: ServerlessWorkflowTask[],
  prefix: string,
  credentials: Record<string, unknown>,
): WorkflowCanvasIntegration[] {
  return tasks.flatMap((task) => {
    const [taskName, body] = Object.entries(task)[0] as [string, ServerlessWorkflowTaskBody];
    const nodeId = `${prefix}${taskName}`;
    const integration = integrationForNode(nodeId, taskName, body, credentials);
    const nested = branchTasks(body).flatMap((branch) => collectWorkflowIntegrations(branch.tasks, `${nodeId}.`, credentials));
    return integration ? [integration, ...nested] : nested;
  });
}

function integrationForNode(
  nodeId: string,
  taskName: string,
  body: ServerlessWorkflowTaskBody,
  credentials: Record<string, unknown>,
): WorkflowCanvasIntegration | null {
  if (body.listen !== undefined) {
    return integration(nodeId, 'trigger', 'n8n', listenOperation(body), undefined, credentials);
  }
  if (body.set !== undefined && collectBindingsFromValue(body.set, nodeId, nodeId, 'set', new Map(), {}).length > 0) {
    return integration(nodeId, 'transform', 'Agent Harness', 'data.transform', undefined, credentials);
  }
  if (body.call === undefined) {
    return null;
  }
  const ref = callRef(body.call);
  if (ref === 'agent.research') {
    return integration(nodeId, 'agent', 'Agent Harness', ref, undefined, credentials);
  }
  if (isMediaGenerationRef(ref)) {
    const model = isRecord(body.with) && typeof body.with.model === 'string' ? body.with.model : 'gpt-image';
    return integration(nodeId, 'model', 'Higgsfield Canvas', ref, `model:${model}`, credentials);
  }
  if (ref === 'human.review') {
    return integration(nodeId, 'human-review', 'Agent Harness', ref, undefined, credentials);
  }
  if (ref === 'http.post') {
    return integration(nodeId, 'http', 'n8n', ref, credentialRefFromTask(body, taskName), credentials);
  }
  return integration(nodeId, 'agent', 'Agent Harness', ref, undefined, credentials);
}

function integration(
  nodeId: string,
  kind: WorkflowCanvasIntegrationKind,
  provider: WorkflowCanvasIntegration['provider'],
  operation: string,
  credentialRef: string | undefined,
  credentials: Record<string, unknown>,
): WorkflowCanvasIntegration {
  return {
    id: `${nodeId}:${kind}`,
    nodeId,
    label: labelFromTaskName(nodeId.split('.').at(-1)!),
    provider,
    kind,
    operation,
    ...(credentialRef === undefined ? {} : { credentialRef }),
    status: credentialRef === undefined || credentials[credentialRef] !== undefined ? 'ready' : 'needs-credential',
  };
}

function outputPathByNode(tasks: ServerlessWorkflowTask[], prefix = ''): Map<string, string[]> {
  const paths = new Map<string, string[]>();
  for (const task of tasks) {
    const [taskName, body] = Object.entries(task)[0] as [string, ServerlessWorkflowTaskBody];
    const nodeId = `${prefix}${taskName}`;
    paths.set(nodeId, outputPathsForTask(body, nodeId));
    for (const branch of branchTasks(body)) {
      for (const [nestedId, nestedPaths] of outputPathByNode(branch.tasks, `${nodeId}.`)) {
        paths.set(nestedId, nestedPaths);
      }
    }
  }
  return paths;
}

function outputPathsForTask(body: ServerlessWorkflowTaskBody, nodeId: string): string[] {
  if (typeof maybeOutputAs(body) === 'string') {
    return [maybeOutputAs(body)!];
  }
  if (body.listen !== undefined) {
    return ['.event'];
  }
  if (body.set !== undefined && isRecord(body.set)) {
    return Object.keys(body.set).map((key) => `.${key}`);
  }
  if (body.call !== undefined) {
    return [defaultOutputPathForCall(callRef(body.call), nodeId)];
  }
  return [];
}

function sourceNodeForPath(outputPaths: Map<string, string[]>, sourcePath: string): string | null {
  if (!sourcePath) {
    return null;
  }
  for (const [nodeId, paths] of outputPaths) {
    if (paths.some((path) => pathMatchesSource(path, sourcePath))) {
      return nodeId;
    }
  }
  return null;
}

function pathMatchesSource(outputPath: string, sourcePath: string): boolean {
  return sourcePath === outputPath
    || sourcePath.startsWith(`${outputPath}.`)
    || outputPath.startsWith(`${sourcePath}.`);
}

function createPreviewState(
  workflow: ServerlessWorkflowDocument,
  input: unknown,
): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  const normalizedInput = normalizeRunInput(input);
  for (const task of workflow.do) {
    const [, body] = Object.entries(task)[0] as [string, ServerlessWorkflowTaskBody];
    if (body.listen !== undefined) {
      setPath(state, taskOutputPath(body, '', 'listen'), normalizedInput);
    }
  }
  return state;
}

function normalizeRunInput(input: unknown): Record<string, unknown> {
  return isRecord(input)
    ? clone(input)
    : {
      goal: 'Launch workflow canvas runtime',
      channels: ['email', 'social'],
    };
}

function normalizeRunTimestamp(value: string | undefined): string {
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : new Date().toISOString();
}

function timestampSlug(value: string): string {
  return value.replace(/[:.]/g, '-');
}

function nodeLabel(canvas: WorkflowCanvasDocument, nodeId: string): string {
  return canvas.nodes.find((node) => node.id === nodeId)?.label ?? labelFromTaskName(nodeId);
}

function taskOutputPath(body: ServerlessWorkflowTaskBody, nodeId: string, ref: string): string {
  if (ref === 'listen') {
    return maybeOutputAs(body) ?? '.event';
  }
  return maybeOutputAs(body) ?? defaultOutputPathForCall(ref, nodeId);
}

function defaultOutputPathForCall(ref: string, nodeId: string): string {
  if (ref === 'agent.research') return '.research';
  if (isMediaGenerationRef(ref)) return '.campaign.media';
  if (ref === 'human.review') return '.approved';
  if (ref === 'http.post') return '.publishResult';
  return `.${nodeId.replace(/[^a-zA-Z0-9]+/g, '_')}Result`;
}

function maybeOutputAs(body: ServerlessWorkflowTaskBody): string | null {
  return isRecord(body.output) && typeof body.output.as === 'string' ? body.output.as : null;
}

function listenOperation(body: ServerlessWorkflowTaskBody): string {
  return isRecord(body.listen) && typeof body.listen.to === 'string' ? body.listen.to : 'manual.trigger';
}

function credentialRefFromTask(body: ServerlessWorkflowTaskBody, taskName: string): string {
  if (isRecord(body.with) && typeof body.with.credentialRef === 'string') {
    return body.with.credentialRef;
  }
  return `credential:${normalizedId(taskName)}`;
}

function callRef(call: unknown): string {
  return typeof call === 'string'
    ? call
    : isRecord(call) && typeof call.ref === 'string'
      ? call.ref
      : 'unknown.call';
}

function isMediaGenerationRef(ref: string): boolean {
  return ref.includes('image.') || ref.includes('video.') || ref.includes('media.');
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function evaluateValue(value: unknown, state: Record<string, unknown>): unknown {
  if (typeof value === 'string' && expressionBody(value) !== null) {
    return evaluateExpression(value, state);
  }
  if (Array.isArray(value)) {
    return value.map((item) => evaluateValue(item, state));
  }
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, evaluateValue(nested, state)]));
  }
  return value;
}

function evaluateExpression(expression: string, state: Record<string, unknown>): unknown {
  const body = expressionBody(expression);
  if (body === null) {
    return expression;
  }
  const equalsTrue = /^(\.[\w.]+)\s*==\s*true$/u.exec(body);
  if (equalsTrue) {
    return getPath(state, equalsTrue[1]!) === true;
  }
  const notEqualsTrue = /^(\.[\w.]+)\s*!=\s*true$/u.exec(body);
  if (notEqualsTrue) {
    return getPath(state, notEqualsTrue[1]!) !== true;
  }
  if (/^\.[\w.]+$/u.test(body)) {
    return getPath(state, body);
  }
  return null;
}

function expressionBody(value: string): string | null {
  const match = /^\$\{\s*(.*?)\s*\}$/u.exec(value.trim());
  return match?.[1] ?? null;
}

function sourcePathFromExpression(expression: string): string {
  const body = expressionBody(expression);
  if (!body) {
    return '';
  }
  return /(\.[\w.]+)/u.exec(body)?.[1] ?? '';
}

function getPath(source: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.').filter(Boolean);
  let current: unknown = source;
  for (const segment of segments) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.').filter(Boolean);
  let current = target;
  segments.slice(0, -1).forEach((segment) => {
    if (!isRecord(current[segment])) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  });
  current[segments.at(-1)!] = value;
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
    if (!name.trim()) {
      return [`Task ${prefix || 'entry'} name is required.`];
    }
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
