import type { HarnessPlugin } from 'harness-core';

export type OpenDesignDirectionId =
  | 'editorial-monocle'
  | 'modern-minimal'
  | 'tech-utility'
  | 'brutalist-experimental'
  | 'warm-soft';

export type OpenDesignExportKind =
  | 'zip'
  | 'pdf'
  | 'pptx'
  | 'canva'
  | 'html'
  | 'markdown'
  | 'handoff'
  | 'cloudflare';

export interface OpenDesignBrief {
  projectName: string;
  audience: string;
  surface: string;
  prompt: string;
  githubUrl: string;
  localFolder: string;
  designFile: string;
  assets: string;
  notes: string;
}

export interface OpenDesignDirection {
  id: OpenDesignDirectionId;
  label: string;
  description: string;
  palette: {
    canvas: string;
    surface: string;
    surfaceRaised: string;
    text: string;
    muted: string;
    accent: string;
    accentStrong: string;
    border: string;
  };
  typography: {
    display: string;
    ui: string;
    mono: string;
  };
}

export interface OpenDesignResearchSource {
  product: 'Claude Design' | 'Open Design';
  title: string;
  url: string;
  capturedAt: string;
  features: string[];
}

export interface OpenDesignScreenshotReference {
  product: 'Claude Design' | 'Open Design';
  label: string;
  url: string;
  userFlow: string;
}

export interface OpenDesignResearchInventory {
  sources: OpenDesignResearchSource[];
  screenshotReferences: OpenDesignScreenshotReference[];
  userFlows: string[];
  studioFeatures: string[];
  designMdRequirements: string[];
}

export interface OpenDesignCritiquePanelist {
  id: string;
  label: string;
  score: number;
  finding: string;
}

export interface OpenDesignCritiqueResult {
  gate: 'pass' | 'revise';
  score: number;
  panelists: OpenDesignCritiquePanelist[];
  requiredFixes: string[];
}

export type OpenDesignTokenReviewStatus = 'needs-review' | 'approved' | 'changes-requested';
export type OpenDesignApprovalAction = 'approved' | 'changes-requested' | 'published' | 'unpublished';
export type OpenDesignTokenReviewSampleKind = 'type-scale' | 'palette' | 'spacing' | 'radius' | 'component' | 'brand';

export interface OpenDesignTokenReviewSample {
  kind: OpenDesignTokenReviewSampleKind;
  visualLabel: string;
  title: string;
  description: string;
  sampleTokens: string[];
  cues: string[];
}

export interface OpenDesignTokenReviewItem {
  id: string;
  group: 'type' | 'colors' | 'spacing' | 'components' | 'brand';
  label: string;
  currentValue: string;
  proposedValue: string;
  status: OpenDesignTokenReviewStatus;
  reviewer: string;
  note: string;
  revision: number;
  source: string;
  sample: OpenDesignTokenReviewSample;
}

export interface OpenDesignApprovalEvent {
  id: string;
  itemId: string;
  action: OpenDesignApprovalAction;
  reviewer: string;
  note: string;
  createdAt: string;
}

export interface OpenDesignApprovalSummary {
  total: number;
  approved: number;
  needsReview: number;
  changesRequested: number;
  readyToPublish: boolean;
  status: 'reviewing' | 'ready' | 'published';
}

export interface OpenDesignApprovalCompositionRegion {
  id: string;
  label: string;
  standard: string;
  sampleTokens: string[];
}

export interface OpenDesignApprovalComposition {
  title: string;
  description: string;
  regions: OpenDesignApprovalCompositionRegion[];
}

export interface OpenDesignWorkspaceFile {
  path: string;
  content: string;
  updatedAt: string;
}

export interface OpenDesignStudioState {
  workspaceName: string;
  brief: OpenDesignBrief;
  directionId: OpenDesignDirectionId;
  fidelity: 'wireframe' | 'high';
  density: number;
  radius: number;
  lastCritique: OpenDesignCritiqueResult | null;
  tokenReviews: OpenDesignTokenReviewItem[];
  approvalEvents: OpenDesignApprovalEvent[];
  published: boolean;
  defaultForWorkspace: boolean;
}

export const OPEN_DESIGN_DIRECTIONS: OpenDesignDirection[] = [
  {
    id: 'editorial-monocle',
    label: 'Editorial Monocle',
    description: 'Large serif hierarchy, restrained ink palette, and one decisive accent.',
    palette: {
      canvas: '#f6f2ea',
      surface: '#fffdf8',
      surfaceRaised: '#ebe4d8',
      text: '#17120d',
      muted: '#6c6258',
      accent: '#c94f2d',
      accentStrong: '#8f2d18',
      border: 'rgba(23, 18, 13, 0.18)',
    },
    typography: {
      display: 'Georgia',
      ui: 'Aptos',
      mono: 'Cascadia Mono',
    },
  },
  {
    id: 'modern-minimal',
    label: 'Modern Minimal',
    description: 'Near-grayscale system shell with precise blue action marks.',
    palette: {
      canvas: '#f7f8fa',
      surface: '#ffffff',
      surfaceRaised: '#eef1f5',
      text: '#111827',
      muted: '#667085',
      accent: '#1d74d8',
      accentStrong: '#0f4ea8',
      border: 'rgba(17, 24, 39, 0.14)',
    },
    typography: {
      display: 'Aptos Display',
      ui: 'Aptos',
      mono: 'Cascadia Mono',
    },
  },
  {
    id: 'tech-utility',
    label: 'Tech Utility',
    description: 'Dark productive canvas, dense inspection lines, and cool signal color.',
    palette: {
      canvas: '#0d1117',
      surface: '#111820',
      surfaceRaised: '#17212c',
      text: '#eef6ff',
      muted: '#94a3b8',
      accent: '#4dd0e1',
      accentStrong: '#8ee8f2',
      border: 'rgba(148, 163, 184, 0.18)',
    },
    typography: {
      display: 'Aptos Display',
      ui: 'Segoe UI Variable Text',
      mono: 'Cascadia Mono',
    },
  },
  {
    id: 'brutalist-experimental',
    label: 'Brutalist Experimental',
    description: 'Hard edges, dense contrasts, and deliberate raw controls for exploration.',
    palette: {
      canvas: '#f2f0e8',
      surface: '#ffffff',
      surfaceRaised: '#ded9cc',
      text: '#060606',
      muted: '#4d4a43',
      accent: '#f2c94c',
      accentStrong: '#111111',
      border: 'rgba(6, 6, 6, 0.38)',
    },
    typography: {
      display: 'Franklin Gothic Medium',
      ui: 'Aptos',
      mono: 'Cascadia Mono',
    },
  },
  {
    id: 'warm-soft',
    label: 'Warm Soft',
    description: 'Soft product review space with warm surfaces and calm green progress.',
    palette: {
      canvas: '#f9f4ec',
      surface: '#fffaf2',
      surfaceRaised: '#efe4d3',
      text: '#2a2118',
      muted: '#766a5d',
      accent: '#4f8f6a',
      accentStrong: '#2f6849',
      border: 'rgba(42, 33, 24, 0.16)',
    },
    typography: {
      display: 'Cambria',
      ui: 'Aptos',
      mono: 'Cascadia Mono',
    },
  },
];

const EMPTY_BRIEF: OpenDesignBrief = {
  projectName: '',
  audience: '',
  surface: '',
  prompt: '',
  githubUrl: '',
  localFolder: '',
  designFile: '',
  assets: '',
  notes: '',
};

const RESEARCH_INVENTORY: OpenDesignResearchInventory = {
  sources: [
    {
      product: 'Claude Design',
      title: 'Anthropic launch announcement',
      url: 'https://www.anthropic.com/news/claude-design-anthropic-labs',
      capturedAt: '2026-05-09',
      features: ['chat and canvas loop', 'inline comments', 'direct edits', 'custom sliders', 'team design systems'],
    },
    {
      product: 'Claude Design',
      title: 'Claude Help Center getting started guide',
      url: 'https://support.claude.com/en/articles/14604416-get-started-with-claude-design',
      capturedAt: '2026-05-09',
      features: ['project context', 'codebase and design file intake', 'comments', 'versions', 'export and sharing'],
    },
    {
      product: 'Claude Design',
      title: 'Claude Help Center design-system setup guide',
      url: 'https://support.claude.com/en/articles/14604397-set-up-your-design-system-in-claude-design',
      capturedAt: '2026-05-10',
      features: ['design-system extraction', 'review generated UI kit', 'published toggle', 'organization default', 'remix updates'],
    },
    {
      product: 'Claude Design',
      title: 'Claude Design design-system review walkthrough',
      url: 'https://www.getmasset.com/resources/blog/building-a-landing-page-with-claude-design',
      capturedAt: '2026-05-10',
      features: ['setup screenshots', 'missing font warning', 'looks good approval', 'needs work revision', 'published and default readiness'],
    },
    {
      product: 'Open Design',
      title: 'Open Design README demo and feature inventory',
      url: 'https://github.com/nexu-io/open-design',
      capturedAt: '2026-05-09',
      features: ['skill picker', 'discovery form', 'direction picker', 'sandboxed preview', 'design-system library'],
    },
    {
      product: 'Open Design',
      title: 'Open Design 0.6.0 release notes',
      url: 'https://github.com/nexu-io/open-design/releases/tag/open-design-v0.6.0',
      capturedAt: '2026-05-09',
      features: ['external MCP client', 'Cloudflare artifact deployment', 'top bar redesign', 'direct PDF export', 'agent research search'],
    },
    {
      product: 'Open Design',
      title: 'Open Design 0.5.0 release notes',
      url: 'https://github.com/nexu-io/open-design/releases/tag/open-design-v0.5.0',
      capturedAt: '2026-05-09',
      features: ['live dashboards', 'inspect mode', 'accent color control', 'critique theater', 'transcript export'],
    },
  ],
  screenshotReferences: [
    {
      product: 'Open Design',
      label: 'Entry view',
      url: 'https://github.com/nexu-io/open-design/raw/main/docs/screenshots/01-entry-view.png',
      userFlow: 'Choose skill, design system, fidelity, then create',
    },
    {
      product: 'Open Design',
      label: 'Turn-1 discovery form',
      url: 'https://github.com/nexu-io/open-design/raw/main/docs/screenshots/02-question-form.png',
      userFlow: 'Lock brief, audience, brand context, and reference files before generation',
    },
    {
      product: 'Open Design',
      label: 'Direction picker',
      url: 'https://github.com/nexu-io/open-design/raw/main/docs/screenshots/03-direction-picker.png',
      userFlow: 'Select deterministic palette and font system instead of freeform styling',
    },
    {
      product: 'Open Design',
      label: 'Sandboxed preview',
      url: 'https://github.com/nexu-io/open-design/raw/main/docs/screenshots/05-preview-iframe.png',
      userFlow: 'Review generated artifact with live todos, files, tweak mode, and share controls',
    },
    {
      product: 'Claude Design',
      label: 'Export menu',
      url: 'https://support.claude.com/en/articles/14604416-get-started-with-claude-design',
      userFlow: 'Export ZIP, PDF, PPTX, Canva, standalone HTML, or Claude Code handoff',
    },
    {
      product: 'Claude Design',
      label: 'Design system setup',
      url: 'https://www.getmasset.com/images/blog/claude-design-setup-screen.png',
      userFlow: 'Collect company description, GitHub/code, local files, Figma, fonts, logos, and brand assets',
    },
    {
      product: 'Claude Design',
      label: 'Token review screen',
      url: 'https://www.getmasset.com/images/blog/claude_design_looks_good.png',
      userFlow: 'Review extracted type, color, spacing, component, and brand sections with Looks good or Needs work decisions',
    },
    {
      product: 'Claude Design',
      label: 'Published/default ready state',
      url: 'https://www.getmasset.com/images/blog/claude_design_new_design.png',
      userFlow: 'Publish the approved design system and mark it as default before starting new projects',
    },
  ],
  userFlows: [
    'Brief capture',
    'Direction selection',
    'Design-system token review',
    'Revision request',
    'Approval and publish',
    'DESIGN.md compilation',
    'Live preview inspection',
    'Inline comment revision',
    'Critique scoring',
    'Artifact export',
    'Agent handoff',
  ],
  studioFeatures: [
    'AI chat rail with explicit source inventory',
    'Visual direction picker with deterministic tokens',
    'DESIGN.md source of truth',
    'Preview canvas with device frames',
    'Inspector for color, spacing, type, density, and radius',
    'Design files browser and direct export artifacts',
    'Claude Design-style token review queue with per-section approve or needs-work revisions',
    'Published/default governance before downstream projects consume the design system',
    'Five-panel critique gate for accessibility, brand fit, craft, hierarchy, and implementation',
  ],
  designMdRequirements: [
    'YAML frontmatter must include DTCG-friendly token groups for colors, typography, spacing, radii, motion, and shadows.',
    'Token review metadata must record each revision, approval state, reviewer note, and published/default state before agents consume the system.',
    'Markdown body must record sources, decisions, components, states, accessibility rules, exports, and agent handoff instructions.',
    'Styles must include Agent Browser shell variables and widget selectors so downstream code can apply the same system.',
  ],
};

export function createOpenDesignStudioState(options: Partial<OpenDesignStudioState> = {}): OpenDesignStudioState {
  const directionId = options.directionId ?? 'tech-utility';
  const density = options.density ?? 4;
  const radius = options.radius ?? 6;
  return {
    workspaceName: options.workspaceName ?? 'Design workspace',
    brief: { ...EMPTY_BRIEF, ...(options.brief ?? {}) },
    directionId,
    fidelity: options.fidelity ?? 'high',
    density,
    radius,
    lastCritique: options.lastCritique ?? null,
    tokenReviews: options.tokenReviews ? hydrateTokenReviewSamples(options.tokenReviews, directionId, density, radius) : createOpenDesignTokenReviewQueue(directionId, density, radius),
    approvalEvents: options.approvalEvents ? clone(options.approvalEvents) : [],
    published: options.published ?? false,
    defaultForWorkspace: options.defaultForWorkspace ?? false,
  };
}

export function updateOpenDesignBrief(
  state: OpenDesignStudioState,
  patch: Partial<OpenDesignBrief>,
): OpenDesignStudioState {
  return { ...state, brief: { ...state.brief, ...patch } };
}

export function selectOpenDesignDirection(
  state: OpenDesignStudioState,
  directionId: OpenDesignDirectionId,
): OpenDesignStudioState {
  return {
    ...state,
    directionId,
    published: false,
    tokenReviews: createOpenDesignTokenReviewQueue(directionId, state.density, state.radius),
  };
}

export function getOpenDesignResearchInventory(): OpenDesignResearchInventory {
  return clone(RESEARCH_INVENTORY);
}

export function createOpenDesignTokenReviewQueue(
  directionId: OpenDesignDirectionId,
  density = 4,
  radius = 6,
): OpenDesignTokenReviewItem[] {
  const direction = directionFor(directionId);
  return [
    tokenReviewItem('type-display', 'type', 'Display type', 'Existing display type', `${direction.typography.display} / 28px / 650`, 'Claude Design review screen: Type', sampleForTokenReview('type-display', direction, density, radius)),
    tokenReviewItem('color-core', 'colors', 'Core palette', 'Existing brand palette', `${direction.palette.canvas} canvas, ${direction.palette.accent} accent`, 'Claude Design review screen: Colors', sampleForTokenReview('color-core', direction, density, radius)),
    tokenReviewItem('spacing-scale', 'spacing', 'Spacing scale', 'Existing spacing scale', `${Math.max(10, density * 3)}px md / ${Math.max(16, density * 5)}px lg`, 'Claude Design review screen: Spacing', sampleForTokenReview('spacing-scale', direction, density, radius)),
    tokenReviewItem('radius-borders', 'spacing', 'Borders and radius', 'Existing radius', `${Math.max(2, radius - 2)}px sm / ${radius}px md / ${radius + 2}px lg`, 'Claude Design review screen: Borders & radius', sampleForTokenReview('radius-borders', direction, density, radius)),
    tokenReviewItem('component-actions', 'components', 'Action components', 'Existing primary action', `Icon command, ${direction.palette.accent} fill, ${radius}px radius`, 'Claude Design review screen: Components', sampleForTokenReview('component-actions', direction, density, radius)),
    tokenReviewItem('brand-voice', 'brand', 'Voice and iconography', 'Existing brand voice', `${direction.label}: ${direction.description}`, 'Claude Design review screen: Brand', sampleForTokenReview('brand-voice', direction, density, radius)),
  ];
}

export function createOpenDesignApprovalComposition(state: OpenDesignStudioState): OpenDesignApprovalComposition {
  const direction = directionFor(state.directionId);
  return {
    title: 'Agent Browser approval composition',
    description: 'Aggregate page sample combining approved type, color, spacing, radius, component, and brand standards before publish.',
    regions: [
      {
        id: 'workspace-rail',
        label: 'Workspace rail',
        standard: `${direction.palette.surface} navigation with ${direction.typography.ui} labels`,
        sampleTokens: ['surface', 'muted text', 'sm spacing'],
      },
      {
        id: 'conversation-canvas',
        label: 'Conversation canvas',
        standard: `${direction.palette.canvas} page field with ${direction.typography.display} hierarchy`,
        sampleTokens: ['canvas', 'display font', 'lg spacing'],
      },
      {
        id: 'token-inspector',
        label: 'Token inspector',
        standard: `${direction.palette.surfaceRaised} inspector rows with ${state.radius}px corners`,
        sampleTokens: ['surfaceRaised', 'md radius', 'focus ring'],
      },
      {
        id: 'approval-footer',
        label: 'Approval footer',
        standard: `${direction.palette.accent} icon command and publish state`,
        sampleTokens: ['accent', 'primary action', 'status text'],
      },
    ],
  };
}

export function getOpenDesignApprovalSummary(state: OpenDesignStudioState): OpenDesignApprovalSummary {
  const approved = state.tokenReviews.filter((item) => item.status === 'approved').length;
  const changesRequested = state.tokenReviews.filter((item) => item.status === 'changes-requested').length;
  const needsReview = state.tokenReviews.length - approved - changesRequested;
  const readyToPublish = state.tokenReviews.length > 0 && approved === state.tokenReviews.length;
  return {
    total: state.tokenReviews.length,
    approved,
    changesRequested,
    needsReview,
    readyToPublish,
    status: state.published && readyToPublish ? 'published' : readyToPublish ? 'ready' : 'reviewing',
  };
}

export function approveOpenDesignTokenRevision(
  state: OpenDesignStudioState,
  itemId: string,
  reviewer = 'Designer',
  note = 'Looks good.',
  timestamp = new Date().toISOString(),
): OpenDesignStudioState {
  return updateTokenReview(state, itemId, 'approved', reviewer, note, undefined, timestamp);
}

export function requestOpenDesignTokenRevision(
  state: OpenDesignStudioState,
  itemId: string,
  proposedValue: string,
  reviewer = 'Designer',
  note = 'Needs work before this token can be locked.',
  timestamp = new Date().toISOString(),
): OpenDesignStudioState {
  return updateTokenReview(state, itemId, 'changes-requested', reviewer, note, proposedValue, timestamp);
}

export function publishOpenDesignSystem(
  state: OpenDesignStudioState,
  reviewer = 'Designer',
  note = 'Published approved design system.',
  timestamp = new Date().toISOString(),
): OpenDesignStudioState {
  const summary = getOpenDesignApprovalSummary(state);
  return {
    ...state,
    published: summary.readyToPublish,
    approvalEvents: [
      ...state.approvalEvents,
      approvalEvent(
        'system',
        summary.readyToPublish ? 'published' : 'unpublished',
        reviewer,
        summary.readyToPublish ? note : 'Publish blocked until every token review is approved.',
        timestamp,
      ),
    ],
  };
}

export function compileOpenDesignMd(
  state: OpenDesignStudioState,
  timestamp = new Date().toISOString(),
): string {
  const direction = directionFor(state.directionId);
  const name = designName(state);
  const sourceLines = designSourceLines(state.brief);
  const notes = state.brief.notes.trim() || 'No special notes yet.';
  const prompt = state.brief.prompt.trim() || 'Create a coherent AI-native design system.';
  const sourceSection = sourceLines.length ? sourceLines.map((line) => `- ${line}`) : ['- No external sources attached yet.'];
  const approvalSummary = getOpenDesignApprovalSummary(state);
  const tokenReviewLines = state.tokenReviews.map((item) => [
    `### ${item.label}`,
    '',
    `- Group: ${item.group}`,
    `- Current: ${item.currentValue}`,
    `- Proposed: ${item.proposedValue}`,
    `- Status: ${item.status}`,
    `- Revision: ${item.revision}`,
    `- Reviewer: ${item.reviewer || 'unassigned'}`,
    `- Note: ${item.note || 'No reviewer note yet.'}`,
    `- Visual sample: ${item.sample.title}`,
    `- Sample purpose: ${item.sample.description}`,
    `- Sample tokens: ${item.sample.sampleTokens.join(', ')}`,
    `- Visual cues: ${item.sample.cues.join('; ')}`,
    `- Source: ${item.source}`,
  ].join('\n'));

  return [
    '---',
    `name: ${name}`,
    `description: ${prompt}`,
    'standard: agent-harness-design-md',
    `generatedAt: ${timestamp}`,
    `direction: ${direction.label}`,
    `fidelity: ${state.fidelity}`,
    'colors:',
    `  canvas: "${direction.palette.canvas}"`,
    `  surface: "${direction.palette.surface}"`,
    `  surfaceRaised: "${direction.palette.surfaceRaised}"`,
    `  text: "${direction.palette.text}"`,
    `  muted: "${direction.palette.muted}"`,
    `  accent: "${direction.palette.accent}"`,
    `  accentStrong: "${direction.palette.accentStrong}"`,
    `  border: "${direction.palette.border}"`,
    'typography:',
    '  display:',
    `    fontFamily: ${direction.typography.display}`,
    '    fontSize: 28px',
    '    fontWeight: "650"',
    '    lineHeight: "1.1"',
    '  ui:',
    `    fontFamily: ${direction.typography.ui}`,
    '    fontSize: 13px',
    '    fontWeight: "500"',
    '    lineHeight: "1.45"',
    '  mono:',
    `    fontFamily: ${direction.typography.mono}`,
    '    fontSize: 12px',
    '    fontWeight: "500"',
    '    lineHeight: "1.5"',
    'rounded:',
    `  sm: ${Math.max(2, state.radius - 2)}px`,
    `  md: ${state.radius}px`,
    `  lg: ${state.radius + 2}px`,
    'spacing:',
    '  xs: 4px',
    '  sm: 8px',
    `  md: ${Math.max(10, state.density * 3)}px`,
    `  lg: ${Math.max(16, state.density * 5)}px`,
    'shadows:',
    '  focus: 0 0 0 1px rgba(77, 208, 225, 0.62)',
    '  raised: 0 18px 48px rgba(0, 0, 0, 0.28)',
    'motion:',
    '  quick: 140ms ease',
    '  deliberate: 220ms ease',
    'tokenReview:',
    `  status: ${approvalSummary.status}`,
    `  approved: ${approvalSummary.approved}`,
    `  needsReview: ${approvalSummary.needsReview}`,
    `  changesRequested: ${approvalSummary.changesRequested}`,
    `  total: ${approvalSummary.total}`,
    `  published: ${state.published}`,
    `  defaultForWorkspace: ${state.defaultForWorkspace}`,
    'themes:',
    '  high-contrast:',
    '    colors:',
    '      canvas: "#05070a"',
    '      surface: "#0c1118"',
    '      text: "#ffffff"',
    '      muted: "#cbd5e1"',
    '      accent: "#8ee8f2"',
    'styles:',
    '  agentBrowser:',
    '    app-bg: colors.canvas',
    '    panel-bg: colors.surface',
    '    panel-bg-elevated: colors.surfaceRaised',
    '    panel-bg-soft: colors.surfaceRaised',
    '    panel-border: colors.border',
    '    panel-border-strong: colors.accent',
    '    text-soft: colors.muted',
    '    text-muted: colors.muted',
    '    accent: colors.accent',
    '    accent-strong: colors.accentStrong',
    '  widgets:',
    '    primary-action:',
    '      background: colors.accent',
    '      color: colors.canvas',
    '      border-radius: rounded.md',
    '    inspector-row:',
    '      background: colors.surfaceRaised',
    '      color: colors.text',
    '      border: 1px solid colors.border',
    '---',
    '',
    `# ${name}`,
    '',
    '## Source Inventory',
    '',
    ...sourceSection,
    '',
    '## Token Review And Approval',
    '',
    `Status: ${approvalSummary.status}. ${approvalSummary.approved}/${approvalSummary.total} token sections approved.`,
    '',
    ...tokenReviewLines,
    '',
    '## Direction',
    '',
    `${direction.label}: ${direction.description}`,
    '',
    '## Design Decisions',
    '',
    '- Build the studio around a chat rail, preview canvas, inspector strip, and DESIGN.md output.',
    '- Prefer icon actions for creation, inspection, saving, critique, export, and handoff.',
    '- Avoid badge, pill, and card-heavy extension chrome; use rows, lines, swatches, and tool glyphs.',
    '- Keep mobile, tablet, and desktop targets visible through deterministic device frames.',
    '',
    '## Components',
    '',
    '- Primary action: icon-led command with explicit label exposed through aria-label and title.',
    '- Inspector row: compact token editor for color, spacing, type, radius, density, and state.',
    '- Preview canvas: isolated artifact surface with comments, inspect mode, and source toggle.',
    '- Design file row: direct path, type, update time, and preview affordance.',
    '',
    '## Accessibility',
    '',
    '- Maintain visible focus rings on every action.',
    '- Keep touch targets at least 40px on phone layouts.',
    '- Preserve contrast across the default and high-contrast themes.',
    '',
    '## Agent Handoff',
    '',
    'Use this DESIGN.md before editing any UI. Treat token values as normative and record deviations in this document.',
    '',
    '## Notes',
    '',
    notes,
  ].join('\n');
}

export function buildOpenDesignWorkspaceBundle(
  state: OpenDesignStudioState,
  timestamp = new Date().toISOString(),
): OpenDesignWorkspaceFile[] {
  const name = designName(state);
  const design = compileOpenDesignMd(state, timestamp);
  const files: OpenDesignWorkspaceFile[] = [
    { path: 'DESIGN.md', content: design, updatedAt: timestamp },
    {
      path: 'design/open-design/research.json',
      content: JSON.stringify(getOpenDesignResearchInventory(), null, 2),
      updatedAt: timestamp,
    },
    {
      path: 'design/open-design/system.json',
      content: JSON.stringify({ name, state, direction: directionFor(state.directionId) }, null, 2),
      updatedAt: timestamp,
    },
    {
      path: 'design/open-design/token-review.json',
      content: JSON.stringify({
        summary: getOpenDesignApprovalSummary(state),
        composition: createOpenDesignApprovalComposition(state),
        tokenReviews: state.tokenReviews,
        approvalEvents: state.approvalEvents,
      }, null, 2),
      updatedAt: timestamp,
    },
    {
      path: 'design/open-design/preview.html',
      content: previewHtml(name, state),
      updatedAt: timestamp,
    },
    {
      path: 'design/open-design/handoff.md',
      content: handoffMarkdown(name),
      updatedAt: timestamp,
    },
  ];
  if (state.lastCritique) {
    files.push({
      path: 'design/open-design/critique.json',
      content: JSON.stringify(state.lastCritique, null, 2),
      updatedAt: timestamp,
    });
  }
  return files;
}

export function runOpenDesignCritique(state: OpenDesignStudioState): OpenDesignCritiqueResult {
  const hasBrief = Boolean(state.brief.projectName.trim() && state.brief.prompt.trim());
  const approvalSummary = getOpenDesignApprovalSummary(state);
  const base = (hasBrief ? 8.7 : 7.6) - (approvalSummary.readyToPublish ? 0 : 0.8) - (approvalSummary.changesRequested ? 0.3 : 0);
  const panelists: OpenDesignCritiquePanelist[] = [
    { id: 'accessibility', label: 'Accessibility', score: roundScore(base + 0.1), finding: 'Focus, contrast, and target-size rules are explicit in DESIGN.md.' },
    { id: 'brand-fit', label: 'Brand fit', score: roundScore(base), finding: 'Direction tokens create a repeatable brand surface.' },
    { id: 'craft', label: 'Craft', score: roundScore(base - 0.2), finding: 'Minimal chrome keeps attention on the artifact and inspector.' },
    { id: 'hierarchy', label: 'Hierarchy', score: roundScore(base + 0.2), finding: 'Canvas, files, and critique occupy distinct scanning lanes.' },
    { id: 'implementation', label: 'Implementation', score: roundScore(base - 0.1), finding: approvalSummary.readyToPublish ? 'DESIGN.md variables map to Agent Browser shell and widget selectors.' : 'Token reviews must be approved before this design system is published to downstream agents.' },
  ];
  const score = roundScore(panelists.reduce((sum, panelist) => sum + panelist.score, 0) / panelists.length);
  const requiredFixes = [
    ...(!hasBrief ? ['Add a project name and a concrete design prompt before export.'] : []),
    ...(!approvalSummary.readyToPublish ? ['Approve every design-token review item before publishing DESIGN.md.'] : []),
  ];
  return {
    gate: score >= 8 ? 'pass' : 'revise',
    score,
    panelists,
    requiredFixes,
  };
}

export function createOpenDesignExportArtifact(
  kind: OpenDesignExportKind,
  state: OpenDesignStudioState,
  timestamp = new Date().toISOString(),
): OpenDesignWorkspaceFile {
  const name = designName(state);
  const slug = slugify(name);
  const extension = kind === 'handoff' || kind === 'canva' || kind === 'cloudflare' ? 'md' : kind;
  const suffix = kind === 'handoff' ? '-handoff' : kind === 'cloudflare' ? '-cloudflare-deploy' : '';
  const path = `design/open-design/exports/${slug}${suffix}.${extension}`;
  return {
    path,
    updatedAt: timestamp,
    content: exportContent(kind, name, path),
  };
}

export function createOpenDesignPlugin(): HarnessPlugin {
  return {
    id: 'open-design',
    register({ commands, tools }) {
      tools.register({
        id: 'open-design.inventory',
        label: 'OpenDesign feature inventory',
        description: 'Return the Claude Design and Open Design feature inventory used by the DESIGN.md studio.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => getOpenDesignResearchInventory(),
      });

      tools.register({
        id: 'open-design.compile-design-md',
        label: 'Compile DESIGN.md',
        description: 'Compile an OpenDesign studio brief into a DESIGN.md document.',
        inputSchema: {
          type: 'object',
          properties: {
            projectName: { type: 'string' },
            prompt: { type: 'string' },
            directionId: { type: 'string' },
          },
          additionalProperties: true,
        },
        execute: async (rawArgs) => {
          const args = isRecord(rawArgs) ? rawArgs : {};
          const directionId = isOpenDesignDirectionId(args.directionId) ? args.directionId : 'tech-utility';
          const state = createOpenDesignStudioState({
            brief: {
              ...EMPTY_BRIEF,
              projectName: typeof args.projectName === 'string' ? args.projectName : '',
              prompt: typeof args.prompt === 'string' ? args.prompt : '',
            },
            directionId,
          });
          return {
            path: 'DESIGN.md',
            content: compileOpenDesignMd(state),
          };
        },
      });

      tools.register({
        id: 'open-design.critique',
        label: 'Critique DESIGN.md system',
        description: 'Run the five-panel OpenDesign critique gate for a studio brief.',
        inputSchema: {
          type: 'object',
          properties: {
            projectName: { type: 'string' },
            prompt: { type: 'string' },
          },
          additionalProperties: true,
        },
        execute: async (rawArgs) => {
          const args = isRecord(rawArgs) ? rawArgs : {};
          return runOpenDesignCritique(createOpenDesignStudioState({
            brief: {
              ...EMPTY_BRIEF,
              projectName: typeof args.projectName === 'string' ? args.projectName : '',
              prompt: typeof args.prompt === 'string' ? args.prompt : '',
            },
          }));
        },
      });

      commands.register({
        id: 'open-design.new',
        usage: '/opendesign <brief>',
        description: 'Draft an OpenDesign DESIGN.md system brief.',
        pattern: /^\/opendesign(?:\s+(?<brief>.+))?$/i,
        target: {
          type: 'prompt-template',
          template: (_args, match) => {
            const brief = match.groups.brief?.trim() || 'a new AI-native design system';
            return [
              `Create an OpenDesign studio brief for ${brief}.`,
              'Lock the brief, select a visual direction, review design tokens, approve or request revisions, publish the approved DESIGN.md system, preview the artifact, critique it, and export a handoff.',
            ].join('\n');
          },
        },
      });
    },
  };
}

export function OpenDesignStudio(): null {
  return null;
}

function directionFor(directionId: OpenDesignDirectionId): OpenDesignDirection {
  return OPEN_DESIGN_DIRECTIONS.find((direction) => direction.id === directionId) ?? OPEN_DESIGN_DIRECTIONS[0];
}

function tokenReviewItem(
  id: string,
  group: OpenDesignTokenReviewItem['group'],
  label: string,
  currentValue: string,
  proposedValue: string,
  source: string,
  sample: OpenDesignTokenReviewSample,
): OpenDesignTokenReviewItem {
  return {
    id,
    group,
    label,
    currentValue,
    proposedValue,
    status: 'needs-review',
    reviewer: '',
    note: '',
    revision: 1,
    source,
    sample,
  };
}

function hydrateTokenReviewSamples(
  tokenReviews: OpenDesignTokenReviewItem[],
  directionId: OpenDesignDirectionId,
  density: number,
  radius: number,
): OpenDesignTokenReviewItem[] {
  const direction = directionFor(directionId);
  return tokenReviews.map((item) => ({
    ...item,
    sample: item.sample ?? sampleForTokenReview(item.id, direction, density, radius),
  }));
}

function sampleForTokenReview(
  itemId: string,
  direction: OpenDesignDirection,
  density: number,
  radius: number,
): OpenDesignTokenReviewSample {
  if (itemId === 'color-core') {
    return {
      kind: 'palette',
      visualLabel: 'Palette stack sample',
      title: 'Color stack',
      description: 'Shows the canvas, raised surface, text, muted text, and action accent together.',
      sampleTokens: ['canvas', 'surface', 'surfaceRaised', 'text', 'muted', 'accent'],
      cues: [direction.palette.canvas, direction.palette.surface, direction.palette.accent],
    };
  }
  if (itemId === 'spacing-scale') {
    return {
      kind: 'spacing',
      visualLabel: 'Spacing rhythm sample',
      title: 'Layout rhythm',
      description: 'Shows the medium and large spacing steps in a compact approval layout.',
      sampleTokens: ['md spacing', 'lg spacing', 'section rhythm'],
      cues: [`${Math.max(10, density * 3)}px`, `${Math.max(16, density * 5)}px`],
    };
  }
  if (itemId === 'radius-borders') {
    return {
      kind: 'radius',
      visualLabel: 'Border radius sample',
      title: 'Edge treatment',
      description: 'Shows small, medium, and large radii on real approval surfaces.',
      sampleTokens: ['sm radius', 'md radius', 'lg radius', 'border'],
      cues: [`${Math.max(2, radius - 2)}px`, `${radius}px`, `${radius + 2}px`],
    };
  }
  if (itemId === 'component-actions') {
    return {
      kind: 'component',
      visualLabel: 'Action command sample',
      title: 'Command anatomy',
      description: 'Shows primary, secondary, and revision actions as icon-led component standards.',
      sampleTokens: ['primary action', 'secondary action', 'focus ring', 'disabled state'],
      cues: ['Run', 'Approve', 'Revise'],
    };
  }
  if (itemId === 'brand-voice') {
    return {
      kind: 'brand',
      visualLabel: 'Brand voice sample',
      title: 'Voice and iconography',
      description: 'Shows the tone, line weight, and command language that downstream UI should follow.',
      sampleTokens: ['icon stroke', 'command tone', 'status language'],
      cues: [direction.label, 'Inspect before publish', 'Use system'],
    };
  }
  return {
    kind: 'type-scale',
    visualLabel: 'Type specimen sample',
    title: 'Display hierarchy',
    description: 'Shows headline, UI label, and monospace code together before type approval.',
    sampleTokens: ['display font', 'headline rhythm', 'label scale'],
    cues: [direction.typography.display, direction.typography.ui, direction.typography.mono],
  };
}

function updateTokenReview(
  state: OpenDesignStudioState,
  itemId: string,
  status: OpenDesignTokenReviewStatus,
  reviewer: string,
  note: string,
  proposedValue: string | undefined,
  timestamp: string,
): OpenDesignStudioState {
  let found = false;
  const nextReviews = state.tokenReviews.map((item) => {
    if (item.id !== itemId) return item;
    found = true;
    return {
      ...item,
      proposedValue: proposedValue ?? item.proposedValue,
      status,
      reviewer,
      note,
      revision: status === 'changes-requested' ? item.revision + 1 : item.revision,
    };
  });
  if (!found) return state;
  return {
    ...state,
    published: false,
    tokenReviews: nextReviews,
    approvalEvents: [
      ...state.approvalEvents,
      approvalEvent(itemId, status === 'approved' ? 'approved' : 'changes-requested', reviewer, note, timestamp),
    ],
  };
}

function approvalEvent(
  itemId: string,
  action: OpenDesignApprovalAction,
  reviewer: string,
  note: string,
  createdAt: string,
): OpenDesignApprovalEvent {
  return {
    id: `${action}:${itemId}:${createdAt}`,
    itemId,
    action,
    reviewer,
    note,
    createdAt,
  };
}

function isOpenDesignDirectionId(value: unknown): value is OpenDesignDirectionId {
  return typeof value === 'string' && OPEN_DESIGN_DIRECTIONS.some((direction) => direction.id === value);
}

function designName(state: OpenDesignStudioState): string {
  return state.brief.projectName.trim() || `${state.workspaceName} DESIGN.md Studio`;
}

function designSourceLines(brief: OpenDesignBrief): string[] {
  return [
    sourceLine('GitHub repo', brief.githubUrl),
    sourceLine('Local folder', brief.localFolder),
    sourceLine('Design file', brief.designFile),
    sourceLine('Assets', brief.assets),
    sourceLine('Audience', brief.audience),
    sourceLine('Surface', brief.surface),
  ].filter((line): line is string => Boolean(line));
}

function sourceLine(label: string, value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? `${label}: ${trimmed}` : null;
}

function previewHtml(name: string, state: OpenDesignStudioState): string {
  const direction = directionFor(state.directionId);
  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"><title>OpenDesign Preview</title>',
    '<style>',
    `body{margin:0;background:${direction.palette.canvas};color:${direction.palette.text};font-family:${direction.typography.ui},sans-serif}`,
    `main{min-height:100vh;display:grid;place-items:center;padding:48px}`,
    `section{max-width:820px;border:1px solid ${direction.palette.border};background:${direction.palette.surface};padding:28px}`,
    `h1{font-family:${direction.typography.display},serif;font-size:56px;line-height:1;margin:0 0 18px}`,
    `button{border:0;background:${direction.palette.accent};color:${direction.palette.canvas};padding:10px 14px;border-radius:${state.radius}px}`,
    '</style></head>',
    '<body><main><section data-design-widget="preview-canvas">',
    `<h1>${escapeHtml(name)}</h1>`,
    `<p>${escapeHtml(state.brief.prompt || direction.description)}</p>`,
    '<button data-design-widget="primary-action" aria-label="Primary design action">Run</button>',
    '</section></main></body></html>',
  ].join('');
}

function handoffMarkdown(name: string): string {
  return [
    `# ${name} handoff`,
    '',
    'Use DESIGN.md as the source of truth.',
    'Generated preview and research assets live under design/open-design/.',
    'Apply data-design-widget attributes when mapping tokens into UI code.',
  ].join('\n');
}

function exportContent(kind: OpenDesignExportKind, name: string, path: string): string {
  if (kind === 'html') {
    return '<!doctype html><html><body><main data-design-widget="preview-canvas">OpenDesign HTML export</main></body></html>';
  }
  if (kind === 'handoff') {
    return handoffMarkdown(name);
  }
  if (kind === 'cloudflare') {
    return [`# Cloudflare Pages deployment`, '', `Design system: ${name}`, `Artifact: ${path}`].join('\n');
  }
  return [`# ${kind.toUpperCase()} export`, '', `Design system: ${name}`, `Artifact: ${path}`].join('\n');
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'design-system';
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function escapeHtml(value: string): string {
  const escapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (char) => escapes[char]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
