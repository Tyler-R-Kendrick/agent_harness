export type N8nCapabilityStatus = 'planned' | 'foundation' | 'ready';

export interface N8nCapabilityArea {
  id: string;
  title: string;
  summary: string;
  n8nFeatures: string[];
  offlinePwaPlan: string[];
  serverlessWorkflowMapping: string[];
  status: N8nCapabilityStatus;
}

export interface N8nCapabilitySummary {
  totalAreas: number;
  plannedAreas: number;
  foundationAreas: number;
  readyAreas: number;
  serializationStandard: string;
}

export interface ServerlessWorkflowPreview {
  document: {
    document: {
      dsl: '1.0.3';
      namespace: string;
      name: string;
      version: string;
    };
    do: Array<Record<string, unknown>>;
  };
  coverage: string[];
}

const SERIALIZATION_STANDARD = 'CNCF Serverless Workflow 1.0.3';

const N8N_CAPABILITY_AREAS: N8nCapabilityArea[] = [
  {
    id: 'workflow-canvas',
    title: 'Workflow canvas',
    summary: 'Node graph authoring, connection editing, sticky notes, and build-time data pinning for local workflow design.',
    n8nFeatures: ['workflow editor canvas', 'connections', 'sticky notes', 'data pinning', 'manual execution'],
    offlinePwaPlan: ['Store editable workflow graphs in IndexedDB', 'Keep pinned sample node output with the graph', 'Render graph validation inline before execution'],
    serverlessWorkflowMapping: ['document metadata', 'do task sequence', 'listen event trigger', 'input fixtures'],
    status: 'foundation',
  },
  {
    id: 'node-library',
    title: 'Node library',
    summary: 'Triggers, actions, core logic nodes, HTTP requests, and custom/community-style local extensions.',
    n8nFeatures: ['trigger nodes', 'action nodes', 'core nodes', 'HTTP Request', 'custom/community nodes'],
    offlinePwaPlan: ['Define node manifests as local extension records', 'Require explicit tool scopes per node', 'Compile node manifests into workflow tasks'],
    serverlessWorkflowMapping: ['call tasks', 'switch branches', 'for loops', 'try/catch error handling'],
    status: 'foundation',
  },
  {
    id: 'executions-debugging',
    title: 'Executions and debugging',
    summary: 'Manual and production-style runs, execution lists, custom evidence, redaction, retries, and review queues.',
    n8nFeatures: ['manual executions', 'production executions', 'execution lists', 'custom execution data', 'redaction'],
    offlinePwaPlan: ['Persist run history locally', 'Attach screenshots and logs as evidence', 'Redact configured fields before storage'],
    serverlessWorkflowMapping: ['workflow run id', 'task status', 'timeout', 'retry', 'error-review task'],
    status: 'ready',
  },
  {
    id: 'credentials-governance',
    title: 'Credentials and governance',
    summary: 'Credential vaulting, project-level sharing, RBAC-style controls, variables, and audit-friendly scope boundaries.',
    n8nFeatures: ['credentials', 'credential sharing', 'projects', 'variables', 'role-based access control'],
    offlinePwaPlan: ['Reference secrets by local vault handle', 'Bind workflow access to workspace policy', 'Log credential usage without exposing values'],
    serverlessWorkflowMapping: ['secret references', 'workflow annotations', 'task permissions', 'audit metadata'],
    status: 'planned',
  },
  {
    id: 'templates-environments',
    title: 'Templates and environments',
    summary: 'Reusable workflow templates, import/export, Git-backed environments, tags, and shareable serialized workflows.',
    n8nFeatures: ['templates', 'export/import', 'workflow sharing', 'source control', 'environments'],
    offlinePwaPlan: ['Package workflows as portable JSON files', 'Track template provenance', 'Map local branches to environment names'],
    serverlessWorkflowMapping: ['document namespace', 'version', 'annotations', 'exported JSON/YAML'],
    status: 'foundation',
  },
  {
    id: 'ai-rag-evaluations',
    title: 'AI, RAG, and evaluations',
    summary: 'AI agents, tool use, chains, vector-store retrieval, RAG workflows, memory, and evaluation history.',
    n8nFeatures: ['AI agent', 'AI tool', 'chains', 'vector stores', 'RAG', 'evaluations'],
    offlinePwaPlan: ['Treat agents and local tools as workflow nodes', 'Use browser-local vector stores for retrieval', 'Record eval snapshots beside executions'],
    serverlessWorkflowMapping: ['agent task', 'tool call task', 'retrieval task', 'evaluation checkpoint'],
    status: 'foundation',
  },
];

export function listN8nCapabilityAreas(): N8nCapabilityArea[] {
  return N8N_CAPABILITY_AREAS.map((area) => ({
    ...area,
    n8nFeatures: [...area.n8nFeatures],
    offlinePwaPlan: [...area.offlinePwaPlan],
    serverlessWorkflowMapping: [...area.serverlessWorkflowMapping],
  }));
}

export function buildN8nCapabilitySummary(): N8nCapabilitySummary {
  const areas = listN8nCapabilityAreas();
  return {
    totalAreas: areas.length,
    plannedAreas: countByStatus(areas, 'planned'),
    foundationAreas: countByStatus(areas, 'foundation'),
    readyAreas: countByStatus(areas, 'ready'),
    serializationStandard: SERIALIZATION_STANDARD,
  };
}

export function buildServerlessWorkflowPreview(): ServerlessWorkflowPreview {
  return {
    document: {
      document: {
        dsl: '1.0.3',
        namespace: 'agent-browser.offline-automation',
        name: 'local-dev-workflow',
        version: '0.1.0',
      },
      do: [
        {
          manualTrigger: {
            listen: {
              to: {
                one: {
                  with: {
                    type: 'agent-browser.workflow.manual',
                  },
                },
              },
            },
          },
        },
        {
          runLocalAction: {
            call: 'http',
            with: {
              method: 'POST',
              endpoint: 'local://agent-browser/tools/run',
            },
          },
        },
        {
          queueReview: {
            try: {
              do: [
                {
                  attachEvidence: {
                    call: 'http',
                    with: {
                      method: 'POST',
                      endpoint: 'local://agent-browser/evidence',
                    },
                  },
                },
              ],
              catch: {
                errors: {
                  with: {
                    type: 'https://serverlessworkflow.io/spec/1.0.3/errors/communication',
                  },
                },
                do: [
                  {
                    createReviewItem: {
                      call: 'http',
                      with: {
                        method: 'POST',
                        endpoint: 'local://agent-browser/review-inbox',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    },
    coverage: ['trigger', 'action', 'error-review'],
  };
}

function countByStatus(areas: N8nCapabilityArea[], status: N8nCapabilityStatus): number {
  return areas.filter((area) => area.status === status).length;
}
