import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  WorkflowCanvasRenderer,
  type WorkflowCanvasWorkspaceFile,
} from '@agent-harness/ext-workflow-canvas';

afterEach(() => {
  cleanup();
});

function RendererFixture({
  initialFiles = [],
  onFilesChange = () => undefined,
}: {
  initialFiles?: WorkflowCanvasWorkspaceFile[];
  onFilesChange?: (files: WorkflowCanvasWorkspaceFile[]) => void;
}) {
  const [files, setFiles] = useState(initialFiles);
  return (
    <WorkflowCanvasRenderer
      workspaceName="Research"
      workspaceFiles={files}
      onWorkspaceFilesChange={(nextFiles) => {
        onFilesChange(nextFiles);
        setFiles(nextFiles);
      }}
    />
  );
}

describe('WorkflowCanvasRenderer', () => {
  it('renders the installable workflow canvas workbench and exercises every pane feature', () => {
    const savedFileSets: WorkflowCanvasWorkspaceFile[][] = [];
    render(<RendererFixture onFilesChange={(files) => savedFileSets.push(files)} />);

    const workbench = screen.getByRole('region', { name: 'Workflow canvas workbench' });
    expect(screen.getByTestId('workflow-canvas-plugin-renderer').dataset.pluginId).toBe('agent-harness.ext.workflow-canvas');
    expect(workbench.textContent).toContain('Research');
    expect(workbench.textContent).toContain('Campaign launch workflow');
    expect(within(workbench).getByRole('region', { name: 'Workflow node catalog' }).textContent).toContain('Webhook trigger');
    expect(within(workbench).getByRole('region', { name: 'Workflow node catalog' }).textContent).toContain('AI agent');
    expect(within(workbench).getByRole('region', { name: 'Workflow node catalog' }).textContent).toContain('Media generation');
    expect(within(workbench).getByLabelText('Workflow canvas feature plan').textContent).toContain('Node inspector');

    const canvas = within(workbench).getByRole('region', { name: 'Workflow orchestration canvas' });
    for (const nodeName of [
      'Webhook intake',
      'Research agent',
      'Normalize brief',
      'Generate campaign media',
      'Human approval',
      'Route decision',
      'Publish campaign',
      'Request revision',
    ]) {
      fireEvent.click(within(canvas).getByRole('button', { name: `Inspect ${nodeName}` }));
      expect(within(workbench).getByRole('region', { name: 'Workflow node inspector' }).textContent).toContain(nodeName);
    }

    fireEvent.click(within(canvas).getByRole('button', { name: 'Inspect Generate campaign media' }));
    const inspector = within(workbench).getByRole('region', { name: 'Workflow node inspector' });
    expect(inspector.textContent).toContain('Credit estimate: 4 image credits');
    expect(inspector.textContent).toContain('Source: Higgsfield Canvas');

    expect(within(workbench).getByRole('region', { name: 'Workflow execution replay' }).textContent).toContain('Execution replay');
    expect(within(workbench).getByRole('region', { name: 'Workflow integration readiness' }).textContent).toContain('6/6 ready');
    expect(within(workbench).getByRole('region', { name: 'Workflow binding map' }).textContent).toContain('9 data bindings');
    expect(within(canvas).getByText('Draft ready')).toBeTruthy();
    fireEvent.click(within(workbench).getByRole('button', { name: 'Run workflow' }));
    expect(within(workbench).getByRole('region', { name: 'Workflow execution replay' }).textContent).toContain('Run complete');
    expect(within(workbench).getByRole('region', { name: 'Workflow execution replay' }).textContent).toContain('researchAgent');
    expect(within(workbench).getByRole('region', { name: 'Workflow execution replay' }).textContent).toContain('publishCampaign');
    expect(within(workbench).getByRole('region', { name: 'Workflow binding map' }).textContent).toContain('with.goal');
    expect(within(workbench).getByRole('region', { name: 'Workflow binding map' }).textContent).toContain('Launch workflow canvas runtime');
    expect(within(canvas).getByText('7/8 complete')).toBeTruthy();
    fireEvent.click(within(workbench).getByRole('button', { name: 'Reset workflow replay' }));
    expect(within(canvas).getByText('Draft ready')).toBeTruthy();

    expect(within(workbench).getByRole('region', { name: 'Saved workflow canvases' }).textContent).toContain('No saved canvases yet');
    fireEvent.click(within(workbench).getByRole('button', { name: 'Save canvas artifact' }));
    fireEvent.click(within(workbench).getByRole('button', { name: 'Save canvas artifact' }));
    expect(within(workbench).getByRole('status', { name: 'Workflow canvas save status' }).textContent).toContain(
      'Saved workflow-canvas/campaign-launch.json',
    );
    expect(within(workbench).getByRole('region', { name: 'Saved workflow canvases' }).textContent).toContain(
      'workflow-canvas/campaign-launch.json',
    );

    expect(savedFileSets).toHaveLength(2);
    expect(savedFileSets.at(-1)).toHaveLength(1);
    expect(savedFileSets.at(-1)![0]).toMatchObject({
      extensionOwnership: {
        extensionId: 'agent-harness.ext.workflow-canvas',
        extensionName: 'Workflow canvas orchestration',
        locked: true,
      },
    });
    const savedArtifact = JSON.parse(savedFileSets.at(-1)![0]!.content) as {
      mediaType: string;
      canvas: { nodes: unknown[]; edges: unknown[] };
      featurePlan: unknown[];
      runtimePlan: { integrationCount: number; bindingCount: number };
      lastRun: { status: string } | null;
      research: { screenshotReferences: unknown[] };
    };
    expect(savedArtifact.mediaType).toBe('application/vnd.agent-harness.workflow-canvas+json');
    expect(savedArtifact.canvas.nodes).toHaveLength(8);
    expect(savedArtifact.canvas.edges).toHaveLength(7);
    expect(savedArtifact.featurePlan).toHaveLength(6);
    expect(savedArtifact.runtimePlan).toMatchObject({ integrationCount: 6, bindingCount: 9 });
    expect(savedArtifact.lastRun).toBeNull();
    expect(savedArtifact.research.screenshotReferences).toHaveLength(6);
  }, 60000);

  it('runs a deterministic workflow with binding and integration evidence and saves the replay', () => {
    const savedFileSets: WorkflowCanvasWorkspaceFile[][] = [];
    render(<RendererFixture onFilesChange={(files) => savedFileSets.push(files)} />);

    const workbench = screen.getByRole('region', { name: 'Workflow canvas workbench' });
    const canvas = within(workbench).getByRole('region', { name: 'Workflow orchestration canvas' });

    fireEvent.click(within(workbench).getByRole('button', { name: 'Run workflow' }));
    expect(within(canvas).getByText('7/8 complete')).toBeTruthy();
    expect(within(workbench).getByRole('region', { name: 'Workflow execution replay' }).textContent).toContain('Run complete');
    expect(within(workbench).getByRole('region', { name: 'Workflow execution replay' }).textContent).toContain('success');
    expect(within(workbench).getByRole('region', { name: 'Workflow integration readiness' }).textContent).toContain('Higgsfield Canvas');
    expect(within(workbench).getByRole('region', { name: 'Workflow integration readiness' }).textContent).toContain('model:gpt-image');
    expect(within(workbench).getByRole('region', { name: 'Workflow binding map' }).textContent).toContain('.request.goal');
    expect(within(workbench).getByRole('region', { name: 'Workflow binding map' }).textContent).toContain('Launch workflow canvas runtime');

    fireEvent.click(within(canvas).getByRole('button', { name: 'Inspect Research agent' }));
    const inspector = within(workbench).getByRole('region', { name: 'Workflow node inspector' });
    expect(inspector.textContent).toContain('Binding with.goal');
    expect(inspector.textContent).toContain('.request.goal');
    expect(inspector.textContent).toContain('Integration Agent Harness');
    expect(inspector.textContent).toContain('agent.research');

    fireEvent.click(within(canvas).getByRole('button', { name: 'Inspect Route decision' }));
    expect(inspector.textContent).toContain('Binding switch.0.when');
    expect(inspector.textContent).toContain('null');

    fireEvent.click(within(workbench).getByRole('button', { name: 'Save canvas artifact' }));
    const savedArtifact = JSON.parse(savedFileSets.at(-1)![0]!.content) as {
      runtimePlan: { integrations: Array<{ credentialRef?: string }>; bindings: Array<{ sourcePath: string }> };
      lastRun: { status: string; finalState: { approved: boolean; publishResult: { status: number } } };
    };
    expect(savedArtifact.runtimePlan.integrations).toEqual(expect.arrayContaining([
      expect.objectContaining({ credentialRef: 'model:gpt-image' }),
      expect.objectContaining({ credentialRef: 'credential:cms-production' }),
    ]));
    expect(savedArtifact.runtimePlan.bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourcePath: '.request.goal' }),
    ]));
    expect(savedArtifact.lastRun).toMatchObject({
      status: 'success',
      finalState: {
        approved: true,
        publishResult: { status: 202 },
      },
    });
  });

  it('creates a prompt-backed widget from the canvas context menu and persists it with the artifact', () => {
    const savedFileSets: WorkflowCanvasWorkspaceFile[][] = [];
    render(<RendererFixture onFilesChange={(files) => savedFileSets.push(files)} />);

    const workbench = screen.getByRole('region', { name: 'Workflow canvas workbench' });
    const canvas = within(workbench).getByRole('region', { name: 'Workflow orchestration canvas' });
    fireEvent.contextMenu(canvas, { clientX: 420, clientY: 210 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create Widget' }));

    const dialog = screen.getByRole('dialog', { name: 'Create workflow widget' });
    const createButton = within(dialog).getByRole('button', { name: 'Create widget' }) as HTMLButtonElement;
    expect(createButton.disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText('Widget prompt'), {
      target: { value: 'Track launch blockers by owner and urgency' },
    });
    fireEvent.click(createButton);

    const widgetButton = within(canvas).getByRole('button', { name: 'Inspect Track launch blockers widget' });
    expect(widgetButton).toBeTruthy();
    const inspector = within(workbench).getByRole('region', { name: 'Workflow node inspector' });
    expect(inspector.textContent).toContain('Track launch blockers');
    expect(inspector.textContent).toContain('Prompt-backed, local canvas widget');

    fireEvent.click(within(workbench).getByRole('button', { name: 'Save canvas artifact' }));
    const savedArtifact = JSON.parse(savedFileSets.at(-1)![0]!.content) as {
      widgets: Array<{ title: string; prompt: string }>;
    };
    expect(savedArtifact.widgets).toEqual([
      expect.objectContaining({
        title: 'Track launch blockers',
        prompt: 'Track launch blockers by owner and urgency',
      }),
    ]);

    fireEvent.click(within(canvas).getByRole('button', { name: 'Inspect Webhook intake' }));
    expect(inspector.textContent).toContain('Webhook intake');
    fireEvent.click(widgetButton);
    expect(inspector.textContent).toContain('Track launch blockers');
  });

  it('cancels the canvas widget prompt without adding a widget', () => {
    render(<RendererFixture />);

    const workbench = screen.getByRole('region', { name: 'Workflow canvas workbench' });
    const canvas = within(workbench).getByRole('region', { name: 'Workflow orchestration canvas' });
    fireEvent.contextMenu(canvas, { clientX: 160, clientY: 120 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create Widget' }));

    const dialog = screen.getByRole('dialog', { name: 'Create workflow widget' });
    fireEvent.submit(dialog.querySelector('form')!);
    expect(screen.getByRole('dialog', { name: 'Create workflow widget' })).toBeTruthy();
    expect(within(canvas).queryByRole('button', { name: /^Inspect .* widget$/i })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Create workflow widget' })).toBeNull();
    expect(within(canvas).queryByRole('button', { name: /^Inspect .* widget$/i })).toBeNull();
  });

  it('supports default renderer props for artifact previews without workspace mutation hooks', () => {
    render(<WorkflowCanvasRenderer />);

    const workbench = screen.getByRole('region', { name: 'Workflow canvas workbench' });
    expect(workbench.textContent).toContain('Workflow workspace');
    fireEvent.click(within(workbench).getByRole('button', { name: 'Save canvas artifact' }));
    expect(within(workbench).getByRole('status', { name: 'Workflow canvas save status' }).textContent).toContain(
      'Saved workflow-canvas/campaign-launch.json',
    );
  });

  it('sorts existing saved workflow canvas artifacts in the inspector', () => {
    render(
      <RendererFixture
        initialFiles={[
          { path: 'workflow-canvas/zeta.json', content: '{}', updatedAt: '2026-05-11T00:00:00.000Z' },
          { path: 'notes/readme.md', content: 'ignore me', updatedAt: '2026-05-11T00:00:00.000Z' },
          { path: 'workflow-canvas/alpha.json', content: '{}', updatedAt: '2026-05-11T00:00:00.000Z' },
        ]}
      />,
    );

    const savedListText = screen.getByRole('region', { name: 'Saved workflow canvases' }).textContent ?? '';
    expect(savedListText.indexOf('workflow-canvas/alpha.json')).toBeLessThan(
      savedListText.indexOf('workflow-canvas/zeta.json'),
    );
    expect(savedListText).not.toContain('notes/readme.md');
  });
});
