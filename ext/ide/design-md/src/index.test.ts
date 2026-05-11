import { describe, expect, it, vi } from 'vitest';

import {
  buildDesignMdGuidanceMessage,
  createCssDesignTokenApplyProvider,
  createDesignMdPlugin,
  createLlGuidanceDesignSubstitutionProvider,
  discoverDesignMdSemanticHooks,
  listDesignMdThemeOptions,
  renderDesignMdCss,
  type DesignMdApplyProvider,
} from './index.js';
import {
  createHarnessExtensionContext,
  type CoreInferenceOptions,
} from 'harness-core';

const DESIGN_MD = `---
name: Heritage
colors:
  primary: "#1A1C1E"
  tertiary: "#B8422E"
typography:
  h1:
    fontFamily: Public Sans
    fontSize: 3rem
rounded:
  sm: 4px
spacing:
  md: 16px
---

## Overview
Architectural Minimalism meets Journalistic Gravitas.

## Colors
Use tertiary only for primary actions.
`;

const designDocument = {
  path: 'DESIGN.md',
  content: DESIGN_MD,
};

const CLAUDE_DESIGN_MD = `---
name: Agent Browser Design System
colors:
  canvas: "#1e1e1e"
  surface: "#181818"
  accent: "#0ea5e9"
  text: "#e4e4e7"
typography:
  ui:
    fontFamily: Segoe UI
    fontSize: 13px
rounded:
  sm: 4px
spacing:
  md: 16px
shadows:
  floating: 0 14px 32px rgba(0,0,0,.45)
motion:
  standard: 140ms ease
themes:
  claude-light:
    colors:
      canvas: "#f8f6f2"
      surface: "#ffffff"
      accent: "#d97757"
    typography:
      ui:
        fontSize: 14px
      caption:
        fontSize: 12px
    rounded:
      sm: 6px
    spacing:
      md: 18px
    shadows:
      floating: 0 10px 24px rgba(0,0,0,.35)
    motion:
      standard: 180ms ease
styles:
  agentBrowser:
    app-bg: colors.canvas
    panel-bg: colors.surface
    panel-bg-elevated: "#faf8f4"
    accent: colors.accent
    accent-strong: colors.missing
    text-soft: colors.text
  widgets:
    buttonPrimary:
      background: colors.accent
      color: colors.text
      border-color: colors.accent
      font-family: typography.ui.fontFamily
---

## Design Studio
Design Studio exports swappable shell and widget styling through DESIGN.md.
`;

describe('design.md extension plugin', () => {
  it('uses semantic hooks to inject design guidance only for design-facing requests', async () => {
    const context = createHarnessExtensionContext();
    await context.plugins.load(createDesignMdPlugin({ documents: [designDocument] }));

    const designRequest = await context.hooks.run('before-llm-messages', {
      messages: [{ role: 'user', content: 'Build a React button component with polished styling.' }],
    });
    const plainRequest = await context.hooks.run('before-llm-messages', {
      messages: [{ role: 'user', content: 'Summarize this server log.' }],
    });

    expect(discoverDesignMdSemanticHooks({
      messages: [{ role: 'user', content: 'Tune the CSS layout for src/App.tsx.' }],
      targetPath: 'src/App.tsx',
    }).map((hook) => hook.id)).toEqual(['design-language', 'frontend-code-path']);
    expect(discoverDesignMdSemanticHooks({
      metadata: { task: 'design a settings panel', targetPath: 'src/styles.css' },
    }).map((hook) => hook.id)).toEqual(['design-language', 'frontend-code-path']);
    expect(designRequest.payload.messages).toHaveLength(2);
    expect(designRequest.payload.messages[0]).toMatchObject({ role: 'system' });
    expect(designRequest.payload.messages[0].content).toContain('DESIGN.md: Heritage');
    expect(designRequest.payload.messages[0].content).toContain('Colors: primary #1A1C1E; tertiary #B8422E');
    expect(designRequest.outputs).toEqual([{
      hookId: 'design-md.semantic-guidance',
      output: { applied: true, designPath: 'DESIGN.md', semanticHooks: ['design-language'] },
    }]);
    expect(plainRequest.payload.messages).toEqual([{ role: 'user', content: 'Summarize this server log.' }]);
    expect(plainRequest.outputs).toEqual([{
      hookId: 'design-md.semantic-guidance',
      output: { applied: false, reason: 'no-semantic-hook-match' },
    }]);
  });

  it('handles sparse plugin inputs and no-document branches', async () => {
    const emptyContext = createHarnessExtensionContext();
    await emptyContext.plugins.load(createDesignMdPlugin({ documents: [] }));
    const context = createHarnessExtensionContext();
    await context.plugins.load(createDesignMdPlugin({ documents: [designDocument] }));

    await expect(emptyContext.tools.execute('design-md.apply', {})).rejects.toThrow('No DESIGN.md document is available.');
    await expect(context.tools.execute('design-md.apply', {
      targetPath: 'README.md',
      targetContent: '# Notes',
    })).rejects.toThrow('No design.md apply provider can handle README.md');
    await expect(context.tools.execute('design-md.apply', {
      targetPath: 'src/App.css',
      targetContent: 'body {}\n',
    })).resolves.toMatchObject({
      providerId: 'css-design-tokens',
      targetPath: 'src/App.css',
    });
    await expect(context.tools.execute('design-md.apply', {
      providerId: 'css-design-tokens',
    })).resolves.toMatchObject({
      content: expect.stringContaining('design.md:start'),
      targetPath: '',
    });
    await expect(emptyContext.hooks.run('before-llm-messages', { messages: [] })).resolves.toMatchObject({
      outputs: [{ hookId: 'design-md.semantic-guidance', output: { applied: false, reason: 'no-design-md-document' } }],
    });
    await expect(context.hooks.run(
      'before-llm-messages',
      { messages: [{}] },
      { metadata: { targetPath: 'src/App.css' } },
    )).resolves.toMatchObject({
      payload: {
        messages: [
          expect.objectContaining({ role: 'system' }),
          { role: 'user', content: '' },
        ],
      },
    });
  });

  it('applies DESIGN.md tokens through deterministic CSS code substitution', async () => {
    const provider = createCssDesignTokenApplyProvider();
    const sparseDesign = {
      path: 'docs/DESIGN.md',
      content: `---
# comment
colors: "#ffffff"
typography:
  display: "plain"
spacing:

---
# Plain
No front matter name.
`,
    };
    const first = await provider.apply({
      design: designDocument,
      target: { path: 'src/App.css', content: 'body { margin: 0; }\n' },
      intent: { kind: 'code-substitution' },
    });
    const second = await provider.apply({
      design: designDocument,
      target: { path: 'src/App.css', content: first.content.replace('--design-color-primary: #1A1C1E;', '--design-color-primary: old;') },
      intent: { kind: 'code-substitution' },
    });

    expect(provider.canApply({ design: designDocument, target: { path: 'src/App.css', content: '' }, intent: { kind: 'code-substitution' } })).toBe(true);
    expect(provider.canApply({ design: designDocument, target: { path: 'src/App.tsx', content: '' }, intent: { kind: 'code-substitution' } })).toBe(false);
    expect(first.content).toContain('/* design.md:start */');
    expect(first.content).toContain('--design-color-primary: #1A1C1E;');
    expect(first.content).toContain('--design-font-family-h1: Public Sans;');
    expect(first.content).toContain('--design-radius-sm: 4px;');
    expect(first.content).toContain('--design-space-md: 16px;');
    expect(first.content).toContain('body { margin: 0; }');
    expect(first.substitutions[0]).toMatchObject({ providerId: 'css-design-tokens', method: 'marker-insert' });
    expect(second.content.match(/design\.md:start/g)).toHaveLength(1);
    expect(second.content).toContain('--design-color-primary: #1A1C1E;');
    expect(second.substitutions[0]).toMatchObject({ providerId: 'css-design-tokens', method: 'marker-replace' });
    expect(await provider.apply({
      design: sparseDesign,
      target: { path: 'src/App.css', content: '' },
      intent: { kind: 'code-substitution' },
    })).toMatchObject({
      content: expect.not.stringContaining('--design-color-'),
      substitutions: [expect.objectContaining({ method: 'marker-insert' })],
    });
    expect(buildDesignMdGuidanceMessage(sparseDesign)).toContain('DESIGN.md: docs/DESIGN.md');
    expect(buildDesignMdGuidanceMessage(sparseDesign)).toContain('Typography: display');
    expect(buildDesignMdGuidanceMessage({
      path: 'docs/plain-DESIGN.md',
      content: '# Plain\nNo frontmatter here.',
    })).toBe([
      'DESIGN.md: docs/plain-DESIGN.md',
      'Source: docs/plain-DESIGN.md',
      'Apply these design tokens as normative values. Use the markdown rationale for taste, hierarchy, and exceptions.',
      '# Plain\nNo frontmatter here.',
    ].join('\n\n'));
  });

  it('renders DESIGN.md themes into shell and widget CSS targets', () => {
    const document = { path: 'DESIGN.md', content: CLAUDE_DESIGN_MD };
    const rendered = renderDesignMdCss(document, { themeId: 'claude-light' });

    expect(listDesignMdThemeOptions(document)).toEqual([
      { id: 'default', label: 'Agent Browser Design System' },
      { id: 'claude-light', label: 'claude-light' },
    ]);
    expect(rendered.themeId).toBe('claude-light');
    expect(rendered.variables).toMatchObject({
      '--app-bg': '#f8f6f2',
      '--panel-bg': '#ffffff',
      '--panel-bg-elevated': '#faf8f4',
      '--accent': '#d97757',
      '--text-soft': '#e4e4e7',
    });
    expect(rendered.css).toContain('--design-color-canvas: #f8f6f2;');
    expect(rendered.css).toContain('--design-font-size-ui: 14px;');
    expect(rendered.css).toContain('--design-font-size-caption: 12px;');
    expect(rendered.css).toContain('--design-radius-sm: 6px;');
    expect(rendered.css).toContain('--design-space-md: 18px;');
    expect(rendered.css).toContain('--design-shadow-floating: 0 10px 24px rgba(0,0,0,.35);');
    expect(rendered.css).toContain('--design-motion-standard: 180ms ease;');
    expect(rendered.css).toContain('--app-bg: var(--design-color-canvas);');
    expect(rendered.css).toContain('[data-design-widget="button-primary"]');
    expect(rendered.css).toContain('background: var(--design-color-accent);');
    expect(rendered.css).toContain('color: var(--design-color-text);');
    expect(rendered.css).toContain('font-family: var(--design-font-family-ui);');
    expect(rendered.diagnostics).toContain('Missing token reference colors.missing for styles.agentBrowser.accent-strong.');
  });

  it('reports unknown themes and skips unsafe DESIGN.md style values', () => {
    const rendered = renderDesignMdCss({
      path: 'DESIGN.md',
      content: `---
name: Risky
colors:
  canvas: "#111111"
  "@@": "#222222"
  dangerous: "bad; nope"
styles:
  agentBrowser:
    app-bg: "red; color: blue"
    panel-bg: colors.canvas
  widgets:
    broken:
      background: colors.missing
---
`,
    }, { themeId: 'missing-theme' });

    expect(rendered.themeId).toBe('default');
    expect(rendered.variables).toEqual({ '--panel-bg': '#111111' });
    expect(rendered.css).toContain('--design-color-token: #222222;');
    expect(rendered.css).toContain('--panel-bg: var(--design-color-canvas);');
    expect(rendered.css).not.toContain('red; color');
    expect(rendered.css).not.toContain('[data-design-widget="broken"]');
    expect(rendered.diagnostics).toEqual([
      'Unknown DESIGN.md theme "missing-theme"; using default tokens.',
      'Skipped unsafe value for colors.dangerous.',
      'Skipped unsafe value for styles.agentBrowser.app-bg.',
      'Missing token reference colors.missing for styles.widgets.broken.background.',
    ]);

    const emptyTheme = renderDesignMdCss({
      path: 'DESIGN.md',
      content: `---
name: Empty Theme
colors:
  canvas: "#111111"
typography:
  ui:
    fontFamily: System UI
rounded:
  sm: 4px
spacing:
  md: 16px
shadows:
  floating: 0 8px 20px rgba(0,0,0,.2)
motion:
  standard: 120ms ease
themes:
  empty:
---
`,
    }, { themeId: 'empty' });

    expect(emptyTheme.themeId).toBe('empty');
    expect(emptyTheme.css).toContain('--design-color-canvas: #111111;');
    expect(emptyTheme.css).toContain('--design-motion-standard: 120ms ease;');
  });

  it('exposes a pluggable apply tool that can select provider adapters', async () => {
    const provider: DesignMdApplyProvider = {
      id: 'test-provider',
      description: 'Test provider',
      canApply: vi.fn(() => true),
      apply: vi.fn(async (request) => ({
        providerId: 'test-provider',
        targetPath: request.target.path,
        content: `${request.target.content}\n/* applied ${request.design.path} */`,
        substitutions: [],
        diagnostics: [],
        usedTooling: ['test-tooling'],
      })),
    };
    const context = createHarnessExtensionContext();
    await context.plugins.load(createDesignMdPlugin({
      documents: [designDocument],
      applyProviders: [provider],
    }));

    await expect(context.tools.execute('design-md.apply', {
      targetPath: 'src/App.tsx',
      targetContent: 'export function App() { return null; }',
      providerId: 'test-provider',
    })).resolves.toMatchObject({
      providerId: 'test-provider',
      targetPath: 'src/App.tsx',
      content: expect.stringContaining('/* applied DESIGN.md */'),
      usedTooling: ['test-tooling'],
    });
    await expect(context.tools.execute('design-md.apply', {
      targetPath: 'src/App.tsx',
      targetContent: '',
      providerId: 'missing-provider',
    })).rejects.toThrow('Unknown design.md apply provider');
    expect(provider.canApply).not.toHaveBeenCalled();
  });

  it('applies llguidance-constrained substitution plans without free-form patch inference', async () => {
    const seenOptions: CoreInferenceOptions[] = [];
    const inferenceClient = {
      infer: vi.fn(async (_messages: unknown, options?: CoreInferenceOptions) => {
        seenOptions.push(options ?? {});
        return JSON.stringify({
          substitutions: [{
            find: 'bg-blue-500 text-white',
            replace: 'bg-[var(--design-color-tertiary)] text-white',
            description: 'Use the DESIGN.md tertiary action color.',
          }, {
            find: 'missing-class',
            replace: 'unused',
            description: 'Skip substitutions that do not match exactly.',
          }],
          diagnostics: ['one class substitution'],
        });
      }),
    };
    const provider = createLlGuidanceDesignSubstitutionProvider({ inferenceClient });

    const result = await provider.apply({
      design: designDocument,
      target: { path: 'src/Button.tsx', content: '<button className="bg-blue-500 text-white">Save</button>' },
      intent: { kind: 'code-substitution' },
    });

    expect(provider.canApply({ design: designDocument, target: { path: 'src/Button.tsx', content: '' }, intent: { kind: 'code-substitution' } })).toBe(true);
    expect(result.content).toBe('<button className="bg-[var(--design-color-tertiary)] text-white">Save</button>');
    expect(result.diagnostics).toEqual(['one class substitution']);
    expect(result.substitutions).toEqual([expect.objectContaining({
      providerId: 'llguidance-substitution-plan',
      method: 'exact-replace',
      description: 'Use the DESIGN.md tertiary action color.',
    })]);
    expect(result.usedTooling).toEqual(['llguidance-json-schema', 'exact-code-substitution']);
    expect(seenOptions[0].constrainedDecoding).toMatchObject({
      kind: 'json_schema',
      schema: expect.objectContaining({ type: 'object' }),
    });
    expect(inferenceClient.infer).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system', content: expect.stringContaining('Return only a substitution plan') }),
        expect.objectContaining({ role: 'user', content: expect.stringContaining('src/Button.tsx') }),
      ]),
      expect.objectContaining({ constrainedDecoding: expect.objectContaining({ kind: 'json_schema' }) }),
    );
  });
});
