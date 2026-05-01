import { describe, expect, it, vi } from 'vitest';

import {
  buildDesignMdGuidanceMessage,
  createCssDesignTokenApplyProvider,
  createDesignMdPlugin,
  createHarnessExtensionContext,
  createLlGuidanceDesignSubstitutionProvider,
  discoverDesignMdSemanticHooks,
  type CoreInferenceOptions,
  type DesignMdApplyProvider,
} from '../index.js';

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
