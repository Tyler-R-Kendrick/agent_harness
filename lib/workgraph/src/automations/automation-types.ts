export type WorkGraphAutomationKind = 'search.index' | 'import.export' | 'sync.push' | 'symphony.branch';

export interface WorkGraphAutomationInput {
  kind: WorkGraphAutomationKind;
  workspaceId: string;
  issueId: string;
  reason: string;
}
