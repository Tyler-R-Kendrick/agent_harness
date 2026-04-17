import {
  NotAttachedError,
  NotEnabledError,
  NotVisibleError,
  NotEditableError,
} from './errors.js';

export class ActionabilityEngine {
  /** Returns true if the element is connected to the document. */
  isAttached(el: HTMLElement): boolean {
    return el.isConnected;
  }

  /** Returns true if the element is visually visible (best-effort). */
  isVisible(el: HTMLElement): boolean {
    if (!this.isAttached(el)) return false;

    let node: HTMLElement | null = el;
    while (node) {
      const style = getComputedStyle(node);
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden') return false;
      if (style.opacity !== '' && parseFloat(style.opacity) === 0) return false;
      node = node.parentElement;
    }

    return true;
  }

  /** Returns true if the element is not disabled. */
  isEnabled(el: HTMLElement): boolean {
    if (el.getAttribute('aria-disabled') === 'true') return false;

    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLButtonElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement
    ) {
      return !el.disabled;
    }

    return true;
  }

  /** Returns true if the element can accept text input. */
  isEditable(el: HTMLElement): boolean {
    if (el instanceof HTMLInputElement) {
      const nonEditableTypes = new Set([
        'submit', 'reset', 'button', 'image', 'file',
        'checkbox', 'radio', 'range', 'color',
      ]);
      return !el.readOnly && !el.disabled && !nonEditableTypes.has(el.type.toLowerCase());
    }
    if (el instanceof HTMLTextAreaElement) {
      return !el.readOnly && !el.disabled;
    }
    if (el instanceof HTMLSelectElement) {
      return !el.disabled;
    }
    const ce = el.getAttribute('contenteditable');
    if (ce === 'true' || ce === '') return true;
    return false;
  }

  /** Returns true if the element appears to be the topmost element at its centre (best-effort). */
  isTopmostAtPoint(el: HTMLElement): boolean {
    try {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const topEl = el.ownerDocument.elementFromPoint(cx, cy);
      if (!topEl) return false;
      return el === topEl || el.contains(topEl) || topEl.contains(el);
    } catch {
      return true; // best-effort
    }
  }

  /**
   * Throws if the element is not actionable.
   * When force=true, skips visibility/enabled checks but still requires attachment.
   */
  ensureActionable(el: HTMLElement, options?: { force?: boolean }): void {
    const force = options?.force ?? false;

    if (!this.isAttached(el)) {
      throw new NotAttachedError(el.tagName.toLowerCase());
    }

    if (!force) {
      if (!this.isVisible(el)) {
        throw new NotVisibleError(el.tagName.toLowerCase());
      }
      if (!this.isEnabled(el)) {
        throw new NotEnabledError(el.tagName.toLowerCase());
      }
    }
  }

  /**
   * Throws if the element is not editable.
   * Applies ensureActionable checks first.
   */
  ensureEditable(el: HTMLElement, options?: { force?: boolean }): void {
    this.ensureActionable(el, options);
    if (!this.isEditable(el)) {
      throw new NotEditableError(el.tagName.toLowerCase());
    }
  }
}
