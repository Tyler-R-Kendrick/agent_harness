import { describe, it, expect, vi } from 'vitest';
import { ActionabilityEngine } from '../actionability.js';
import { NotAttachedError, NotVisibleError, NotEnabledError, NotEditableError } from '../errors.js';

function makeEl(tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement(tag) as HTMLElement;
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  document.body.appendChild(el);
  return el;
}

describe('ActionabilityEngine', () => {
  const engine = new ActionabilityEngine();

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, 'elementFromPoint');
    document.body.innerHTML = '';
  });

  describe('isAttached', () => {
    it('returns true for attached element', () => {
      const el = makeEl('button');
      expect(engine.isAttached(el)).toBe(true);
    });

    it('returns false for detached element', () => {
      const el = document.createElement('button');
      expect(engine.isAttached(el)).toBe(false);
    });
  });

  describe('isVisible', () => {
    it('returns false for detached element', () => {
      const el = document.createElement('button');
      expect(engine.isVisible(el)).toBe(false);
    });

    it('returns false for display:none', () => {
      const el = makeEl('button');
      el.style.display = 'none';
      expect(engine.isVisible(el)).toBe(false);
    });

    it('returns false for visibility:hidden', () => {
      const el = makeEl('button');
      el.style.visibility = 'hidden';
      expect(engine.isVisible(el)).toBe(false);
    });

    it('returns false for opacity zero', () => {
      const el = makeEl('button');
      el.style.opacity = '0';
      expect(engine.isVisible(el)).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('returns true for regular element', () => {
      const el = makeEl('div');
      expect(engine.isEnabled(el)).toBe(true);
    });

    it('returns false for disabled button', () => {
      const el = makeEl('button');
      (el as HTMLButtonElement).disabled = true;
      expect(engine.isEnabled(el)).toBe(false);
    });

    it('returns false for disabled input', () => {
      const el = makeEl('input');
      (el as HTMLInputElement).disabled = true;
      expect(engine.isEnabled(el)).toBe(false);
    });

    it('returns false for aria-disabled=true', () => {
      const el = makeEl('div', { 'aria-disabled': 'true' });
      expect(engine.isEnabled(el)).toBe(false);
    });
  });

  describe('isEditable', () => {
    it('returns true for text input', () => {
      const el = makeEl('input', { type: 'text' }) as HTMLInputElement;
      expect(engine.isEditable(el)).toBe(true);
    });

    it('returns false for submit input', () => {
      const el = makeEl('input', { type: 'submit' }) as HTMLInputElement;
      expect(engine.isEditable(el)).toBe(false);
    });

    it('returns false for disabled input', () => {
      const el = makeEl('input', { type: 'text' }) as HTMLInputElement;
      (el as HTMLInputElement).disabled = true;
      expect(engine.isEditable(el)).toBe(false);
    });

    it('returns false for readonly input', () => {
      const el = makeEl('input', { type: 'text' }) as HTMLInputElement;
      (el as HTMLInputElement).readOnly = true;
      expect(engine.isEditable(el)).toBe(false);
    });

    it('returns true for textarea', () => {
      const el = makeEl('textarea') as HTMLTextAreaElement;
      expect(engine.isEditable(el)).toBe(true);
    });

    it('returns false for disabled textarea', () => {
      const el = makeEl('textarea') as HTMLTextAreaElement;
      el.disabled = true;
      expect(engine.isEditable(el)).toBe(false);
    });

    it('returns true for enabled select', () => {
      const el = makeEl('select') as HTMLSelectElement;
      expect(engine.isEditable(el)).toBe(true);
    });

    it('returns false for disabled select', () => {
      const el = makeEl('select') as HTMLSelectElement;
      el.disabled = true;
      expect(engine.isEditable(el)).toBe(false);
    });

    it('returns true for contenteditable', () => {
      const el = makeEl('div', { contenteditable: 'true' });
      expect(engine.isEditable(el)).toBe(true);
    });

    it('returns true for empty contenteditable', () => {
      const el = makeEl('div', { contenteditable: '' });
      expect(engine.isEditable(el)).toBe(true);
    });

    it('returns false for non-editable div', () => {
      const el = makeEl('div');
      expect(engine.isEditable(el)).toBe(false);
    });
  });

  describe('isTopmostAtPoint', () => {
    it('returns false when no element is found at the center point', () => {
      const el = makeEl('button');
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        top: 0,
        right: 10,
        bottom: 10,
        left: 0,
        toJSON: () => ({}),
      });
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: vi.fn().mockReturnValue(null),
      });

      expect(engine.isTopmostAtPoint(el)).toBe(false);
    });

    it('returns true when the element contains the topmost child', () => {
      const el = makeEl('button');
      const child = document.createElement('span');
      el.appendChild(child);
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        top: 0,
        right: 10,
        bottom: 10,
        left: 0,
        toJSON: () => ({}),
      });
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: vi.fn().mockReturnValue(child),
      });

      expect(engine.isTopmostAtPoint(el)).toBe(true);
    });

    it('returns true when the topmost element contains the target', () => {
      const parent = makeEl('div');
      const el = document.createElement('button');
      parent.appendChild(el);
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        top: 0,
        right: 10,
        bottom: 10,
        left: 0,
        toJSON: () => ({}),
      });
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: vi.fn().mockReturnValue(parent),
      });

      expect(engine.isTopmostAtPoint(el)).toBe(true);
    });

    it('falls back to true when hit testing throws', () => {
      const el = makeEl('button');
      vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => {
        throw new Error('layout unavailable');
      });

      expect(engine.isTopmostAtPoint(el)).toBe(true);
    });
  });

  describe('ensureActionable', () => {
    it('throws NotAttachedError for detached element', () => {
      const el = document.createElement('button');
      expect(() => engine.ensureActionable(el)).toThrow(NotAttachedError);
    });

    it('throws NotVisibleError for hidden element', () => {
      const el = makeEl('button');
      el.style.display = 'none';
      expect(() => engine.ensureActionable(el)).toThrow(NotVisibleError);
    });

    it('throws NotEnabledError for disabled button', () => {
      const el = makeEl('button');
      (el as HTMLButtonElement).disabled = true;
      expect(() => engine.ensureActionable(el)).toThrow(NotEnabledError);
    });

    it('skips visibility/enabled checks when force=true', () => {
      const el = makeEl('button');
      el.style.display = 'none';
      (el as HTMLButtonElement).disabled = true;
      expect(() => engine.ensureActionable(el, { force: true })).not.toThrow();
    });
  });

  describe('ensureEditable', () => {
    it('throws NotEditableError for non-editable element', () => {
      const el = makeEl('div');
      expect(() => engine.ensureEditable(el)).toThrow(NotEditableError);
    });

    it('does not throw for editable input', () => {
      const el = makeEl('input', { type: 'text' });
      expect(() => engine.ensureEditable(el)).not.toThrow();
    });
  });
});
