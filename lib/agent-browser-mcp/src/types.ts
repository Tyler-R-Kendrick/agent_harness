export type WebMcpToolGroup = 'webmcp';

export interface WebMcpToolDescriptor {
  id: string;
  label: string;
  description: string;
  group: WebMcpToolGroup;
  groupLabel: string;
}
