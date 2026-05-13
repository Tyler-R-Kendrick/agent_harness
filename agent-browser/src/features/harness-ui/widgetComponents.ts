export type WidgetNode = {
  type: string;
  children?: WidgetNode[];
  [key: string]: unknown;
};

export type WidgetDocument = WidgetNode;

export type WidgetComponentCategory = 'container' | 'layout' | 'content' | 'input' | 'action';

export type WidgetComponentDefinition = {
  type: string;
  label: string;
  category: WidgetComponentCategory;
  description: string;
  allowedProps: string[];
  designTokens: string[];
  designSystemBindings: string[];
  adaptiveCardAnalog: string;
  defaultNode: WidgetNode;
};

const UNSAFE_WIDGET_PROPS = new Set(['className', 'style', 'dangerouslySetInnerHTML', 'html', 'script']);
const SHARED_PROPS = ['key', 'visible'];
const SURFACE_PROPS = ['background', 'border', 'radius', 'padding', 'margin'];
const SIZE_PROPS = ['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'size', 'minSize', 'maxSize', 'aspectRatio', 'flex'];
const LAYOUT_PROPS = [...SURFACE_PROPS, ...SIZE_PROPS, 'gap', 'align', 'justify', 'wrap'];
const TEXT_PROPS = [...SHARED_PROPS, ...SIZE_PROPS, 'value', 'color', 'size', 'weight', 'textAlign', 'italic', 'lineThrough', 'truncate', 'minLines', 'maxLines', 'streaming', 'editable'];
const ACTION_CONFIG_PROPS = ['action', 'onClickAction', 'onChangeAction', 'onSubmitAction'];

const CATALOG: WidgetComponentDefinition[] = [
  {
    type: 'Card',
    label: 'Card',
    category: 'container',
    description: 'Bounded root container for widget content and action buttons.',
    allowedProps: [...SHARED_PROPS, ...SURFACE_PROPS, 'size', 'status', 'collapsed', 'asForm', 'confirm', 'cancel', 'theme'],
    designTokens: ['widget.surface', 'widget.border', 'widget.radius', 'widget.shadow'],
    designSystemBindings: ['color.surface', 'color.border', 'radius.card', 'shadow.card'],
    adaptiveCardAnalog: 'AdaptiveCard',
    defaultNode: { type: 'Card', size: 'md', children: [] },
  },
  {
    type: 'Box',
    label: 'Box',
    category: 'layout',
    description: 'Flexible layout container with direction, spacing, and surface props.',
    allowedProps: [...SHARED_PROPS, ...LAYOUT_PROPS, 'direction'],
    designTokens: ['widget.layout', 'widget.spacing', 'widget.surface'],
    designSystemBindings: ['spacing.stack', 'color.surface', 'radius.panel'],
    adaptiveCardAnalog: 'Container',
    defaultNode: { type: 'Box', direction: 'column', gap: 2, children: [] },
  },
  {
    type: 'Row',
    label: 'Row',
    category: 'layout',
    description: 'Horizontal child arrangement.',
    allowedProps: [...SHARED_PROPS, ...LAYOUT_PROPS],
    designTokens: ['widget.row', 'widget.spacing'],
    designSystemBindings: ['spacing.inline', 'layout.row'],
    adaptiveCardAnalog: 'ColumnSet',
    defaultNode: { type: 'Row', gap: 2, children: [] },
  },
  {
    type: 'Col',
    label: 'Column',
    category: 'layout',
    description: 'Vertical child arrangement.',
    allowedProps: [...SHARED_PROPS, ...LAYOUT_PROPS],
    designTokens: ['widget.column', 'widget.spacing'],
    designSystemBindings: ['spacing.stack', 'layout.column'],
    adaptiveCardAnalog: 'Column',
    defaultNode: { type: 'Col', gap: 2, children: [] },
  },
  {
    type: 'Title',
    label: 'Title',
    category: 'content',
    description: 'Prominent heading text.',
    allowedProps: TEXT_PROPS,
    designTokens: ['widget.title', 'widget.text'],
    designSystemBindings: ['typography.heading', 'color.text'],
    adaptiveCardAnalog: 'TextBlock',
    defaultNode: { type: 'Title', value: 'Widget title', size: 'lg' },
  },
  {
    type: 'Text',
    label: 'Text',
    category: 'content',
    description: 'Plain text content with tokenized color and type controls.',
    allowedProps: TEXT_PROPS,
    designTokens: ['widget.text', 'widget.mutedText'],
    designSystemBindings: ['typography.body', 'color.text'],
    adaptiveCardAnalog: 'TextBlock',
    defaultNode: { type: 'Text', value: 'Widget text' },
  },
  {
    type: 'Badge',
    label: 'Badge',
    category: 'content',
    description: 'Compact metadata or status label.',
    allowedProps: [...SHARED_PROPS, 'label', 'color', 'variant', 'pill', 'size'],
    designTokens: ['widget.badge', 'widget.status'],
    designSystemBindings: ['component.badge', 'color.status'],
    adaptiveCardAnalog: 'Badge',
    defaultNode: { type: 'Badge', label: 'Status', color: 'info', variant: 'soft' },
  },
  {
    type: 'Button',
    label: 'Button',
    category: 'action',
    description: 'Action button with typed payload binding.',
    allowedProps: [...SHARED_PROPS, ...ACTION_CONFIG_PROPS, 'submit', 'style', 'label', 'iconStart', 'iconEnd', 'color', 'variant', 'size', 'pill', 'block', 'disabled'],
    designTokens: ['widget.button', 'widget.action'],
    designSystemBindings: ['component.button', 'color.action'],
    adaptiveCardAnalog: 'Action.Submit',
    defaultNode: { type: 'Button', label: 'Continue', action: { type: 'widget.continue' } },
  },
  {
    type: 'Image',
    label: 'Image',
    category: 'content',
    description: 'Image content with fit, frame, and accessibility metadata.',
    allowedProps: [...SHARED_PROPS, ...SURFACE_PROPS, ...SIZE_PROPS, 'src', 'alt', 'fit', 'position', 'frame', 'flush'],
    designTokens: ['widget.image', 'widget.mediaFrame'],
    designSystemBindings: ['component.image', 'radius.media'],
    adaptiveCardAnalog: 'Image',
    defaultNode: { type: 'Image', src: '', alt: '' },
  },
  {
    type: 'ListView',
    label: 'List view',
    category: 'container',
    description: 'Vertical list root or nested list.',
    allowedProps: [...SHARED_PROPS, 'limit', 'status', 'theme'],
    designTokens: ['widget.list', 'widget.row'],
    designSystemBindings: ['component.list', 'spacing.stack'],
    adaptiveCardAnalog: 'Container',
    defaultNode: { type: 'ListView', children: [] },
  },
  {
    type: 'ListViewItem',
    label: 'List item',
    category: 'container',
    description: 'Clickable or static list item.',
    allowedProps: [...SHARED_PROPS, 'onClickAction', 'gap', 'align'],
    designTokens: ['widget.listItem', 'widget.row'],
    designSystemBindings: ['component.listItem', 'spacing.inline'],
    adaptiveCardAnalog: 'Container',
    defaultNode: { type: 'ListViewItem', gap: 2, children: [] },
  },
  {
    type: 'Markdown',
    label: 'Markdown',
    category: 'content',
    description: 'Markdown-formatted text for rich snippets.',
    allowedProps: [...SHARED_PROPS, 'value', 'streaming'],
    designTokens: ['widget.markdown', 'widget.text'],
    designSystemBindings: ['typography.body', 'typography.code'],
    adaptiveCardAnalog: 'RichTextBlock',
    defaultNode: { type: 'Markdown', value: '**Markdown** text' },
  },
  {
    type: 'Select',
    label: 'Select',
    category: 'input',
    description: 'Single-select input with typed action payload.',
    allowedProps: [...SHARED_PROPS, 'options', 'onChangeAction', 'name', 'placeholder', 'defaultValue', 'variant', 'size', 'pill', 'block', 'clearable', 'disabled'],
    designTokens: ['widget.input', 'widget.select'],
    designSystemBindings: ['component.input', 'color.input'],
    adaptiveCardAnalog: 'Input.ChoiceSet',
    defaultNode: { type: 'Select', name: 'choice', options: [{ label: 'Option', value: 'option' }] },
  },
  {
    type: 'Spacer',
    label: 'Spacer',
    category: 'layout',
    description: 'Flexible empty space for layout composition.',
    allowedProps: [...SHARED_PROPS, 'minSize'],
    designTokens: ['widget.spacing', 'widget.layout'],
    designSystemBindings: ['spacing.stack', 'layout.spacer'],
    adaptiveCardAnalog: 'Container',
    defaultNode: { type: 'Spacer', minSize: 8 },
  },
];

const CATALOG_BY_TYPE = new Map(CATALOG.map((entry) => [entry.type, entry]));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function listDefaultWidgetComponents(): WidgetComponentDefinition[] {
  return CATALOG.map((entry) => clone(entry));
}

export function getDefaultWidgetComponent(type: string): WidgetComponentDefinition | null {
  const entry = CATALOG_BY_TYPE.get(type);
  return entry ? clone(entry) : null;
}

export function createDefaultWidgetDocument(title: string): WidgetDocument {
  const normalizedTitle = title.trim() || 'New widget';
  return {
    type: 'Card',
    size: 'md',
    theme: 'dark',
    children: [
      { type: 'Title', value: normalizedTitle, size: 'lg' },
      { type: 'Text', value: '{{summary}}', color: 'secondary' },
      {
        type: 'Row',
        gap: 2,
        children: [
          { type: 'Badge', label: '{{status}}', color: 'info', variant: 'soft' },
          { type: 'Text', value: '{{detail}}', color: 'tertiary' },
        ],
      },
    ],
    confirm: { label: 'Apply', action: { type: 'widget.apply' } },
    cancel: { label: 'Dismiss', action: { type: 'widget.dismiss' } },
  };
}

const TITLE_PREFIX_PATTERN = /^(please\s+)?(create|make|build|add|generate|show|display|surface|summarize|monitor|track)\s+(me\s+|a\s+|an\s+|the\s+)?/iu;
const TITLE_SPLIT_PATTERN = /\b(with|for|from|using|that|which|where|by|and|including)\b/iu;

function toSentenceTitle(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (!normalized) return 'New widget';
  const words = normalized.split(' ').slice(0, 5);
  return words.map((word, index) => {
    if (/^[A-Z0-9]{2,}$/u.test(word)) return word;
    const normalizedWord = word.toLowerCase();
    return index === 0 ? `${normalizedWord.charAt(0).toUpperCase()}${normalizedWord.slice(1)}` : normalizedWord;
  }).join(' ');
}

export function deriveWidgetTitleFromPrompt(prompt: string): string {
  const normalizedPrompt = prompt.trim().replace(/\s+/gu, ' ');
  if (!normalizedPrompt) return 'New widget';
  const promptWithoutWidgetWords = normalizedPrompt
    .replace(TITLE_PREFIX_PATTERN, '')
    .replace(/\b(dashboard\s+)?widget\b/giu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim();
  const [titleSeed] = promptWithoutWidgetWords.split(TITLE_SPLIT_PATTERN);
  return toSentenceTitle((titleSeed ?? '').trim() || normalizedPrompt);
}

export function createPromptedWidgetDocument(prompt: string): WidgetDocument {
  const title = deriveWidgetTitleFromPrompt(prompt);
  return {
    type: 'Card',
    size: 'md',
    theme: 'dark',
    children: [
      { type: 'Title', value: title, size: 'lg' },
      { type: 'Text', value: '{{summary}}', color: 'secondary' },
      {
        type: 'Row',
        gap: 2,
        children: [
          { type: 'Badge', label: '{{status}}', color: 'info', variant: 'soft' },
          { type: 'Text', value: '{{detail}}', color: 'tertiary' },
        ],
      },
      { type: 'Text', value: '{{owner}}', color: 'tertiary', size: 'sm' },
    ],
    confirm: { label: 'Apply', action: { type: 'widget.apply' } },
    cancel: { label: 'Dismiss', action: { type: 'widget.dismiss' } },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isWidgetDocument(value: unknown): value is WidgetDocument {
  return isRecord(value) && typeof value.type === 'string';
}

export function assertWidgetNodeAllowedByCatalog(node: unknown): asserts node is WidgetNode {
  if (!isWidgetDocument(node)) {
    throw new Error('Widget node must be an object with a string type.');
  }

  const catalogEntry = CATALOG_BY_TYPE.get(node.type);
  if (!catalogEntry) {
    throw new Error(`Widget node uses uncataloged type "${node.type}".`);
  }

  for (const propName of Object.keys(node)) {
    if (propName === 'type' || propName === 'children') continue;
    if (UNSAFE_WIDGET_PROPS.has(propName) || !catalogEntry.allowedProps.includes(propName)) {
      throw new Error(`Widget node "${node.type}" uses unsupported prop "${propName}".`);
    }
  }

  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) {
      throw new Error(`Widget node "${node.type}" children must be an array.`);
    }
    for (const child of node.children) {
      assertWidgetNodeAllowedByCatalog(child);
    }
  }
}

export function parseWidgetDocumentJson(value: string): WidgetDocument {
  const parsed = JSON.parse(value) as unknown;
  assertWidgetNodeAllowedByCatalog(parsed);
  return parsed;
}

export function readWidgetDocument(value: unknown, fallbackTitle: string): WidgetDocument {
  if (isWidgetDocument(value)) {
    assertWidgetNodeAllowedByCatalog(value);
    return clone(value);
  }
  return createDefaultWidgetDocument(fallbackTitle);
}
