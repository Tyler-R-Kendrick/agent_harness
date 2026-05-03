import { renderDesignMdCss } from 'harness-core';
import type { WorkspaceFile } from '../../types';

export const DESIGNER_MANIFEST_PATH = 'design/manifest.json';

export type DesignerFidelity = 'wireframe' | 'high';
export type DesignerManifestStatus = 'draft' | 'published';
export type DesignerExportKind = 'zip' | 'pdf' | 'pptx' | 'canva' | 'html' | 'handoff';
export type DesignerFileSection = 'Folders' | 'Stylesheets' | 'Documents' | 'Previews' | 'Sketches' | 'Exports' | 'Assets';

export interface DesignSystemSetupInput {
  projectName: string;
  companyBlurb: string;
  githubUrl: string;
  localFolder: string;
  figFile: string;
  assets: string;
  notes: string;
  fidelity: DesignerFidelity;
}

export interface DesignerSource {
  kind: 'github' | 'folder' | 'fig' | 'asset' | 'note';
  label: string;
  value: string;
}

export interface DesignerReviewComponent {
  id: string;
  label: string;
  variants: string[];
  status: 'needs-review' | 'approved' | 'needs-work';
}

export interface DesignerComment {
  id: string;
  target: string;
  body: string;
  createdAt: string;
}

export interface DesignerExportRecord {
  kind: DesignerExportKind;
  path: string;
  createdAt: string;
}

export interface DesignerManifest {
  version: 1;
  name: string;
  status: DesignerManifestStatus;
  default: boolean;
  projectName: string;
  fidelity: DesignerFidelity;
  createdAt: string;
  updatedAt: string;
  sources: DesignerSource[];
  review: {
    missing: string[];
    components: DesignerReviewComponent[];
    feedback: string[];
  };
  comments: DesignerComment[];
  exports: DesignerExportRecord[];
}

export interface DesignerFileEntry {
  kind: 'folder' | 'file';
  section: DesignerFileSection;
  path: string;
  name: string;
  content?: string;
  updatedAt?: string;
}

const REQUIRED_DESIGN_FOLDERS = [
  'design/assets',
  'design/fonts',
  'design/preview',
  'design/sketches',
  'design/ui_kits',
];

export function buildDesignSystemArtifacts(
  existingFiles: WorkspaceFile[],
  input: DesignSystemSetupInput,
  timestamp = new Date().toISOString(),
): WorkspaceFile[] {
  const name = normalizeDesignName(input.companyBlurb || input.projectName || 'Agent Browser Design System');
  const designFile: WorkspaceFile = {
    path: 'DESIGN.md',
    updatedAt: timestamp,
    content: buildDesignMd(name, input),
  };
  const css = renderDesignMdCss(designFile);
  const manifest = createDesignerManifest(name, input, timestamp);
  const files: WorkspaceFile[] = [
    designFile,
    {
      path: DESIGNER_MANIFEST_PATH,
      updatedAt: timestamp,
      content: JSON.stringify(manifest, null, 2),
    },
    {
      path: 'design/colors_and_type.css',
      updatedAt: timestamp,
      content: css.css,
    },
    {
      path: 'design/README.md',
      updatedAt: timestamp,
      content: buildDesignReadme(name, input),
    },
    {
      path: 'design/SKILL.md',
      updatedAt: timestamp,
      content: buildDesignSkill(name),
    },
    {
      path: 'design/preview/thumbnail.html',
      updatedAt: timestamp,
      content: buildPreviewHtml(name),
    },
    {
      path: 'design/ui_kits/button-card.html',
      updatedAt: timestamp,
      content: buildButtonKitHtml(),
    },
    ...REQUIRED_DESIGN_FOLDERS.map((folder) => ({
      path: `${folder}/.keep`,
      updatedAt: timestamp,
      content: '',
    })),
  ];

  return upsertMany(existingFiles, files);
}

export function readDesignerManifest(files: readonly WorkspaceFile[]): DesignerManifest | null {
  const file = files.find((entry) => entry.path === DESIGNER_MANIFEST_PATH);
  if (!file) return null;
  try {
    return normalizeManifest(JSON.parse(file.content), file.updatedAt);
  } catch {
    return null;
  }
}

export function updateDesignerManifest(
  files: WorkspaceFile[],
  updater: (manifest: DesignerManifest) => DesignerManifest,
  timestamp = new Date().toISOString(),
): WorkspaceFile[] {
  const existing = readDesignerManifest(files) ?? createDesignerManifest('Design System', {
    projectName: 'Design System',
    companyBlurb: '',
    githubUrl: '',
    localFolder: '',
    figFile: '',
    assets: '',
    notes: '',
    fidelity: 'high',
  }, timestamp);
  const updated = { ...updater(existing), updatedAt: timestamp };
  return upsertWorkspaceFile(files, {
    path: DESIGNER_MANIFEST_PATH,
    updatedAt: timestamp,
    content: JSON.stringify(updated, null, 2),
  });
}

export function createDesignerExportArtifact(
  kind: DesignerExportKind,
  designName: string,
  timestamp = new Date().toISOString(),
): WorkspaceFile {
  const slug = slugify(designName);
  const path = exportPath(kind, slug);
  return {
    path,
    updatedAt: timestamp,
    content: buildExportContent(kind, designName, path),
  };
}

export function createDesignerSketchArtifact(
  designName: string,
  timestamp = new Date().toISOString(),
): WorkspaceFile {
  const compactTime = timestamp.replace(/[^0-9]/g, '').slice(0, 14);
  return {
    path: `design/sketches/sketch-${compactTime}-${slugify(designName)}.napkin`,
    updatedAt: timestamp,
    content: [
      '# Designer sketch',
      '',
      `Design system: ${designName}`,
      `Saved: ${timestamp}`,
      '',
      '- Canvas: dotted infinite board',
      '- Tools: select, pan, pen, text, shape, arrow, component, save',
    ].join('\n'),
  };
}

export function listDesignerFileEntries(files: readonly WorkspaceFile[]): DesignerFileEntry[] {
  const designFiles = files.filter((file) => file.path === 'DESIGN.md' || file.path.startsWith('design/'));
  const folderPaths = new Set<string>();
  for (const file of designFiles) {
    const parts = file.path.split('/');
    for (let index = 1; index < parts.length; index += 1) {
      folderPaths.add(parts.slice(0, index).join('/'));
    }
  }
  for (const folder of REQUIRED_DESIGN_FOLDERS) {
    folderPaths.add('design');
    folderPaths.add(folder);
  }

  const folders: DesignerFileEntry[] = [...folderPaths].sort().map((path) => ({
    kind: 'folder',
    section: 'Folders',
    path,
    name: path.split('/').pop() ?? path,
  }));
  const fileEntries = designFiles
    .filter((file) => !file.path.endsWith('/.keep'))
    .map((file): DesignerFileEntry => ({
      kind: 'file',
      section: sectionForPath(file.path),
      path: file.path,
      name: file.path.split('/').pop() ?? file.path,
      content: file.content,
      updatedAt: file.updatedAt,
    }))
    .sort((a, b) => `${a.section}:${a.path}`.localeCompare(`${b.section}:${b.path}`));

  return [...folders, ...fileEntries];
}

export function upsertWorkspaceFile(files: WorkspaceFile[], file: WorkspaceFile): WorkspaceFile[] {
  const index = files.findIndex((entry) => entry.path === file.path);
  if (index === -1) return [...files, file];
  return files.map((entry, entryIndex) => (entryIndex === index ? file : entry));
}

function upsertMany(files: WorkspaceFile[], nextFiles: WorkspaceFile[]): WorkspaceFile[] {
  return nextFiles.reduce((current, file) => upsertWorkspaceFile(current, file), files);
}

function createDesignerManifest(name: string, input: DesignSystemSetupInput, timestamp: string): DesignerManifest {
  return {
    version: 1,
    name,
    status: 'draft',
    default: false,
    projectName: input.projectName || name,
    fidelity: input.fidelity,
    createdAt: timestamp,
    updatedAt: timestamp,
    sources: collectSources(input),
    review: {
      missing: ['Brand fonts are substituted until font files are added.'],
      feedback: [],
      components: [
        { id: 'buttons', label: 'Buttons', variants: ['Secondary', 'Primary', 'Icon', 'Chip'], status: 'needs-review' },
        { id: 'cards', label: 'Cards', variants: ['Default', 'Preview', 'Warning'], status: 'needs-review' },
        { id: 'navigation', label: 'Navigation', variants: ['Tabs', 'Files', 'Share menu'], status: 'needs-review' },
      ],
    },
    comments: [],
    exports: [],
  };
}

function normalizeManifest(value: unknown, fallbackTimestamp: string): DesignerManifest | null {
  if (!isRecord(value)) return null;
  const name = typeof value.name === 'string' ? value.name : 'Design System';
  const review = isRecord(value.review) ? value.review : {};
  return {
    version: 1,
    name,
    status: value.status === 'published' ? 'published' : 'draft',
    default: value.default === true,
    projectName: typeof value.projectName === 'string' ? value.projectName : name,
    fidelity: value.fidelity === 'wireframe' ? 'wireframe' : 'high',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : fallbackTimestamp,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : fallbackTimestamp,
    sources: Array.isArray(value.sources) ? value.sources.filter(isDesignerSource) : [],
    review: {
      missing: Array.isArray(review.missing) ? review.missing.map(String) : [],
      feedback: Array.isArray(review.feedback) ? review.feedback.map(String) : [],
      components: Array.isArray(review.components) ? review.components.filter(isReviewComponent) : [],
    },
    comments: Array.isArray(value.comments) ? value.comments.filter(isDesignerComment) : [],
    exports: Array.isArray(value.exports) ? value.exports.filter(isExportRecord) : [],
  };
}

function collectSources(input: DesignSystemSetupInput): DesignerSource[] {
  const sources: DesignerSource[] = [];
  if (input.githubUrl.trim()) sources.push({ kind: 'github', label: 'GitHub repo', value: input.githubUrl.trim() });
  if (input.localFolder.trim()) sources.push({ kind: 'folder', label: 'Local folder', value: input.localFolder.trim() });
  if (input.figFile.trim()) sources.push({ kind: 'fig', label: '.fig file', value: input.figFile.trim() });
  if (input.assets.trim()) sources.push({ kind: 'asset', label: 'Fonts, logos, and assets', value: input.assets.trim() });
  if (input.notes.trim()) sources.push({ kind: 'note', label: 'Notes', value: input.notes.trim() });
  return sources;
}

function buildDesignMd(name: string, input: DesignSystemSetupInput): string {
  return [
    '---',
    `name: ${name}`,
    `description: ${input.companyBlurb || 'Claude Design style system for Agent Browser.'}`,
    'colors:',
    '  canvas: "#f8f5ef"',
    '  surface: "#ffffff"',
    '  surfaceRaised: "#fbfaf7"',
    '  text: "#1f1b16"',
    '  muted: "#6f655c"',
    '  accent: "#d97757"',
    '  accentStrong: "#c96042"',
    '  warning: "#f2b8a2"',
    'typography:',
    '  display:',
    '    fontFamily: Georgia',
    '    fontSize: 28px',
    '    fontWeight: "500"',
    '    lineHeight: "1.15"',
    '  ui:',
    '    fontFamily: Inter',
    '    fontSize: 13px',
    '    fontWeight: "500"',
    '    lineHeight: "1.4"',
    'rounded:',
    '  sm: 5px',
    '  md: 8px',
    '  lg: 12px',
    'spacing:',
    '  xs: 4px',
    '  sm: 8px',
    '  md: 12px',
    '  lg: 20px',
    'shadows:',
    '  raised: 0 12px 28px rgba(31, 27, 22, 0.12)',
    'motion:',
    '  quick: 140ms ease',
    'themes:',
    '  agent-browser-dark:',
    '    colors:',
    '      canvas: "#101114"',
    '      surface: "#181818"',
    '      surfaceRaised: "#252526"',
    '      text: "#f4f4f5"',
    '      muted: "#a9b1ba"',
    '      accent: "#e07a5f"',
    '      accentStrong: "#f2b8a2"',
    'styles:',
    '  agentBrowser:',
    '    app-bg: colors.canvas',
    '    panel-bg: colors.surface',
    '    panel-bg-elevated: colors.surfaceRaised',
    '    panel-bg-soft: colors.surfaceRaised',
    '    panel-border: rgba(31, 27, 22, 0.14)',
    '    panel-border-strong: rgba(31, 27, 22, 0.28)',
    '    text-soft: colors.muted',
    '    text-muted: colors.muted',
    '    accent: colors.accent',
    '    accent-strong: colors.accentStrong',
    '  widgets:',
    '    button-primary:',
    '      background: colors.accent',
    '      color: colors.surface',
    '      border-radius: rounded.md',
    '      box-shadow: shadows.raised',
    '    button-secondary:',
    '      background: colors.surface',
    '      color: colors.text',
    '      border: 1px solid rgba(31, 27, 22, 0.14)',
    'components:',
    '  buttons: Primary, secondary, icon, and chip states.',
    '  cards: Review, preview, warning, and file-row states.',
    '---',
    '',
    `# ${name}`,
    '',
    input.companyBlurb || 'This design system recreates Claude Design style workflows inside Agent Browser.',
    '',
    '## Source Caveats',
    '',
    '- Fonts can be substituted until licensed font files are added.',
    '- Colors are sampled from supplied assets and may need brand-owner confirmation.',
    '- Component patterns target Agent Browser widgets and the Agent Browser shell.',
  ].join('\n');
}

function buildDesignReadme(name: string, input: DesignSystemSetupInput): string {
  return [
    `# ${name}`,
    '',
    'This folder is managed by the Agent Browser Designer feature.',
    '',
    `Fidelity: ${input.fidelity}`,
    'Primary files:',
    '- DESIGN.md: canonical design-system source',
    '- colors_and_type.css: generated CSS token block',
    '- ui_kits/: component previews',
    '- preview/: generated thumbnails',
    '- sketches/: saved sketch canvases',
  ].join('\n');
}

function buildDesignSkill(name: string): string {
  return [
    '---',
    `name: ${slugify(name)}`,
    `description: Use this skill when applying the ${name} DESIGN.md design system.`,
    '---',
    '',
    '# Apply Design System',
    '',
    '1. Read DESIGN.md before changing UI.',
    '2. Use generated tokens from design/colors_and_type.css.',
    '3. Apply widget styles with data-design-widget attributes.',
  ].join('\n');
}

function buildPreviewHtml(name: string): string {
  return [
    '<main data-design-widget="preview-card">',
    `  <h1>${escapeHtml(name)}</h1>`,
    '  <button data-design-widget="button-primary">Primary</button>',
    '  <button data-design-widget="button-secondary">Secondary</button>',
    '</main>',
  ].join('\n');
}

function buildButtonKitHtml(): string {
  return [
    '<section data-design-widget="button-card">',
    '  <button data-design-widget="button-secondary">Secondary</button>',
    '  <button data-design-widget="button-primary">Run</button>',
    '  <button data-design-widget="button-primary">Active</button>',
    '</section>',
  ].join('\n');
}

function buildExportContent(kind: DesignerExportKind, designName: string, path: string): string {
  if (kind === 'handoff') {
    return [
      `# Handoff: ${designName}`,
      '',
      'Use DESIGN.md as the source of truth.',
      'Generated assets are in design/.',
      'Apply data-design-widget attributes for component styling.',
    ].join('\n');
  }
  if (kind === 'html') {
    return [
      '<!doctype html>',
      '<html><head><meta charset="utf-8"><title>Designer Export</title></head>',
      `<body><main><h1>${escapeHtml(designName)}</h1><p>Standalone HTML export from Agent Browser Designer.</p></main></body></html>`,
    ].join('\n');
  }
  return [
    `# ${exportLabel(kind)} export`,
    '',
    `Design system: ${designName}`,
    `Artifact path: ${path}`,
    '',
    'This local artifact records the export request inside Agent Browser.',
  ].join('\n');
}

function exportPath(kind: DesignerExportKind, slug: string): string {
  if (kind === 'handoff') return `design/exports/${slug}-handoff.md`;
  if (kind === 'canva') return `design/exports/${slug}-canva.md`;
  return `design/exports/${slug}.${kind}`;
}

function exportLabel(kind: DesignerExportKind): string {
  const labels: Record<DesignerExportKind, string> = {
    zip: 'Project zip',
    pdf: 'PDF',
    pptx: 'PPTX',
    canva: 'Canva handoff',
    html: 'Standalone HTML',
    handoff: 'Claude Code handoff',
  };
  return labels[kind];
}

function sectionForPath(path: string): DesignerFileSection {
  if (path.includes('/exports/')) return 'Exports';
  if (path.includes('/preview/')) return 'Previews';
  if (path.includes('/sketches/')) return 'Sketches';
  if (/\.(css)$/i.test(path)) return 'Stylesheets';
  if (/\.(md|json)$/i.test(path) || path === 'DESIGN.md') return 'Documents';
  return 'Assets';
}

function normalizeDesignName(value: string): string {
  const words = value
    .replace(/https?:\/\/\S+/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  return words.length ? words.join(' ') : 'Agent Browser Design System';
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'design-system';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char));
}

function isDesignerSource(value: unknown): value is DesignerSource {
  return isRecord(value)
    && ['github', 'folder', 'fig', 'asset', 'note'].includes(String(value.kind))
    && typeof value.label === 'string'
    && typeof value.value === 'string';
}

function isReviewComponent(value: unknown): value is DesignerReviewComponent {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.label === 'string'
    && Array.isArray(value.variants)
    && ['needs-review', 'approved', 'needs-work'].includes(String(value.status));
}

function isDesignerComment(value: unknown): value is DesignerComment {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.target === 'string'
    && typeof value.body === 'string'
    && typeof value.createdAt === 'string';
}

function isExportRecord(value: unknown): value is DesignerExportRecord {
  return isRecord(value)
    && ['zip', 'pdf', 'pptx', 'canva', 'html', 'handoff'].includes(String(value.kind))
    && typeof value.path === 'string'
    && typeof value.createdAt === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
