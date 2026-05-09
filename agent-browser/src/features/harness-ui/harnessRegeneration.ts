import { assertHarnessElementAllowedByCatalog } from './harnessCatalog';
import { createDefaultHarnessAppSpec } from './harnessSpec';
import type {
  HarnessAppSpec,
  HarnessElement,
  HarnessRegenerationResult,
  JsonValue,
} from './types';

type RegenerateHarnessAppSpecInput = {
  spec: HarnessAppSpec;
  prompt: string;
  workspaceId: string;
  workspaceName: string;
};

type RestoreDefaultHarnessAppSpecInput = Omit<RegenerateHarnessAppSpecInput, 'prompt'>;

function bumpMetadata(spec: HarnessAppSpec, previousRevision: number): HarnessAppSpec {
  return {
    ...spec,
    metadata: {
      ...spec.metadata,
      designSystemId: 'agent-browser/current',
      revision: previousRevision + 1,
    },
  };
}

function patchElement(
  spec: HarnessAppSpec,
  elementId: string,
  props: Record<string, JsonValue>,
): HarnessAppSpec {
  const current = spec.elements[elementId];
  if (!current) return spec;

  const nextElement: HarnessElement = {
    ...current,
    props: {
      ...(current.props ?? {}),
      ...props,
    },
  };
  assertHarnessElementAllowedByCatalog(nextElement);
  return {
    ...spec,
    elements: {
      ...spec.elements,
      [elementId]: nextElement,
    },
  };
}

function nextGeneratedId(spec: HarnessAppSpec, baseId: string): string {
  let index = spec.metadata.revision + 1;
  let candidate = `${baseId}-${index}`;
  while (spec.elements[candidate]) {
    index += 1;
    candidate = `${baseId}-${index}`;
  }
  return candidate;
}

function titleFromPrompt(prompt: string): string {
  if (/\bknowledge|memory|steering|graph/i.test(prompt)) return 'Knowledge';
  if (/\bstorage|asset|artifact|file|workspace file/i.test(prompt)) return 'Session storage';
  if (/\bruntime|tool|cwd|model|provider/i.test(prompt)) return 'Runtime context';
  if (/\bactivity|history|handoff|transcript/i.test(prompt)) return 'Session activity';
  return 'Session summary';
}

function typeFromPrompt(prompt: string): HarnessElement['type'] {
  if (/\bknowledge|memory|steering|graph/i.test(prompt)) return 'KnowledgeGraphWidget';
  if (/\bstorage|asset|artifact|file|workspace file/i.test(prompt)) return 'SessionStorageAssets';
  if (/\bruntime|tool|cwd|model|provider/i.test(prompt)) return 'SessionRuntime';
  if (/\bactivity|history|handoff|transcript/i.test(prompt)) return 'SessionActivity';
  return 'SessionConversationSummary';
}

function generatedBaseId(prompt: string): string {
  if (/\bknowledge|memory|steering|graph/i.test(prompt)) return 'generated-knowledge-widget';
  if (/\bstorage|asset|artifact|file|workspace file/i.test(prompt)) return 'generated-session-storage-widget';
  if (/\bruntime|tool|cwd|model|provider/i.test(prompt)) return 'generated-runtime-context-widget';
  if (/\bactivity|history|handoff|transcript/i.test(prompt)) return 'generated-session-activity-widget';
  return 'generated-session-summary-widget';
}

function addGeneratedDashboardWidget(spec: HarnessAppSpec, prompt: string): HarnessAppSpec {
  const id = nextGeneratedId(spec, generatedBaseId(prompt));
  const widget: HarnessElement = {
    id,
    type: typeFromPrompt(prompt),
    slot: 'dashboard.canvas',
    editable: true,
    props: {
      title: titleFromPrompt(prompt),
      sessionId: 'active',
      position: { col: 1, row: 2 },
      size: { cols: 5, rows: 3 },
      emptyLabel: 'Nothing to show yet',
    },
  };
  assertHarnessElementAllowedByCatalog(widget);

  const dashboard = spec.elements['main-dashboard'];
  if (!dashboard) return spec;

  return {
    ...spec,
    elements: {
      ...spec.elements,
      [id]: widget,
      'main-dashboard': {
        ...dashboard,
        children: [...(dashboard.children ?? []), id],
      },
    },
  };
}

export function regenerateHarnessAppSpec({
  spec,
  prompt,
  workspaceId,
  workspaceName,
}: RegenerateHarnessAppSpecInput): HarnessRegenerationResult {
  const normalizedPrompt = prompt.trim();
  const lowerPrompt = normalizedPrompt.toLowerCase();
  let next: HarnessAppSpec = {
    ...spec,
    metadata: {
      ...spec.metadata,
      workspaceId,
      workspaceName: workspaceName.trim() || spec.metadata.workspaceName,
      createdBy: 'agent-browser',
      designSystemId: 'agent-browser/current',
    },
  };
  const summary: string[] = [];

  if (!normalizedPrompt) {
    return { spec, summary: 'No harness changes were requested.' };
  }

  if (/\bcompact\b/.test(lowerPrompt) && /\bsidebar|workspace tree|left pane\b/.test(lowerPrompt)) {
    next = patchElement(next, 'workspace-sidebar', { density: 'compact' });
    summary.push('Updated the workspace sidebar density.');
  }

  if (/\bcomfortable\b/.test(lowerPrompt) && /\bsidebar|workspace tree|left pane\b/.test(lowerPrompt)) {
    next = patchElement(next, 'workspace-sidebar', { density: 'comfortable' });
    summary.push('Updated the workspace sidebar density.');
  }

  if (/\bcopilot dock\b/.test(lowerPrompt) || /\brename\b.*\bassistant\b.*\bcopilot\b/.test(lowerPrompt)) {
    next = patchElement(next, 'assistant-dock', { title: 'Copilot dock' });
    summary.push('Renamed the assistant dock.');
  }

  if (/\bhide\b.*\bfiles?\b/.test(lowerPrompt)) {
    next = patchElement(next, 'files-tree-section', { visible: false });
    summary.push('Hid the files section.');
  }

  if (/\bshow\b.*\bfiles?\b/.test(lowerPrompt)) {
    next = patchElement(next, 'files-tree-section', { visible: true });
    summary.push('Showed the files section.');
  }

  if (/\badd\b.*\bwidget\b|\bcreate\b.*\bwidget\b/.test(lowerPrompt)) {
    next = addGeneratedDashboardWidget(next, normalizedPrompt);
    summary.push('Added a catalog-backed dashboard widget.');
  }

  if (!summary.length) {
    next = patchElement(next, 'main-dashboard', { title: `${workspaceName.trim() || 'Workspace'} harness` });
    summary.push('Regenerated the harness without changing its component catalog.');
  }

  return {
    spec: bumpMetadata(next, spec.metadata.revision),
    summary: summary.join(' '),
  };
}

export function restoreDefaultHarnessAppSpec({
  spec,
  workspaceId,
  workspaceName,
}: RestoreDefaultHarnessAppSpecInput): HarnessRegenerationResult {
  const restored = createDefaultHarnessAppSpec({ workspaceId, workspaceName });
  return {
    spec: bumpMetadata(restored, spec.metadata.revision),
    summary: 'Restored the default Agent Browser harness layout.',
  };
}
