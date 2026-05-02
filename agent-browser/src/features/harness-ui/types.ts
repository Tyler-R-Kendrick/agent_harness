export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type HarnessElementSlot =
  | 'app'
  | 'app.rail'
  | 'app.omnibar'
  | 'app.sidebar'
  | 'app.sidebar.browser'
  | 'app.sidebar.sessions'
  | 'app.sidebar.files'
  | 'app.sidebar.clipboard'
  | 'app.main'
  | 'app.panels'
  | 'app.panels.browser'
  | 'app.panels.session'
  | 'app.panels.file'
  | 'app.assistant'
  | 'app.settings'
  | 'app.history'
  | 'app.extensions'
  | 'app.account'
  | 'app.toast'
  | 'app.overlay'
  | 'dashboard.canvas';

export type HarnessElement = {
  id: string;
  type: string;
  props?: Record<string, JsonValue>;
  children?: string[];
  slot?: HarnessElementSlot;
  editable?: boolean;
};

export type HarnessAppSpec = {
  version: 'harness-ui/v1';
  root: string;
  elements: Record<string, HarnessElement>;
  metadata: {
    workspaceId: string;
    workspaceName: string;
    createdBy: 'agent-browser';
    designSystemId: 'agent-browser/current';
    revision: number;
  };
};

export type HarnessElementPatch = {
  elementId: string;
  props?: Record<string, JsonValue>;
  children?: string[];
  editable?: boolean;
};

export type EditableHarnessElement = {
  id: string;
  type: string;
  title: string;
  editable: boolean;
  slot: HarnessElementSlot;
  path: string;
};

export type HarnessCatalogComponent = {
  type: string;
  label: string;
  description: string;
  allowedSlots: HarnessElementSlot[];
  allowedProps: string[];
  designTokens: string[];
  naturalLanguageHints: string[];
};

export type HarnessRegenerationResult = {
  spec: HarnessAppSpec;
  summary: string;
};

export type WidgetSize = {
  cols: number;
  rows: number;
  preset?: string;
};

export type WidgetPosition = {
  col: number;
  row: number;
};

export type WidgetLayout = {
  positions: Record<string, WidgetPosition>;
  renderedSizes: Record<string, WidgetSize>;
  minimizedMap: Record<string, boolean>;
};
