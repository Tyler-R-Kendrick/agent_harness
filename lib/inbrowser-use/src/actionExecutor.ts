import type { ClickOptions, FillOptions, HoverOptions, SelectOptionArg } from './types.js';
import { NotEditableError } from './errors.js';
import type { AgentRegistryInterface } from './types.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseKey(key: string): { key: string; code: string } {
  const map: Record<string, { key: string; code: string }> = {
    Enter: { key: 'Enter', code: 'Enter' },
    Tab: { key: 'Tab', code: 'Tab' },
    Escape: { key: 'Escape', code: 'Escape' },
    Backspace: { key: 'Backspace', code: 'Backspace' },
    Delete: { key: 'Delete', code: 'Delete' },
    ArrowUp: { key: 'ArrowUp', code: 'ArrowUp' },
    ArrowDown: { key: 'ArrowDown', code: 'ArrowDown' },
    ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft' },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight' },
    ' ': { key: ' ', code: 'Space' },
    Space: { key: ' ', code: 'Space' },
    Home: { key: 'Home', code: 'Home' },
    End: { key: 'End', code: 'End' },
    PageUp: { key: 'PageUp', code: 'PageUp' },
    PageDown: { key: 'PageDown', code: 'PageDown' },
    F1: { key: 'F1', code: 'F1' },
    F2: { key: 'F2', code: 'F2' },
  };
  return map[key] ?? { key, code: `Key${key.toUpperCase()}` };
}

/**
 * Executes concrete DOM actions on a resolved element.
 * Prefers registered component actions over raw DOM manipulation.
 */
export class ActionExecutor {
  constructor(private readonly registry: AgentRegistryInterface) {}

  private _getComponentAction(
    el: HTMLElement,
    action: string,
  ): ((...args: unknown[]) => unknown | Promise<unknown>) | undefined {
    const agentId = el.getAttribute('data-agent-id');
    if (!agentId) return undefined;
    const node = this.registry.get(agentId);
    return node?.actions?.[action];
  }

  async click(el: HTMLElement, options?: ClickOptions): Promise<void> {
    const componentClick = this._getComponentAction(el, 'click');
    if (componentClick) {
      await componentClick();
      return;
    }
    el.click();
  }

  async fill(el: HTMLElement, value: string, options?: FillOptions): Promise<void> {
    const componentFill =
      this._getComponentAction(el, 'fill') ?? this._getComponentAction(el, 'setValue');
    if (componentFill) {
      await componentFill(value);
      return;
    }

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.focus();
      const isInput = el instanceof HTMLInputElement || el.tagName === 'INPUT';
      // Use Object.getOwnPropertyDescriptor to trigger React/Vue synthetic event
      const nativeProto = isInput ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const nativeInputValue = Object.getOwnPropertyDescriptor(nativeProto, 'value');
      if (nativeInputValue?.set) {
        nativeInputValue.set.call(el, value);
      } else {
        (el as HTMLInputElement).value = value;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el instanceof HTMLSelectElement || el.tagName === 'SELECT') {
      el.focus();
      (el as HTMLSelectElement).value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const ce = el.getAttribute('contenteditable');
      if (ce === 'true' || ce === '') {
        el.focus();
        el.textContent = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        throw new NotEditableError(el.tagName.toLowerCase());
      }
    }
  }

  async press(
    el: HTMLElement,
    key: string,
    options?: { delay?: number },
  ): Promise<void> {
    el.focus();
    const { key: k, code } = parseKey(key);

    el.dispatchEvent(
      new KeyboardEvent('keydown', { key: k, code, bubbles: true, cancelable: true }),
    );

    if (options?.delay && options.delay > 0) {
      await sleep(options.delay);
    }

    el.dispatchEvent(
      new KeyboardEvent('keypress', { key: k, code, bubbles: true, cancelable: true }),
    );

    el.dispatchEvent(
      new KeyboardEvent('keyup', { key: k, code, bubbles: true, cancelable: true }),
    );
  }

  async pressSequentially(
    el: HTMLElement,
    text: string,
    options?: { delay?: number },
  ): Promise<void> {
    const delay = options?.delay ?? 0;

    for (const char of text) {
      el.focus();

      el.dispatchEvent(
        new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true }),
      );

      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const inputEl = el as HTMLInputElement;
        const start = inputEl.selectionStart ?? inputEl.value.length;
        const end = inputEl.selectionEnd ?? inputEl.value.length;
        inputEl.value = inputEl.value.slice(0, start) + char + inputEl.value.slice(end);
        inputEl.selectionStart = start + 1;
        inputEl.selectionEnd = start + 1;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (
        el.getAttribute('contenteditable') === 'true' ||
        el.getAttribute('contenteditable') === ''
      ) {
        el.textContent = (el.textContent ?? '') + char;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      el.dispatchEvent(
        new KeyboardEvent('keyup', { key: char, bubbles: true, cancelable: true }),
      );

      if (delay > 0) await sleep(delay);
    }
  }

  async focus(el: HTMLElement): Promise<void> {
    const componentFocus = this._getComponentAction(el, 'focus');
    if (componentFocus) {
      await componentFocus();
      return;
    }
    el.focus();
  }

  async blur(el: HTMLElement): Promise<void> {
    const componentBlur = this._getComponentAction(el, 'blur');
    if (componentBlur) {
      await componentBlur();
      return;
    }
    el.blur();
  }

  async hover(el: HTMLElement, _options?: HoverOptions): Promise<void> {
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  }

  async check(el: HTMLElement, _options?: { force?: boolean }): Promise<void> {
    const componentCheck = this._getComponentAction(el, 'check');
    if (componentCheck) {
      await componentCheck();
      return;
    }

    if (
      (el instanceof HTMLInputElement || el.tagName === 'INPUT') &&
      ((el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio')
    ) {
      if (!(el as HTMLInputElement).checked) {
        el.click();
      }
    } else {
      throw new Error(`check() is not supported on <${el.tagName.toLowerCase()}>`);
    }
  }

  async uncheck(el: HTMLElement, _options?: { force?: boolean }): Promise<void> {
    const componentUncheck = this._getComponentAction(el, 'uncheck');
    if (componentUncheck) {
      await componentUncheck();
      return;
    }

    if ((el instanceof HTMLInputElement || el.tagName === 'INPUT') && (el as HTMLInputElement).type === 'checkbox') {
      if ((el as HTMLInputElement).checked) {
        el.click();
      }
    } else {
      throw new Error(`uncheck() is not supported on <${el.tagName.toLowerCase()}>`);
    }
  }

  async selectOption(el: HTMLElement, value: SelectOptionArg): Promise<void> {
    const componentSelect = this._getComponentAction(el, 'selectOption');
    if (componentSelect) {
      await componentSelect(value);
      return;
    }

    if (!(el instanceof HTMLSelectElement) && el.tagName !== 'SELECT') {
      throw new Error(`selectOption() requires a <select> element`);
    }

    if (typeof value === 'string') {
      el.value = value;
    } else if (Array.isArray(value)) {
      const values = (value as Array<string | { value?: string; label?: string }>).map(
        (v) => (typeof v === 'string' ? v : (v.value ?? v.label ?? '')),
      );
      for (const opt of el.options) {
        opt.selected = values.includes(opt.value) || values.includes(opt.label);
      }
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async scrollIntoViewIfNeeded(el: HTMLElement): Promise<void> {
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const inView =
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= vh &&
      rect.right <= vw;

    if (!inView) {
      el.scrollIntoView({ block: 'center', inline: 'center' });
    }
  }
}
