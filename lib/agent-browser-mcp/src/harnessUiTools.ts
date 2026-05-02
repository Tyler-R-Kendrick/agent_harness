import { ModelContext } from '@agent-harness/webmcp';

import type {
  RegisterWorkspaceToolsOptions,
  WorkspaceMcpHarnessElement,
  WorkspaceMcpHarnessElementSpec,
} from './workspaceToolTypes';

function readElement(
  harnessElements: readonly WorkspaceMcpHarnessElement[],
  getHarnessElement: ((elementId: string) => WorkspaceMcpHarnessElementSpec | null | undefined) | undefined,
  elementId: string,
): WorkspaceMcpHarnessElement | WorkspaceMcpHarnessElementSpec {
  const id = elementId.trim();
  const listed = harnessElements.find((candidate) => candidate.id === id);
  if (!listed) {
    throw new DOMException(`Harness element "${id}" is not available.`, 'NotFoundError');
  }
  return getHarnessElement?.(listed.id) ?? listed;
}

function readStringInput(input: object, key: string, label: string): string {
  const value = (input as Record<string, unknown>)[key];
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new TypeError(`${label} requires a non-empty ${key}.`);
  }
  return normalized;
}

function readProps(input: object): Record<string, unknown> {
  const props = (input as { props?: unknown }).props;
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    throw new TypeError('Harness element patch requires object props.');
  }
  return props as Record<string, unknown>;
}

export function registerHarnessUiTools(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    harnessElements = [],
    getHarnessElement,
    getHarnessPromptContext,
    onPatchHarnessElement,
    onRegenerateHarness,
    onRestoreHarness,
    signal,
  } = options;

  const hasHarnessTools = harnessElements.length > 0
    || getHarnessElement
    || getHarnessPromptContext
    || onPatchHarnessElement
    || onRegenerateHarness
    || onRestoreHarness;
  if (!hasHarnessTools) {
    return;
  }

  modelContext.registerTool({
    name: 'list_harness_elements',
    title: 'List harness elements',
    description: 'List editable Agent Browser harness elements in the active workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => [...harnessElements],
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'read_harness_element',
    title: 'Read harness element',
    description: 'Read one Agent Browser harness element spec by id.',
    inputSchema: {
      type: 'object',
      properties: {
        elementId: { type: 'string' },
      },
      required: ['elementId'],
      additionalProperties: false,
    },
    execute: async (input: object) => readElement(
      harnessElements,
      getHarnessElement,
      readStringInput(input, 'elementId', 'Harness element read'),
    ),
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'read_harness_prompt_context',
    title: 'Read harness prompt context',
    description: 'Read compact context rows for regenerating the Agent Browser harness.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => ({ rows: [...(getHarnessPromptContext?.() ?? [])] }),
    annotations: { readOnlyHint: true },
  }, { signal });

  if (onPatchHarnessElement) {
    modelContext.registerTool({
      name: 'patch_harness_element',
      title: 'Patch harness element',
      description: 'Patch safe props on one editable Agent Browser harness element.',
      inputSchema: {
        type: 'object',
        properties: {
          elementId: { type: 'string' },
          props: { type: 'object', additionalProperties: true },
        },
        required: ['elementId', 'props'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const element = readElement(
          harnessElements,
          getHarnessElement,
          readStringInput(input, 'elementId', 'Harness element patch'),
        );
        const result = await onPatchHarnessElement({ elementId: element.id, props: readProps(input) });
        return result ?? { elementId: element.id, updated: true };
      },
    }, { signal });
  }

  if (onRegenerateHarness) {
    modelContext.registerTool({
      name: 'regenerate_harness_ui',
      title: 'Regenerate harness UI',
      description: 'Regenerate the Agent Browser harness from a natural-language change request.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
        },
        required: ['prompt'],
        additionalProperties: false,
      },
      execute: async (input: object) => onRegenerateHarness({
        prompt: readStringInput(input, 'prompt', 'Harness regeneration'),
      }),
    }, { signal });
  }

  if (onRestoreHarness) {
    modelContext.registerTool({
      name: 'restore_harness_ui',
      title: 'Restore harness UI',
      description: 'Restore the default Agent Browser harness layout for the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => onRestoreHarness(),
    }, { signal });
  }
}
