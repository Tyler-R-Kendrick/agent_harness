import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSandboxPreview } from '../preview';

describe('createSandboxPreview', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders generated HTML in a blob-backed iframe with a restrictive sandbox', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:sandbox-preview');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const handle = createSandboxPreview('<h1>Hello</h1>');

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(handle.url).toBe('blob:sandbox-preview');
    expect(handle.iframe.src).toBe('blob:sandbox-preview');
    expect(handle.iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(handle.iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(document.body.contains(handle.iframe)).toBe(true);

    handle.dispose();

    expect(document.body.contains(handle.iframe)).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:sandbox-preview');
  });

  it('allows callers to provide an explicit parent and sandbox attribute', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:custom-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const parent = document.createElement('section');
    document.body.appendChild(parent);

    const handle = createSandboxPreview('<p>x</p>', { parent, sandbox: 'allow-scripts allow-forms' });

    expect(parent.contains(handle.iframe)).toBe(true);
    expect(handle.iframe.getAttribute('sandbox')).toBe('allow-scripts allow-forms');
    handle.dispose();
  });
});
