import type { ExtractedPage } from '../types';

export type StructureNodeKind = 'section' | 'paragraph' | 'figure' | 'table';

export type StructureEdgeType = 'contains' | 'references' | 'near';

export type StructureNode = {
  readonly id: string;
  readonly docId: string;
  readonly kind: StructureNodeKind;
  readonly text: string;
  readonly page: number;
  readonly sourcePageId: ExtractedPage['id'];
  readonly assetUri?: string;
  readonly label?: string;
};

export type StructureEdge = {
  readonly from: string;
  readonly to: string;
  readonly type: StructureEdgeType;
};

export type PointerBundle = {
  readonly docId: string;
  readonly nodeId: string;
  readonly kind: Extract<StructureNodeKind, 'figure' | 'table'>;
  readonly page: number;
  readonly assetUri: string;
  readonly score: number;
};

export type StructureGraph = {
  readonly nodes: readonly StructureNode[];
  readonly edges: readonly StructureEdge[];
};
