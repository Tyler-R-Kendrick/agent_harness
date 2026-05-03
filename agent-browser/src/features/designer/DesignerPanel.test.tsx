import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DesignMdCssRenderResult } from 'harness-core';
import type { WorkspaceFile } from '../../types';
import { DesignerPanel } from './DesignerPanel';

const cssResult: DesignMdCssRenderResult = {
  themeId: 'default',
  diagnostics: [],
  css: '/* design.md:start */\n:root {}\n/* design.md:end */',
  variables: {
    '--app-bg': '#f8f5ef',
    '--accent': '#d97757',
  },
};

function renderDesigner(initialFiles: WorkspaceFile[] = []) {
  let files = initialFiles;
  const handleWorkspaceFilesChange = vi.fn((nextFiles: WorkspaceFile[]) => {
    files = nextFiles;
    rerenderPanel();
  });
  const handleThemeChange = vi.fn();
  let rendered = render(
    <DesignerPanel
      workspaceName="Research"
      workspaceFiles={files}
      designCss={cssResult}
      designThemeSettings={{ themeId: 'default', applyToShell: false }}
      onDesignThemeSettingsChange={handleThemeChange}
      onWorkspaceFilesChange={handleWorkspaceFilesChange}
    />,
  );
  function rerenderPanel() {
    rendered.rerender(
      <DesignerPanel
        workspaceName="Research"
        workspaceFiles={files}
        designCss={cssResult}
        designThemeSettings={{ themeId: 'default', applyToShell: false }}
        onDesignThemeSettingsChange={handleThemeChange}
        onWorkspaceFilesChange={handleWorkspaceFilesChange}
      />,
    );
  }
  return { ...rendered, getFiles: () => files, handleWorkspaceFilesChange, handleThemeChange };
}

describe('DesignerPanel', () => {
  it('runs the design-system setup, generation, review, theme, and file browser flow end to end', () => {
    const { getFiles, handleThemeChange } = renderDesigner();

    expect(screen.getByRole('heading', { name: 'Claude Design' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Design systems' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set up design system' }));

    fireEvent.change(screen.getByLabelText('Company name and blurb'), {
      target: { value: 'Agent Browser Design System for browser-native design agents' },
    });
    fireEvent.change(screen.getByLabelText('Link code on GitHub'), {
      target: { value: 'https://github.com/example/agent-harness' },
    });
    fireEvent.change(screen.getByLabelText('Link code from your computer'), {
      target: { value: 'agent-browser' },
    });
    fireEvent.change(screen.getByLabelText('Upload a .fig file'), {
      target: { value: 'agent-browser.fig' },
    });
    fireEvent.change(screen.getByLabelText('Add fonts, logos and assets'), {
      target: { value: 'logo.svg, Inter.ttf' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to generation' }));

    expect(screen.getByText('Creating your design system...')).toBeInTheDocument();
    expect(screen.getByText('Reading source materials')).toBeInTheDocument();
    expect(getFiles().map((file) => file.path)).toEqual(expect.arrayContaining([
      'DESIGN.md',
      'design/manifest.json',
      'design/colors_and_type.css',
      'design/ui_kits/button-card.html',
    ]));

    fireEvent.click(screen.getByRole('button', { name: 'Review draft design system' }));
    expect(screen.getByText('Missing brand fonts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Looks good for Buttons' }));
    fireEvent.click(screen.getByLabelText('Apply Claude Design theme to Agent Browser'));
    expect(handleThemeChange).toHaveBeenCalledWith({ themeId: 'default', applyToShell: true });

    fireEvent.change(screen.getByLabelText("Describe what you'd prefer"), {
      target: { value: 'Make button states more compact.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit feedback' }));
    expect(screen.getByText('Make button states more compact.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Design Files' }));
    expect(screen.getByText('colors_and_type.css')).toBeInTheDocument();
    expect(screen.getByText('SKILL.md')).toBeInTheDocument();
    expect(screen.getByText('Select a file to preview')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview colors_and_type.css' }));
    expect(screen.getByLabelText('Selected design file preview')).toHaveTextContent('design.md:start');
  });

  it('supports examples, comments, sketches, share/export actions, and handoff artifacts', () => {
    const { getFiles } = renderDesigner();

    fireEvent.click(screen.getByRole('button', { name: 'Examples' }));
    expect(screen.getByText('Calculator construction kit')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Display size'), { target: { value: '64' } });
    expect(screen.getByText('64')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use this prompt' }));
    expect(screen.getByDisplayValue('Calculator construction kit')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Design systems' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set up design system' }));
    fireEvent.change(screen.getByLabelText('Company name and blurb'), {
      target: { value: 'Sketchable brand system' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to generation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review draft design system' }));

    fireEvent.click(screen.getByRole('button', { name: 'Comments' }));
    fireEvent.change(screen.getByLabelText('Inline comment'), {
      target: { value: 'Use primary brand color here.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    expect(screen.getByText('Use primary brand color here.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New sketch' }));
    expect(screen.getByLabelText('Designer sketch canvas')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save sketch' }));
    expect(getFiles().some((file) => file.path.startsWith('design/sketches/sketch-'))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    const menu = screen.getByRole('dialog', { name: 'Share and export design' });
    expect(within(menu).getByText('Teammates can edit')).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('button', { name: 'Export as standalone HTML' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    fireEvent.click(screen.getByRole('button', { name: 'Handoff to Claude Code...' }));

    expect(getFiles().map((file) => file.path)).toEqual(expect.arrayContaining([
      'design/exports/sketchable-brand-system.html',
      'design/exports/sketchable-brand-system-handoff.md',
    ]));
  });
});
