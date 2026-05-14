import { describe, expect, it } from 'vitest';
import { ArtifactRegistry, createHarnessExtensionContext } from 'harness-core';

import {
  WORKFLOW_CANVAS_MEDIA_TYPE,
  WorkflowCanvasRenderer,
  createWorkflowCanvasFromServerlessWorkflow,
  createWorkflowCanvasPlugin,
  createWorkflowCanvasRuntimePlan,
  decodeWorkflowCanvasArtifact,
  getWorkflowCanvasFeatureInventory,
  runWorkflowCanvasLocally,
  validateServerlessWorkflowDocument,
} from '@agent-harness/ext-workflow-canvas';
import type { ServerlessWorkflowDocument } from '@agent-harness/ext-workflow-canvas';

const serverlessWorkflow = {
  dsl: '1.0.0',
  namespace: 'agent-harness.automation',
  name: 'campaign-review',
  version: '1.0.0',
  description: 'Generate, review, and publish a campaign asset.',
  do: [
    {
      ingestWebhook: {
        listen: { to: 'campaign.requested' },
        output: { as: '.request' },
      },
    },
    {
      generateDraft: {
        call: 'http.post',
        with: { url: 'https://media.example/generate' },
        retry: { limit: 2 },
        timeout: 'PT2M',
      },
    },
    {
      reviewDraft: {
        call: 'human.review',
        with: { channel: 'slack', message: 'Approve the generated asset.' },
      },
    },
    {
      routeDecision: {
        switch: [
          {
            when: '${ .approved == true }',
            then: [
              {
                publishAsset: {
                  call: 'http.post',
                  with: { url: 'https://cms.example/assets' },
                },
              },
            ],
          },
          {
            when: '${ .approved != true }',
            then: [
              {
                requestRevision: {
                  set: { status: 'needs-revision' },
                },
              },
            ],
          },
        ],
      },
    },
  ],
};

const executableWorkflow = {
  dsl: '1.0.0',
  namespace: 'agent-harness.automation',
  name: 'competitive-campaign-launch',
  version: '1.0.0',
  description: 'Campaign workflow with real bindings, integration references, and deterministic replay.',
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

describe('workflow-canvas extension', () => {
  it('documents n8n, Higgsfield Canvas, and CNCF Serverless Workflow parity targets', () => {
    const inventory = getWorkflowCanvasFeatureInventory();

    expect(inventory.sources.map((source) => source.id)).toEqual([
      'cncf-serverless-workflow',
      'n8n',
      'higgsfield-canvas',
    ]);
    expect(inventory.screenshotReferences.map((screenshot) => screenshot.label)).toEqual([
      'n8n blank workflow canvas',
      'n8n completed tutorial workflow',
      'n8n AI nodes workflow',
      'Higgsfield node composition',
      'Higgsfield multi-model picker',
      'Higgsfield collaboration canvas',
    ]);
    expect(inventory.parityTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({ product: 'n8n', features: expect.arrayContaining(['executions-debugging', 'human-in-the-loop']) }),
      expect.objectContaining({ product: 'Higgsfield Canvas', features: expect.arrayContaining(['multi-model-graph', 'collaboration-comments']) }),
    ]));
  });

  it('validates Serverless Workflow documents and reports actionable issues', () => {
    expect(validateServerlessWorkflowDocument(serverlessWorkflow)).toEqual({
      valid: true,
      issues: [],
      summary: {
        dsl: '1.0.0',
        namespace: 'agent-harness.automation',
        name: 'campaign-review',
        version: '1.0.0',
        taskCount: 6,
        triggerCount: 1,
        branchCount: 1,
        humanReviewCount: 1,
      },
    });
    expect(validateServerlessWorkflowDocument({ ...serverlessWorkflow, dsl: '0.8' })).toMatchObject({
      valid: false,
      issues: ['Workflow dsl must be "1.0.0".'],
    });
    expect(validateServerlessWorkflowDocument({ name: 'missing-do' })).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        'Workflow dsl must be "1.0.0".',
        'Workflow version is required.',
        'Workflow do must contain at least one task.',
      ]),
    });
    expect(validateServerlessWorkflowDocument({
      ...serverlessWorkflow,
      do: [{ broken: 'not-a-task' }],
    })).toMatchObject({
      valid: false,
      issues: ['Task "broken" must be an object.'],
    });
    expect(validateServerlessWorkflowDocument(null)).toMatchObject({
      valid: false,
      issues: ['Workflow must be an object.'],
    });
    expect(validateServerlessWorkflowDocument({
      ...serverlessWorkflow,
      do: [null],
    })).toMatchObject({
      valid: false,
      issues: ['Task entry must be an object.'],
    });
    expect(validateServerlessWorkflowDocument({
      ...serverlessWorkflow,
      do: [{ one: {}, two: {} }],
    })).toMatchObject({
      valid: false,
      issues: ['Task one,two must contain exactly one named step.'],
    });
    expect(validateServerlessWorkflowDocument({
      ...serverlessWorkflow,
      do: [{ choose: { switch: [null, { when: 'otherwise' }, { then: 'bad' }, { then: [null] }] } }],
    })).toMatchObject({
      valid: false,
      issues: [
        'Switch branch choose.0. must be an object.',
        'Switch branch choose.2.then must be a task array.',
        'Task choose.3. must be an object.',
      ],
    });
    expect(validateServerlessWorkflowDocument({
      dsl: '1.0.0',
      name: ' ',
      version: '1.0.0',
      do: [{}],
    })).toMatchObject({
      valid: false,
      issues: [
        'Workflow name is required.',
        'Task entry must contain exactly one named step.',
      ],
    });
    expect(validateServerlessWorkflowDocument({
      ...serverlessWorkflow,
      do: [{ ' ': {} }],
    })).toMatchObject({
      valid: false,
      issues: ['Task entry name is required.'],
    });
    expect(validateServerlessWorkflowDocument({
      ...serverlessWorkflow,
      do: [{ choose: { switch: [{ then: [{ ' ': {} }] }] } }],
    })).toMatchObject({
      valid: false,
      issues: ['Task choose.0. name is required.'],
    });
  });

  it('converts Serverless Workflow tasks into a reusable workflow canvas graph', () => {
    const canvas = createWorkflowCanvasFromServerlessWorkflow(serverlessWorkflow, {
      id: 'campaign-review-canvas',
      title: 'Campaign review',
    });

    expect(canvas).toMatchObject({
      id: 'campaign-review-canvas',
      title: 'Campaign review',
      specVersion: 'cncf-serverless-workflow-1.0',
      source: {
        kind: 'serverless-workflow',
        workflowName: 'campaign-review',
      },
    });
    expect(canvas.nodes.map((node) => [node.id, node.kind])).toEqual([
      ['ingestWebhook', 'trigger'],
      ['generateDraft', 'action'],
      ['reviewDraft', 'human-review'],
      ['routeDecision', 'branch'],
      ['routeDecision.publishAsset', 'action'],
      ['routeDecision.requestRevision', 'transform'],
    ]);
    expect(canvas.edges).toEqual([
      { id: 'ingestWebhook-to-generateDraft', from: 'ingestWebhook', to: 'generateDraft', label: 'next' },
      { id: 'generateDraft-to-reviewDraft', from: 'generateDraft', to: 'reviewDraft', label: 'next' },
      { id: 'reviewDraft-to-routeDecision', from: 'reviewDraft', to: 'routeDecision', label: 'next' },
      { id: 'routeDecision-to-routeDecision.publishAsset', from: 'routeDecision', to: 'routeDecision.publishAsset', label: '${ .approved == true }' },
      { id: 'routeDecision-to-routeDecision.requestRevision', from: 'routeDecision', to: 'routeDecision.requestRevision', label: '${ .approved != true }' },
    ]);
    expect(canvas.executionModel).toEqual(expect.objectContaining({
      engine: 'serverless-workflow',
      retryable: true,
      timeoutAware: true,
      queueModeReady: true,
    }));
    expect(canvas.featureParity).toEqual(expect.arrayContaining([
      expect.objectContaining({ product: 'n8n' }),
      expect.objectContaining({ product: 'Higgsfield Canvas' }),
    ]));

    const mediaCanvas = createWorkflowCanvasFromServerlessWorkflow({
      dsl: '1.0.0',
      name: 'media-demo',
      version: '1.0.0',
      do: [
        { customEvent: {} },
        { imageNode: { call: 'image.generate' } },
        { videoNode: { call: { ref: 'video.generate' } } },
        { objectReview: { call: { ref: 'human.review' } } },
        { objectAction: { call: { ref: 42 } } },
      ],
    });

    expect(mediaCanvas.nodes.map((node) => [node.id, node.kind, node.catalogCategory])).toEqual([
      ['customEvent', 'event', 'Events'],
      ['imageNode', 'media-generation', 'Media generation'],
      ['videoNode', 'media-generation', 'Media generation'],
      ['objectReview', 'human-review', 'Human in the loop'],
      ['objectAction', 'action', 'Actions'],
    ]);

    const branchCanvas = createWorkflowCanvasFromServerlessWorkflow({
      dsl: '1.0.0',
      name: 'branch-demo',
      version: '1.0.0',
      do: [
        {
          route: {
            switch: [
              { then: [{ timedMedia: { call: 'media.render', timeout: 'PT1M' } }] },
              { when: 'empty path' },
            ],
          },
        },
      ],
    });

    expect(branchCanvas.id).toBe('branch-demo');
    expect(branchCanvas.executionModel.timeoutAware).toBe(true);
    expect(branchCanvas.edges).toEqual([
      { id: 'route-to-route.timedMedia', from: 'route', to: 'route.timedMedia', label: 'else' },
    ]);
    expect(createWorkflowCanvasFromServerlessWorkflow({
      dsl: '1.0.0',
      name: '###',
      version: '1.0.0',
      do: [{ start: {} }],
    }, { id: ' ### ' }).id).toBe('workflow-canvas');
  });

  it('registers marketplace-usable tools and command for persisted workflow canvases', async () => {
    const context = createHarnessExtensionContext();
    await context.plugins.load(createWorkflowCanvasPlugin());

    const created = await context.tools.execute('workflow-canvas.create', {
      id: 'campaign-canvas',
      title: 'Campaign canvas',
      workflow: serverlessWorkflow,
    });
    const untitled = await context.tools.execute('workflow-canvas.create', {
      workflow: serverlessWorkflow,
    });
    const read = await context.tools.execute('workflow-canvas.read', { id: 'campaign-canvas' });
    const exported = await context.tools.execute('workflow-canvas.export', { id: 'campaign-canvas' });
    const listed = await context.tools.execute('workflow-canvas.inventory', {});
    const validated = await context.tools.execute('workflow-canvas.validate', { workflow: serverlessWorkflow });

    expect(created).toMatchObject({
      id: 'campaign-canvas',
      title: 'Campaign canvas',
      mediaType: WORKFLOW_CANVAS_MEDIA_TYPE,
      nodeCount: 6,
      edgeCount: 5,
    });
    expect(untitled).toMatchObject({
      id: 'campaign-review',
      title: 'Generate, review, and publish a campaign asset.',
    });
    expect(read).toMatchObject({
      id: 'campaign-canvas',
      workflow: expect.objectContaining({ name: 'campaign-review' }),
      canvas: expect.objectContaining({ nodes: expect.arrayContaining([expect.objectContaining({ id: 'reviewDraft' })]) }),
    });
    expect(exported).toEqual({
      format: 'serverless-workflow+json',
      workflow: expect.objectContaining({ dsl: '1.0.0', name: 'campaign-review' }),
    });
    expect(listed).toEqual(expect.objectContaining({
      sources: expect.arrayContaining([expect.objectContaining({ id: 'n8n' })]),
    }));
    expect(validated).toEqual(expect.objectContaining({ valid: true }));
    await expect(context.tools.execute('workflow-canvas.read', {})).rejects.toThrow('Workflow canvas id is required.');
    await expect(context.tools.execute('workflow-canvas.read', { id: 'missing' })).rejects.toThrow('Unknown workflow canvas: missing');
    await expect(context.tools.execute('workflow-canvas.create', { workflow: { name: 'bad' } })).rejects.toThrow('Invalid Serverless Workflow document');
    await expect(context.tools.execute('workflow-canvas.export', { workflow: serverlessWorkflow })).resolves.toMatchObject({
      workflow: expect.objectContaining({ name: 'campaign-review' }),
    });
    await expect(context.tools.execute('workflow-canvas.export', { id: 'missing' })).rejects.toThrow('Unknown workflow canvas: missing');
    await context.artifacts.create({
      id: 'raw-canvas',
      data: new Uint8Array([1, 2, 3]),
      mediaType: WORKFLOW_CANVAS_MEDIA_TYPE,
    });
    await expect(context.tools.execute('workflow-canvas.read', { id: 'raw-canvas' })).rejects.toThrow('Workflow canvas artifact data must be JSON.');
    const bareCanvas = createWorkflowCanvasFromServerlessWorkflow(serverlessWorkflow, { title: 'Bare canvas' });
    await context.artifacts.create({
      id: 'bare-canvas',
      data: JSON.stringify({ canvas: bareCanvas, workflow: bareCanvas.workflow }),
    });
    await expect(context.tools.execute('workflow-canvas.read', { id: 'bare-canvas' })).resolves.toMatchObject({
      title: 'Bare canvas',
      mediaType: null,
    });
    await expect(context.commands.execute('/workflow campaign approvals')).resolves.toMatchObject({
      matched: true,
      commandId: 'workflow-canvas.new',
      result: { type: 'prompt', prompt: expect.stringContaining('campaign approvals') },
    });
    await expect(context.commands.execute('/workflow')).resolves.toMatchObject({
      matched: true,
      commandId: 'workflow-canvas.new',
      result: { type: 'prompt', prompt: expect.stringContaining('a new automation') },
    });

    const brokenArtifacts = new ArtifactRegistry({
      remoteHandlers: {
        default: {
          read: () => {
            throw new Error('storage down');
          },
        },
      },
    });
    brokenArtifacts.registerRemote({ id: 'remote-canvas', uri: 'artifact://remote-canvas' });
    const brokenContext = createHarnessExtensionContext({ artifacts: brokenArtifacts });
    await brokenContext.plugins.load(createWorkflowCanvasPlugin());
    await expect(brokenContext.tools.execute('workflow-canvas.read', { id: 'remote-canvas' })).rejects.toThrow('storage down');
  });

  it('registers bindings, integration readiness, and deterministic workflow run tools', async () => {
    const context = createHarnessExtensionContext();
    await context.plugins.load(createWorkflowCanvasPlugin());

    await context.tools.execute('workflow-canvas.create', {
      id: 'competitive-canvas',
      title: 'Competitive campaign launch',
      workflow: executableWorkflow,
    });

    const runtimePlan = await context.tools.execute('workflow-canvas.bindings', {
      id: 'competitive-canvas',
      input: {
        goal: 'Launch workflow canvas runtime',
        channels: ['email', 'social'],
      },
      credentials: {
        'credential:cms-production': 'configured',
        'model:gpt-image': 'configured',
      },
    });

    expect(runtimePlan).toMatchObject({
      workflowName: 'competitive-campaign-launch',
      bindingCount: 9,
      integrationCount: 6,
      readyIntegrationCount: 6,
      gaps: [],
    });
    expect(runtimePlan).toEqual(expect.objectContaining({
      bindings: expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'researchAgent',
          target: 'with.goal',
          expression: '${ .request.goal }',
          sourcePath: '.request.goal',
          sourceNodeId: 'webhookIntake',
          preview: 'Launch workflow canvas runtime',
        }),
        expect.objectContaining({
          nodeId: 'routeDecision',
          target: 'switch.0.when',
          expression: '${ .approved == true }',
          sourcePath: '.approved',
          sourceNodeId: 'humanApproval',
          preview: null,
        }),
      ]),
      integrations: expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'generateCampaignMedia',
          provider: 'Higgsfield Canvas',
          kind: 'model',
          credentialRef: 'model:gpt-image',
          status: 'ready',
        }),
        expect.objectContaining({
          nodeId: 'routeDecision.publishCampaign',
          provider: 'n8n',
          kind: 'http',
          credentialRef: 'credential:cms-production',
          status: 'ready',
        }),
      ]),
    }));

    const missingCredentials = await context.tools.execute('workflow-canvas.integrations', {
      workflow: executableWorkflow,
    });
    expect(missingCredentials).toEqual(expect.objectContaining({
      readyIntegrationCount: 4,
      gaps: [
        'Integration generateCampaignMedia needs credential reference model:gpt-image.',
        'Integration routeDecision.publishCampaign needs credential reference credential:cms-production.',
      ],
    }));

    const run = await context.tools.execute('workflow-canvas.run', {
      id: 'competitive-canvas',
      input: {
        goal: 'Launch workflow canvas runtime',
        channels: ['email', 'social'],
      },
      approvals: { humanApproval: true },
      credentials: {
        'credential:cms-production': 'configured',
        'model:gpt-image': 'configured',
      },
      now: '2026-05-14T12:00:00.000Z',
    });

    expect(run).toMatchObject({
      runId: 'competitive-campaign-launch-2026-05-14T12-00-00-000Z',
      status: 'success',
      stepCount: 7,
      finalState: {
        request: {
          goal: 'Launch workflow canvas runtime',
          channels: ['email', 'social'],
        },
        research: {
          audience: 'Campaign operators',
          visualPrompt: 'Launch workflow canvas runtime for email, social',
        },
        visualPrompt: 'Launch workflow canvas runtime for email, social',
        approved: true,
        publishResult: {
          status: 202,
          url: 'https://cms.example/campaigns',
        },
      },
      executionArtifactId: 'competitive-canvas-run-competitive-campaign-launch-2026-05-14T12-00-00-000Z',
    });
    expect(run).toEqual(expect.objectContaining({
      steps: expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'researchAgent',
          status: 'success',
          integrationId: 'researchAgent:agent',
          bindings: [
            expect.objectContaining({ target: 'with.goal', value: 'Launch workflow canvas runtime' }),
            expect.objectContaining({ target: 'with.channels', value: ['email', 'social'] }),
          ],
        }),
        expect.objectContaining({
          nodeId: 'routeDecision.requestRevision',
          status: 'skipped',
          skippedReason: 'Branch condition did not match: ${ .approved != true }',
        }),
      ]),
    }));

    const runArtifact = await context.artifacts.read('competitive-canvas-run-competitive-campaign-launch-2026-05-14T12-00-00-000Z');
    expect(runArtifact).toMatchObject({
      mediaType: WORKFLOW_CANVAS_MEDIA_TYPE,
      metadata: {
        artifactKind: 'workflow-canvas-run',
        workflowName: 'competitive-campaign-launch',
        status: 'success',
      },
    });
    expect(JSON.parse(runArtifact!.data as string)).toMatchObject({
      run: expect.objectContaining({
        status: 'success',
        finalState: expect.objectContaining({ approved: true }),
      }),
    });

    await expect(context.tools.execute('workflow-canvas.run', {})).rejects.toThrow('Workflow canvas run needs a workflow or canvas id.');
    await expect(context.tools.execute('workflow-canvas.bindings', { id: 'missing' })).rejects.toThrow('Unknown workflow canvas: missing');
  });

  it('covers runtime adapter fallbacks, blocked runs, default outputs, and branch behavior', () => {
    const fallbackWorkflow: ServerlessWorkflowDocument = {
      dsl: '1.0.0',
      name: 'runtime-fallbacks',
      version: '1.0.0',
      do: [
        {
          intake: {
            listen: {},
          },
        },
        {
          arrayBindings: {
            call: { ref: 'agent.research' },
            with: {
              goal: '${ .event.goal.deep }',
              tags: ['${ .event.goal }'],
            },
          },
        },
        {
          mediaFallback: {
            call: { ref: 'image.generate' },
            with: { prompt: '${ .research.visualPrompt }' },
          },
        },
        {
          mediaAlt: {
            call: { ref: 'image.generate' },
            with: { prompt: 'alternate asset' },
            output: { as: '.campaign.alt' },
          },
        },
        {
          approveDefault: {
            call: 'human.review',
          },
        },
        {
          noCredentialHttp: {
            call: 'http.post',
            with: { url: '', body: null },
          },
        },
        {
          unknownCall: {
            call: {},
          },
        },
        {
          passiveEvent: {},
        },
        {
          scalarSet: {
            set: '${ .publishResult.status }',
          },
        },
        {
          chooseNoMatch: {
            switch: [
              {
                when: '${ .approved === true }',
                then: [
                  {
                    unreachable: {
                      switch: [
                        {
                          then: [{ deepUnreachable: { set: { never: true } } }],
                        },
                      ],
                    },
                  },
                ],
              },
              {
                when: 'manual condition',
                then: [{ alsoUnreachable: { set: { never: 'manual' } } }],
              },
            ],
          },
        },
        {
          chooseElse: {
            switch: [
              {
                then: [{ fallbackPath: { set: { status: 'else-ran' } } }],
              },
            ],
          },
        },
        {
          sourceLessBinding: {
            call: 'http.post',
            with: { url: '${ true }' },
          },
        },
      ],
    };

    const blocked = runWorkflowCanvasLocally(fallbackWorkflow, {
      input: { goal: 'fallback launch' },
      now: 'bad timestamp',
    });
    expect(blocked.status).toBe('blocked');
    expect(blocked.steps).toHaveLength(0);
    expect(blocked.issues).toEqual([
      'Integration mediaFallback needs credential reference model:gpt-image.',
      'Integration mediaAlt needs credential reference model:gpt-image.',
      'Integration noCredentialHttp needs credential reference credential:nocredentialhttp.',
      'Integration sourceLessBinding needs credential reference credential:sourcelessbinding.',
    ]);

    const plan = createWorkflowCanvasRuntimePlan(fallbackWorkflow, {
      input: { goal: 'fallback launch' },
      credentials: {
        'model:gpt-image': 'configured',
        'credential:nocredentialhttp': 'configured',
        'credential:sourcelessbinding': 'configured',
      },
    });
    expect(plan.bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        nodeId: 'arrayBindings',
        target: 'with.goal',
        sourcePath: '.event.goal.deep',
        sourceNodeId: 'intake',
        preview: null,
      }),
      expect.objectContaining({
        nodeId: 'arrayBindings',
        target: 'with.tags.0',
        sourcePath: '.event.goal',
        preview: 'fallback launch',
      }),
      expect.objectContaining({
        nodeId: 'chooseNoMatch',
        target: 'switch.0.when',
        sourcePath: '.approved',
      }),
      expect.objectContaining({
        nodeId: 'sourceLessBinding',
        target: 'with.url',
        sourcePath: '',
        sourceNodeId: null,
        preview: null,
      }),
    ]));
    expect(plan.integrations).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'intake', operation: 'manual.trigger' }),
      expect.objectContaining({ nodeId: 'mediaFallback', credentialRef: 'model:gpt-image', status: 'ready' }),
      expect.objectContaining({ nodeId: 'noCredentialHttp', credentialRef: 'credential:nocredentialhttp' }),
      expect.objectContaining({ nodeId: 'unknownCall', operation: 'unknown.call' }),
    ]));

    const run = runWorkflowCanvasLocally(fallbackWorkflow, {
      input: { goal: 'fallback launch' },
      credentials: {
        'model:gpt-image': 'configured',
        'credential:nocredentialhttp': 'configured',
        'credential:sourcelessbinding': 'configured',
      },
      now: '2026-05-14T13:00:00.000Z',
    });

    expect(run).toMatchObject({
      status: 'success',
      runId: 'runtime-fallbacks-2026-05-14T13-00-00-000Z',
      finalState: {
        event: { goal: 'fallback launch' },
        approved: true,
        status: 'else-ran',
      },
    });
    expect(run.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        nodeId: 'arrayBindings',
        output: expect.objectContaining({
          visualPrompt: 'Launch workflow canvas runtime for owned channels',
        }),
        bindings: expect.arrayContaining([
          expect.objectContaining({ target: 'with.tags.0', value: 'fallback launch' }),
        ]),
      }),
      expect.objectContaining({
        nodeId: 'noCredentialHttp',
        output: {
          status: 202,
          url: 'https://example.invalid',
          body: null,
          credentialRef: null,
        },
      }),
      expect.objectContaining({
        nodeId: 'unknownCall',
        output: { ref: 'unknown.call', nodeId: 'unknownCall', args: {} },
      }),
      expect.objectContaining({
        nodeId: 'chooseNoMatch',
        output: { branch: null },
      }),
      expect.objectContaining({
        nodeId: 'chooseNoMatch.unreachable',
        status: 'skipped',
        skippedReason: 'Branch condition did not match: ${ .approved === true }',
      }),
      expect.objectContaining({
        nodeId: 'chooseNoMatch.unreachable.deepUnreachable',
        status: 'skipped',
      }),
      expect.objectContaining({
        nodeId: 'chooseNoMatch.alsoUnreachable',
        status: 'skipped',
        skippedReason: 'Branch condition did not match: manual condition',
      }),
      expect.objectContaining({
        nodeId: 'chooseElse.fallbackPath',
        status: 'success',
      }),
      expect.objectContaining({
        nodeId: 'sourceLessBinding',
        bindings: [expect.objectContaining({ target: 'with.url', value: null })],
      }),
    ]));
  });

  it('normalizes stored workflow canvas artifacts and exposes an installable renderer component', () => {
    const canvas = createWorkflowCanvasFromServerlessWorkflow(serverlessWorkflow);
    const decoded = decodeWorkflowCanvasArtifact(JSON.stringify({
      canvas,
      workflow: serverlessWorkflow,
    }));
    const fromObject = decodeWorkflowCanvasArtifact({
      canvas: { ...canvas, specVersion: 'older' } as unknown as typeof canvas,
      workflow: serverlessWorkflow as unknown as ServerlessWorkflowDocument,
    });

    expect(decoded.canvas.id).toBe('campaign-review');
    expect(decoded.workflow.name).toBe('campaign-review');
    expect(fromObject.canvas.specVersion).toBe('cncf-serverless-workflow-1.0');
    expect(() => decodeWorkflowCanvasArtifact('null')).toThrow('Workflow canvas artifact must be an object.');
    expect(() => decodeWorkflowCanvasArtifact(JSON.stringify({ canvas }))).toThrow('Workflow canvas artifact needs a Serverless Workflow document.');
    expect(() => createWorkflowCanvasFromServerlessWorkflow({ ...serverlessWorkflow, do: [] })).toThrow('Invalid Serverless Workflow document');
    expect(WorkflowCanvasRenderer).toBeTypeOf('function');
    expect(WorkflowCanvasRenderer.name).toBe('WorkflowCanvasRenderer');
  });
});
