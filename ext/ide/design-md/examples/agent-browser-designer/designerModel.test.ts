import { describe, expect, it } from 'vitest';
import { renderDesignMdCss } from 'harness-core';
import type { WorkspaceFile } from '../../types';
import {
  DESIGNER_MANIFEST_PATH,
  buildDesignSystemArtifacts,
  createDesignerExportArtifact,
  listDesignerFileEntries,
  readDesignerManifest,
  updateDesignerManifest,
} from './designerModel';

const timestamp = '2026-05-02T12:00:00.000Z';

describe('designerModel', () => {
  it('creates a complete DESIGN.md-backed Design Studio workspace bundle', () => {
    const files = buildDesignSystemArtifacts([], {
      companyBlurb: 'Agent Browser Design System for browser-native design agents',
      projectName: 'Agent Browser Design System',
      githubUrl: 'https://github.com/example/agent-harness',
      localFolder: 'agent-browser',
      figFile: 'agent-browser.fig',
      assets: 'logo.svg, Inter.ttf',
      notes: 'Prefer the Design Studio warm canvas with dark Agent Browser themes.',
      fidelity: 'high',
    }, timestamp);

    const design = files.find((file) => file.path === 'DESIGN.md');
    expect(design?.content).toContain('name: Agent Browser Design System');
    expect(design?.content).toContain('themes:');
    expect(design?.content).toContain('styles:');

    const manifest = readDesignerManifest(files);
    expect(manifest?.status).toBe('draft');
    expect(manifest?.sources.map((source) => source.kind)).toEqual(['github', 'folder', 'fig', 'asset', 'note']);
    expect(files.map((file) => file.path)).toEqual(expect.arrayContaining([
      DESIGNER_MANIFEST_PATH,
      'design/colors_and_type.css',
      'design/README.md',
      'design/SKILL.md',
      'design/assets/.keep',
      'design/fonts/.keep',
      'design/preview/thumbnail.html',
      'design/sketches/.keep',
      'design/ui_kits/button-card.html',
    ]));

    const css = renderDesignMdCss({ path: 'DESIGN.md', content: design?.content ?? '' }, { themeId: 'agent-browser-dark' });
    expect(css.css).toContain('[data-design-widget="button-primary"]');
    expect(css.variables['--app-bg']).toBe('#101114');
  });

  it('updates manifest review state without dropping source inventory', () => {
    const files = buildDesignSystemArtifacts([], {
      companyBlurb: 'Acme analytics design language',
      projectName: 'Acme DS',
      githubUrl: 'https://github.com/acme/web',
      localFolder: '',
      figFile: '',
      assets: '',
      notes: '',
      fidelity: 'wireframe',
    }, timestamp);

    const nextFiles = updateDesignerManifest(files, (manifest) => ({
      ...manifest,
      status: 'published',
      default: true,
      review: {
        ...manifest.review,
        feedback: [...manifest.review.feedback, 'Buttons need more contrast.'],
      },
    }), '2026-05-02T12:05:00.000Z');

    const manifest = readDesignerManifest(nextFiles);
    expect(manifest?.status).toBe('published');
    expect(manifest?.default).toBe(true);
    expect(manifest?.sources).toHaveLength(1);
    expect(manifest?.review.feedback).toContain('Buttons need more contrast.');
    expect(manifest?.updatedAt).toBe('2026-05-02T12:05:00.000Z');
  });

  it('lists folders, stylesheets, documents, previews, and export artifacts for the Design Files tab', () => {
    const files: WorkspaceFile[] = [
      { path: 'DESIGN.md', content: '# Design', updatedAt: timestamp },
      { path: DESIGNER_MANIFEST_PATH, content: '{}', updatedAt: timestamp },
      { path: 'design/colors_and_type.css', content: ':root {}', updatedAt: timestamp },
      { path: 'design/README.md', content: '# Readme', updatedAt: timestamp },
      { path: 'design/preview/thumbnail.html', content: '<main />', updatedAt: timestamp },
      createDesignerExportArtifact('pdf', 'Agent Browser Design System', timestamp),
    ];

    const entries = listDesignerFileEntries(files);

    expect(entries.filter((entry) => entry.kind === 'folder').map((entry) => entry.path)).toEqual(expect.arrayContaining([
      'design',
      'design/preview',
      'design/exports',
    ]));
    expect(entries.find((entry) => entry.path === 'design/colors_and_type.css')?.section).toBe('Stylesheets');
    expect(entries.find((entry) => entry.path === 'design/README.md')?.section).toBe('Documents');
    expect(entries.find((entry) => entry.path === 'design/exports/agent-browser-design-system.pdf')?.section).toBe('Exports');
  });
});
