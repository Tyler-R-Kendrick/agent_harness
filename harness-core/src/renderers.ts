export type HarnessRendererTargetKind = 'file' | 'artifact' | 'message' | 'workspace-item';

export interface HarnessRendererTarget {
  kind: HarnessRendererTargetKind;
  fileNames?: readonly string[];
  fileExtensions?: readonly string[];
  mimeTypes?: readonly string[];
  artifactKinds?: readonly string[];
  messageTypes?: readonly string[];
  workspaceItemTypes?: readonly string[];
}

export interface HarnessRendererTargetInput {
  kind: HarnessRendererTargetKind;
  path?: string;
  mimeType?: string;
  artifactKind?: string;
  messageType?: string;
  workspaceItemType?: string;
}

export interface HarnessRendererComponent {
  module: string;
  export?: string;
}

export interface HarnessPaneItemDefinition {
  id: string;
  label: string;
  description?: string;
  rendererId?: string;
  preferredLocation?: 'main' | 'side' | 'bottom' | 'modal';
  when: HarnessRendererTarget;
  component?: HarnessRendererComponent;
  priority?: number;
}

export interface HarnessRendererDefinition {
  id: string;
  label: string;
  description?: string;
  target: HarnessRendererTarget;
  component: HarnessRendererComponent;
  paneItem?: HarnessPaneItemDefinition;
  priority?: number;
}

export class RendererRegistry {
  private readonly renderers = new Map<string, HarnessRendererDefinition>();
  private readonly paneItems = new Map<string, HarnessPaneItemDefinition>();

  register(renderer: HarnessRendererDefinition): void {
    if (this.renderers.has(renderer.id)) {
      throw new Error(`Renderer already registered: ${renderer.id}`);
    }
    this.renderers.set(renderer.id, renderer);
    if (renderer.paneItem) {
      this.registerPaneItem(renderer.paneItem);
    }
  }

  registerPaneItem(paneItem: HarnessPaneItemDefinition): void {
    if (this.paneItems.has(paneItem.id)) {
      throw new Error(`Pane item already registered: ${paneItem.id}`);
    }
    this.paneItems.set(paneItem.id, paneItem);
  }

  get(id: string): HarnessRendererDefinition | undefined {
    return this.renderers.get(id);
  }

  getPaneItem(id: string): HarnessPaneItemDefinition | undefined {
    return this.paneItems.get(id);
  }

  list(): HarnessRendererDefinition[] {
    return [...this.renderers.values()];
  }

  listPaneItems(): HarnessPaneItemDefinition[] {
    return [...this.paneItems.values()];
  }

  findForTarget(target: HarnessRendererTargetInput): HarnessRendererDefinition[] {
    return this.list()
      .filter((renderer) => matchesRendererTarget(renderer.target, target))
      .sort(comparePriority);
  }

  findPaneItemsForTarget(target: HarnessRendererTargetInput): HarnessPaneItemDefinition[] {
    return this.listPaneItems()
      .filter((paneItem) => matchesRendererTarget(paneItem.when, target))
      .sort(comparePriority);
  }
}

function comparePriority(
  left: { priority?: number },
  right: { priority?: number },
): number {
  return (right.priority ?? 0) - (left.priority ?? 0);
}

function matchesRendererTarget(definition: HarnessRendererTarget, target: HarnessRendererTargetInput): boolean {
  if (definition.kind !== target.kind) {
    return false;
  }

  const selectors = [
    matchesFileName(definition.fileNames, target.path),
    matchesFileExtension(definition.fileExtensions, target.path),
    matchesMimeType(definition.mimeTypes, target.mimeType),
    matchesOne(definition.artifactKinds, target.artifactKind),
    matchesOne(definition.messageTypes, target.messageType),
    matchesOne(definition.workspaceItemTypes, target.workspaceItemType),
  ].filter((match): match is boolean => match !== undefined);

  return selectors.length === 0 || selectors.some(Boolean);
}

function matchesFileName(fileNames: readonly string[] | undefined, path: string | undefined): boolean | undefined {
  if (!fileNames?.length) return undefined;
  const basename = path?.replace(/\\/g, '/').split('/').at(-1)?.toLowerCase() ?? '';
  return fileNames.some((fileName) => fileName.toLowerCase() === basename);
}

function matchesFileExtension(
  fileExtensions: readonly string[] | undefined,
  path: string | undefined,
): boolean | undefined {
  if (!fileExtensions?.length) return undefined;
  const lowerPath = path?.toLowerCase() ?? '';
  return fileExtensions.some((extension) => lowerPath.endsWith(normalizeFileExtension(extension)));
}

function matchesMimeType(mimeTypes: readonly string[] | undefined, mimeType: string | undefined): boolean | undefined {
  if (!mimeTypes?.length) return undefined;
  const lowerMimeType = mimeType?.toLowerCase() ?? '';
  return mimeTypes.some((candidate) => {
    const normalized = candidate.toLowerCase();
    return normalized.endsWith('/*')
      ? lowerMimeType.startsWith(normalized.slice(0, -1))
      : normalized === lowerMimeType;
  });
}

function matchesOne(values: readonly string[] | undefined, value: string | undefined): boolean | undefined {
  if (!values?.length) return undefined;
  const normalized = value?.toLowerCase() ?? '';
  return values.some((candidate) => candidate.toLowerCase() === normalized);
}

function normalizeFileExtension(extension: string): string {
  const normalized = extension.trim().toLowerCase();
  return normalized.startsWith('.') ? normalized : `.${normalized}`;
}
