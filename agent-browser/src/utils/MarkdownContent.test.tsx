import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownContent, setMermaidImporterForTest } from './MarkdownContent';

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async (_id: string, source: string) => ({
    svg: `<svg role="img" aria-label="Rendered Mermaid diagram"><title>${source}</title><script>unsafe()</script></svg>`,
  })),
}));

vi.mock('mermaid', () => ({
  default: mermaidMock,
}));

describe('MarkdownContent', () => {
  afterEach(() => {
    vi.clearAllMocks();
    setMermaidImporterForTest();
  });

  it('renders external markdown links in a new safe tab', () => {
    render(<MarkdownContent content="[AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12)" />);

    const link = screen.getByRole('link', { name: 'AMC Randhurst 12' });
    expect(link).toHaveAttribute('href', 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  it('preserves quoted link titles without leaking them into extra attributes', () => {
    render(<MarkdownContent content={'[docs](https://example.test "Guide \\"quick\\" reference")'} />);

    const link = screen.getByRole('link', { name: 'docs' });

    expect(link).toHaveAttribute('href', 'https://example.test');
    expect(link).toHaveAttribute('title', 'Guide "quick" reference');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).not.toHaveAttribute('onmouseover');
  });

  it('renders untitled links with safe external-link attributes', () => {
    render(<MarkdownContent content="[docs](https://example.test)" />);

    const link = screen.getByRole('link', { name: 'docs' });

    expect(link).toHaveAttribute('href', 'https://example.test');
    expect(link).not.toHaveAttribute('title');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('replaces unsafe scriptable URI schemes with an inert link target', () => {
    render(<MarkdownContent content="[poc](javascript:alert(1)) and [payload](data:text/html,boom)" />);

    expect(screen.getByRole('link', { name: 'poc' })).toHaveAttribute('href', '#');
    expect(screen.getByRole('link', { name: 'payload' })).toHaveAttribute('href', '#');
  });

  it('preserves safe relative and fragment links', () => {
    render(<MarkdownContent content="[section](#security) [guide](./docs/security.md) [home](/docs)" />);

    expect(screen.getByRole('link', { name: 'section' })).toHaveAttribute('href', '#security');
    expect(screen.getByRole('link', { name: 'guide' })).toHaveAttribute('href', './docs/security.md');
    expect(screen.getByRole('link', { name: 'home' })).toHaveAttribute('href', '/docs');
  });

  it('keeps non-Mermaid code fences inert when Mermaid support is enabled', () => {
    render(<MarkdownContent content={'[empty]()\n\n```ts\nconst x = 1;\n```'} enableMermaid />);

    expect(screen.getByRole('link', { name: 'empty' })).toHaveAttribute('href', '#');
    expect(screen.queryByLabelText('Mermaid diagram')).not.toBeInTheDocument();
    expect(screen.getByText(/const x = 1;/)).toBeInTheDocument();
    expect(mermaidMock.render).not.toHaveBeenCalled();
  });

  it('renders fenced mermaid diagrams only when Mermaid support is enabled', async () => {
    const content = [
      '# Flow',
      '',
      '```mermaid',
      'graph TD',
      '  A[Plan] --> B[Ship]',
      '```',
    ].join('\n');

    const { unmount } = render(<MarkdownContent content={content} />);

    expect(screen.queryByLabelText('Mermaid diagram')).not.toBeInTheDocument();
    expect(screen.getByText(/A\[Plan\] --> B\[Ship\]/)).toBeInTheDocument();
    expect(mermaidMock.render).not.toHaveBeenCalled();
    unmount();

    render(<MarkdownContent content={content} enableMermaid />);

    const diagram = screen.getByLabelText('Mermaid diagram');
    expect(diagram).toHaveTextContent('Rendering Mermaid diagram');

    await waitFor(() => {
      expect(mermaidMock.initialize).toHaveBeenCalledWith(expect.objectContaining({
        securityLevel: 'strict',
        startOnLoad: false,
      }));
      expect(mermaidMock.render).toHaveBeenCalledWith(
        expect.stringMatching(/^markdown-mermaid-/),
        'graph TD\n  A[Plan] --> B[Ship]',
      );
      expect(diagram.querySelector('svg')).not.toBeNull();
    });

    expect(diagram.innerHTML).not.toContain('<script>');
    expect(screen.getByText('Diagram source')).toBeInTheDocument();
  });

  it('reuses the initialized Mermaid runtime for later diagram renders', async () => {
    const { rerender } = render(<MarkdownContent content={[
      '```mermaid',
      'graph TD',
      '  A --> B',
      '```',
    ].join('\n')} enableMermaid />);

    await waitFor(() => {
      expect(mermaidMock.render).toHaveBeenCalledTimes(1);
    });

    rerender(<MarkdownContent content={[
      '```mermaid',
      'graph TD',
      '  B --> C',
      '```',
    ].join('\n')} enableMermaid />);

    await waitFor(() => {
      expect(mermaidMock.render).toHaveBeenCalledTimes(2);
    });

    expect(mermaidMock.initialize).toHaveBeenCalledTimes(1);
  });

  it('shows sanitized Mermaid render failures without removing diagram source', async () => {
    mermaidMock.render
      .mockRejectedValueOnce(new Error('bad syntax'))
      .mockRejectedValueOnce('plain failure');

    render(<MarkdownContent content={[
      '```mermaid',
      'graph TD',
      '  A --> B',
      '```',
      '```mermaid',
      'sequenceDiagram',
      '  Alice->>Bob: Hi',
      '```',
    ].join('\n')} enableMermaid />);

    const diagrams = screen.getAllByLabelText('Mermaid diagram');

    await waitFor(() => {
      expect(diagrams[0]).toHaveAttribute('data-state', 'error');
      expect(diagrams[1]).toHaveAttribute('data-state', 'error');
    });

    expect(diagrams[0]).toHaveTextContent('Unable to render Mermaid diagram: bad syntax');
    expect(diagrams[1]).toHaveTextContent('Unable to render Mermaid diagram: plain failure');
    expect(screen.getAllByText('Diagram source')).toHaveLength(2);
  });

  it('shows sanitized Mermaid loader failures on each pending diagram', async () => {
    setMermaidImporterForTest(async () => {
      throw new Error('chunk failed <script>unsafe()</script>');
    });

    render(<MarkdownContent content={[
      '```mermaid',
      'graph TD',
      '  A --> B',
      '```',
      '```mermaid',
      'sequenceDiagram',
      '  Alice->>Bob: Hi',
      '```',
    ].join('\n')} enableMermaid />);

    const diagrams = screen.getAllByLabelText('Mermaid diagram');

    await waitFor(() => {
      expect(diagrams[0]).toHaveAttribute('data-state', 'error');
      expect(diagrams[1]).toHaveAttribute('data-state', 'error');
    });

    expect(diagrams[0]).toHaveTextContent('Unable to load Mermaid renderer: chunk failed');
    expect(diagrams[1]).toHaveTextContent('Unable to load Mermaid renderer: chunk failed');
    expect(diagrams[0].innerHTML).not.toContain('<script>');
    expect(mermaidMock.render).not.toHaveBeenCalled();
  });

  it('shows plain Mermaid loader failures without dropping the source', async () => {
    setMermaidImporterForTest(async () => {
      throw 'plain chunk failure';
    });

    render(<MarkdownContent content={[
      '```mermaid',
      'graph TD',
      '  A --> B',
      '```',
    ].join('\n')} enableMermaid />);

    const diagram = screen.getByLabelText('Mermaid diagram');

    await waitFor(() => {
      expect(diagram).toHaveAttribute('data-state', 'error');
    });

    expect(diagram).toHaveTextContent('Unable to load Mermaid renderer: plain chunk failure');
    expect(screen.getByText('Diagram source')).toBeInTheDocument();
  });
});
