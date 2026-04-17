import { describe, it, expect, vi } from 'vitest';
import { ActionExecutor } from '../actionExecutor.js';
import { AgentRegistry } from '../registry.js';

function makeEl(tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement(tag) as HTMLElement;
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  document.body.appendChild(el);
  return el;
}

describe('ActionExecutor', () => {
  let registry: AgentRegistry;
  let executor: ActionExecutor;

  beforeEach(() => {
    registry = new AgentRegistry();
    executor = new ActionExecutor(registry);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('click', () => {
    it('calls element.click() for plain DOM element', async () => {
      const btn = makeEl('button') as HTMLButtonElement;
      const clickSpy = vi.spyOn(btn, 'click');
      await executor.click(btn);
      expect(clickSpy).toHaveBeenCalledOnce();
    });

    it('prefers component click action over DOM fallback', async () => {
      const clickFn = vi.fn();
      const btn = makeEl('button', { 'data-agent-id': 'action.submit' }) as HTMLButtonElement;
      registry.register({ id: 'action.submit', actions: { click: clickFn } });
      await executor.click(btn);
      expect(clickFn).toHaveBeenCalledOnce();
    });
  });

  describe('fill', () => {
    it('sets value on input and dispatches events', async () => {
      const input = makeEl('input', { type: 'text' }) as HTMLInputElement;
      const inputEvents: string[] = [];
      input.addEventListener('input', () => inputEvents.push('input'));
      input.addEventListener('change', () => inputEvents.push('change'));

      await executor.fill(input, 'hello');
      expect(input.value).toBe('hello');
      expect(inputEvents).toContain('input');
      expect(inputEvents).toContain('change');
    });

    it('sets value on textarea', async () => {
      const ta = makeEl('textarea') as HTMLTextAreaElement;
      await executor.fill(ta, 'world');
      expect(ta.value).toBe('world');
    });

    it('sets textContent on contenteditable', async () => {
      const div = makeEl('div', { contenteditable: 'true' });
      await executor.fill(div, 'editable content');
      expect(div.textContent).toBe('editable content');
    });

    it('uses component setValue action if available', async () => {
      const setValueFn = vi.fn();
      const input = makeEl('input', { 'data-agent-id': 'search.query' }) as HTMLInputElement;
      registry.register({ id: 'search.query', actions: { setValue: setValueFn } });
      await executor.fill(input, 'test');
      expect(setValueFn).toHaveBeenCalledWith('test');
    });
  });

  describe('press', () => {
    it('dispatches keydown/keypress/keyup events', async () => {
      const input = makeEl('input', { type: 'text' }) as HTMLInputElement;
      const events: string[] = [];
      input.addEventListener('keydown', () => events.push('keydown'));
      input.addEventListener('keypress', () => events.push('keypress'));
      input.addEventListener('keyup', () => events.push('keyup'));

      await executor.press(input, 'Enter');
      expect(events).toContain('keydown');
      expect(events).toContain('keyup');
    });

    it('dispatches correct key for Enter', async () => {
      const input = makeEl('input', { type: 'text' }) as HTMLInputElement;
      let capturedKey = '';
      input.addEventListener('keydown', (e) => { capturedKey = (e as KeyboardEvent).key; });

      await executor.press(input, 'Enter');
      expect(capturedKey).toBe('Enter');
    });
  });

  describe('pressSequentially', () => {
    it('types characters one by one into input', async () => {
      const input = makeEl('input', { type: 'text' }) as HTMLInputElement;
      await executor.pressSequentially(input, 'ab');
      expect(input.value).toBe('ab');
    });

    it('dispatches keydown and keyup per character', async () => {
      const input = makeEl('input', { type: 'text' }) as HTMLInputElement;
      const keyDownKeys: string[] = [];
      input.addEventListener('keydown', (e) => keyDownKeys.push((e as KeyboardEvent).key));

      await executor.pressSequentially(input, 'hi');
      expect(keyDownKeys).toEqual(['h', 'i']);
    });

    it('appends to contenteditable', async () => {
      const div = makeEl('div', { contenteditable: 'true' });
      div.textContent = 'foo';
      await executor.pressSequentially(div, 'bar');
      expect(div.textContent).toBe('foobar');
    });
  });

  describe('focus / blur', () => {
    it('calls element.focus()', async () => {
      const input = makeEl('input', { type: 'text' }) as HTMLInputElement;
      const spy = vi.spyOn(input, 'focus');
      await executor.focus(input);
      expect(spy).toHaveBeenCalled();
    });

    it('calls element.blur()', async () => {
      const input = makeEl('input', { type: 'text' }) as HTMLInputElement;
      const spy = vi.spyOn(input, 'blur');
      await executor.blur(input);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('check / uncheck', () => {
    it('clicks unchecked checkbox to check it', async () => {
      const cb = makeEl('input', { type: 'checkbox' }) as HTMLInputElement;
      expect(cb.checked).toBe(false);
      await executor.check(cb);
      expect(cb.checked).toBe(true);
    });

    it('does not click already-checked checkbox', async () => {
      const cb = makeEl('input', { type: 'checkbox' }) as HTMLInputElement;
      cb.checked = true;
      const spy = vi.spyOn(cb, 'click');
      await executor.check(cb);
      expect(spy).not.toHaveBeenCalled();
    });

    it('clicks checked checkbox to uncheck it', async () => {
      const cb = makeEl('input', { type: 'checkbox' }) as HTMLInputElement;
      cb.click(); // make it checked
      await executor.uncheck(cb);
      expect(cb.checked).toBe(false);
    });

    it('throws for non-checkbox element', async () => {
      const btn = makeEl('button');
      await expect(executor.check(btn)).rejects.toThrow();
    });
  });

  describe('selectOption', () => {
    it('sets value on select element', async () => {
      document.body.innerHTML = `
        <select>
          <option value="a">Apple</option>
          <option value="b">Banana</option>
        </select>
      `;
      const sel = document.querySelector('select') as HTMLSelectElement;

      const events: string[] = [];
      sel.addEventListener('change', () => events.push('change'));

      await executor.selectOption(sel, 'b');
      expect(sel.value).toBe('b');
      expect(events).toContain('change');
    });

    it('throws for non-select element', async () => {
      const div = makeEl('div');
      await expect(executor.selectOption(div, 'foo')).rejects.toThrow();
    });

    it('selects by array of values', async () => {
      document.body.innerHTML = `
        <select multiple>
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="c">C</option>
        </select>
      `;
      const sel = document.querySelector('select') as HTMLSelectElement;
      await executor.selectOption(sel, ['a', 'c']);
      expect(sel.options[0].selected).toBe(true);
      expect(sel.options[1].selected).toBe(false);
      expect(sel.options[2].selected).toBe(true);
    });
  });

  describe('hover', () => {
    it('dispatches mouse events', async () => {
      const div = makeEl('div');
      const events: string[] = [];
      div.addEventListener('mouseenter', () => events.push('mouseenter'));
      div.addEventListener('mouseover', () => events.push('mouseover'));
      div.addEventListener('mousemove', () => events.push('mousemove'));

      await executor.hover(div);
      expect(events).toContain('mouseover');
      expect(events).toContain('mousemove');
    });
  });
});
