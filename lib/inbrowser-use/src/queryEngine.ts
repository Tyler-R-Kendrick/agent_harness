import type { QueryRoot, QueryStep, ResolvedNode, RoleOptions, TextOptions } from './types.js';
import { UnsupportedError } from './errors.js';

/** Cross-realm-safe check: is this an HTMLElement? */
function isHTMLElement(el: unknown): el is HTMLElement {
  return typeof el === 'object' && el !== null && (el as Node).nodeType === 1;
}

type RoleResolver = string | ((el: Element) => string | null);

const IMPLICIT_ROLE_MAP: Record<string, RoleResolver> = {
  A: (el) => (el.hasAttribute('href') ? 'link' : null),
  AREA: (el) => (el.hasAttribute('href') ? 'link' : null),
  ARTICLE: 'article',
  ASIDE: 'complementary',
  BUTTON: 'button',
  CAPTION: 'caption',
  CODE: 'code',
  DATALIST: 'listbox',
  DETAILS: 'group',
  DIALOG: 'dialog',
  FIELDSET: 'group',
  FIGURE: 'figure',
  FOOTER: 'contentinfo',
  FORM: 'form',
  H1: 'heading',
  H2: 'heading',
  H3: 'heading',
  H4: 'heading',
  H5: 'heading',
  H6: 'heading',
  HEADER: 'banner',
  HR: 'separator',
  IMG: (el) => (el.getAttribute('alt') !== null ? 'img' : 'presentation'),
  INPUT: (el: Element) => {
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
    const map: Record<string, string> = {
      button: 'button',
      checkbox: 'checkbox',
      color: 'none',
      email: 'textbox',
      file: 'none',
      hidden: 'none',
      image: 'button',
      month: 'none',
      number: 'spinbutton',
      password: 'none',
      radio: 'radio',
      range: 'slider',
      reset: 'button',
      search: 'searchbox',
      submit: 'button',
      tel: 'textbox',
      text: 'textbox',
      time: 'none',
      url: 'textbox',
      week: 'none',
    };
    return map[type] ?? 'textbox';
  },
  LI: 'listitem',
  LINK: 'link',
  MAIN: 'main',
  MATH: 'math',
  MENU: 'list',
  MENUITEM: 'menuitem',
  METER: 'meter',
  NAV: 'navigation',
  OL: 'list',
  OPTION: 'option',
  OPTGROUP: 'group',
  OUTPUT: 'status',
  PROGRESS: 'progressbar',
  SECTION: 'region',
  SELECT: (el) =>
    (el as HTMLSelectElement).multiple || (el as HTMLSelectElement).size > 1
      ? 'listbox'
      : 'combobox',
  SUMMARY: 'button',
  SVG: 'img',
  TABLE: 'table',
  TBODY: 'rowgroup',
  TD: 'cell',
  TEXTAREA: 'textbox',
  TFOOT: 'rowgroup',
  TH: (el) => (el.getAttribute('scope') === 'row' ? 'rowheader' : 'columnheader'),
  THEAD: 'rowgroup',
  TR: 'row',
  UL: 'list',
};

function getImplicitRole(el: Element): string | null {
  const resolver = IMPLICIT_ROLE_MAP[el.tagName.toUpperCase()];
  if (resolver === undefined) return null;
  if (typeof resolver === 'function') return resolver(el);
  return resolver;
}

function getElementRole(el: Element): string | null {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit.trim().split(/\s+/)[0] ?? null;
  return getImplicitRole(el);
}

// ---------------------------------------------------------------------------
// Accessible name computation (simplified)
// ---------------------------------------------------------------------------
function getAccessibleName(el: Element): string {
  // aria-labelledby (highest priority)
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const ids = labelledby.trim().split(/\s+/);
    return ids
      .map((id) => el.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
  }

  // aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  // <label> association (for form controls)
  const labeled = el.ownerDocument.querySelector(`label[for="${el.id}"]`);
  if (labeled && el.id) return labeled.textContent?.trim() ?? '';

  // alt for images
  if (el.tagName === 'IMG') {
    const alt = el.getAttribute('alt');
    if (alt !== null) return alt.trim();
  }

  // value for submit/button inputs
  if (el.tagName === 'INPUT') {
    const type = ((el as HTMLInputElement).type ?? '').toLowerCase();
    if (['submit', 'reset', 'button'].includes(type)) {
      return ((el as HTMLInputElement).value ?? '').trim();
    }
  }

  // title fallback
  const title = el.getAttribute('title');
  if (title) return title.trim();

  // Text content (buttons, links, etc.)
  return el.textContent?.trim() ?? '';
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------
function matchText(
  actual: string,
  expected: string | RegExp,
  exact: boolean,
): boolean {
  if (expected instanceof RegExp) return expected.test(actual);
  if (exact) return actual === expected;
  return actual.toLowerCase().includes(expected.toLowerCase());
}

function getLeafText(el: Element): string {
  return el.textContent?.trim() ?? '';
}

// ---------------------------------------------------------------------------
// Shadow DOM traversal helper
// ---------------------------------------------------------------------------
function collectAllElements(
  root: Element | Document | ShadowRoot,
  traverseShadow: boolean,
): Element[] {
  const results: Element[] = [];
  const children = root.querySelectorAll('*');
  children.forEach((child) => {
    results.push(child);
    if (traverseShadow && child.shadowRoot) {
      results.push(...collectAllElements(child.shadowRoot, true));
    }
  });
  return results;
}

// ---------------------------------------------------------------------------
// QueryEngine
// ---------------------------------------------------------------------------
export class QueryEngine {
  constructor(
    private readonly enableShadowDom: boolean = true,
    private readonly testIdAttribute: string = 'data-testid',
  ) {}

  async resolveAll(root: QueryRoot, steps: QueryStep[]): Promise<ResolvedNode[]> {
    if (root.kind === 'remote-frame') {
      throw new UnsupportedError(
        'Remote frame resolution must be handled by the locator via RPC',
      );
    }

    const [doc, scopeRoot] = this._rootToScope(root);
    const elements = await this._applyAllSteps(scopeRoot, doc, steps);

    const framePath: string[] = [];
    if (root.kind === 'same-origin-frame') {
      const iframe = root.iframe;
      framePath.push(iframe.id || iframe.name || 'iframe');
    }

    return elements.map((element) => ({ element, scopeDocument: doc, framePath }));
  }

  private _rootToScope(root: QueryRoot): [Document, Element | Document] {
    switch (root.kind) {
      case 'document':
        return [root.document, root.document];
      case 'element':
        return [root.element.ownerDocument, root.element];
      case 'same-origin-frame':
        return [root.document, root.document];
      default:
        throw new UnsupportedError('Unsupported root kind');
    }
  }

  private async _applyAllSteps(
    scope: Element | Document,
    doc: Document,
    steps: QueryStep[],
  ): Promise<HTMLElement[]> {
    if (steps.length === 0) {
      if (isHTMLElement(scope)) return [scope];
      return [];
    }

    let candidates: HTMLElement[] | null = null;

    for (const step of steps) {
      if (step.kind === 'nth' || step.kind === 'first' || step.kind === 'last') {
        candidates = this._applyPositionStep(candidates ?? [], step);
        continue;
      }

      if (step.kind === 'filter') {
        candidates = await this._applyFilterStep(candidates ?? [], doc, step);
        continue;
      }

      // Regular resolution step
      if (candidates === null) {
        candidates = await this._applyStep(scope, doc, step);
      } else {
        // Scope each subsequent step to the previous candidates
        const next: HTMLElement[] = [];
        for (const parent of candidates) {
          const sub = await this._applyStep(parent, doc, step);
          next.push(...sub);
        }
        candidates = [...new Set(next)];
      }
    }

    return candidates ?? [];
  }

  private _applyPositionStep(
    candidates: HTMLElement[],
    step: Extract<QueryStep, { kind: 'nth' | 'first' | 'last' }>,
  ): HTMLElement[] {
    if (step.kind === 'nth') {
      const el = candidates[step.index];
      return el !== undefined ? [el] : [];
    }
    if (step.kind === 'first') {
      const el = candidates[0];
      return el !== undefined ? [el] : [];
    }
    // last
    const el = candidates[candidates.length - 1];
    return el !== undefined ? [el] : [];
  }

  private async _applyFilterStep(
    candidates: HTMLElement[],
    doc: Document,
    step: Extract<QueryStep, { kind: 'filter' }>,
  ): Promise<HTMLElement[]> {
    const results: HTMLElement[] = [];
    for (const el of candidates) {
      let keep = true;

      if (step.hasText !== undefined) {
        const text = getLeafText(el);
        keep = keep && matchText(text, step.hasText, false);
      }

      if (step.has !== undefined) {
        const subNodes = await this._applyAllSteps(el, doc, step.has);
        keep = keep && subNodes.length > 0;
      }

      if (keep) results.push(el);
    }
    return results;
  }

  private async _applyStep(
    scope: Element | Document,
    doc: Document,
    step: Exclude<QueryStep, { kind: 'nth' | 'first' | 'last' | 'filter' }>,
  ): Promise<HTMLElement[]> {
    switch (step.kind) {
      case 'css':
        return this._queryCss(scope, step.selector);
      case 'role':
        return this._queryRole(scope, step.role, step.options);
      case 'text':
        return this._queryText(scope, step.text, step.options);
      case 'label':
        return this._queryLabel(scope, doc, step.text, step.options);
      case 'placeholder':
        return this._queryPlaceholder(scope, step.text, step.options);
      case 'testid':
        return this._queryTestId(scope, step.id);
    }
  }

  // ---- CSS ----------------------------------------------------------------

  private _queryCss(scope: Element | Document, selector: string): HTMLElement[] {
    const results: HTMLElement[] = [];

    scope.querySelectorAll(selector).forEach((el) => {
      if (isHTMLElement(el)) results.push(el);
    });

    if (this.enableShadowDom) {
      scope.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) {
          el.shadowRoot.querySelectorAll(selector).forEach((inner) => {
            if (isHTMLElement(inner) && !results.includes(inner)) {
              results.push(inner);
            }
          });
        }
      });
    }

    return results;
  }

  // ---- Role ---------------------------------------------------------------

  private _queryRole(
    scope: Element | Document,
    role: string,
    options?: RoleOptions,
  ): HTMLElement[] {
    const all = this.enableShadowDom
      ? collectAllElements(scope, true)
      : Array.from(scope.querySelectorAll('*'));

    return all.filter((el): el is HTMLElement => {
      if (!(isHTMLElement(el))) return false;

      const elRole = getElementRole(el);
      if (elRole !== role) return false;

      if (!options?.includeHidden && this._isAriaHidden(el)) return false;

      if (options?.name !== undefined) {
        const name = getAccessibleName(el);
        const exact = options.exact ?? false;
        if (!matchText(name, options.name, exact)) return false;
      }

      return true;
    });
  }

  // ---- Text ---------------------------------------------------------------

  private _queryText(
    scope: Element | Document,
    text: string | RegExp,
    options?: TextOptions,
  ): HTMLElement[] {
    const all = this.enableShadowDom
      ? collectAllElements(scope, true)
      : Array.from(scope.querySelectorAll('*'));

    const exact = options?.exact ?? false;
    const matched = all.filter((el): el is HTMLElement => {
      if (!(isHTMLElement(el))) return false;
      return matchText(getLeafText(el), text, exact);
    });

    // Return the most-specific matches (leaves or nodes with no matched descendant)
    return matched.filter(
      (el) => !matched.some((other) => other !== el && el.contains(other)),
    );
  }

  // ---- Label --------------------------------------------------------------

  private _queryLabel(
    scope: Element | Document,
    doc: Document,
    text: string | RegExp,
    options?: TextOptions,
  ): HTMLElement[] {
    const exact = options?.exact ?? false;
    const results: HTMLElement[] = [];

    // 1. <label> elements with matching text content
    scope.querySelectorAll('label').forEach((label) => {
      const labelText = label.textContent?.trim() ?? '';
      if (!matchText(labelText, text, exact)) return;

      const forAttr = label.getAttribute('for');
      if (forAttr) {
        const control = doc.getElementById(forAttr);
        if (isHTMLElement(control)) results.push(control);
        return;
      }
      // Wrapped control
      const wrapped = label.querySelector(
        'input, textarea, select, [contenteditable]',
      );
      if (isHTMLElement(wrapped)) results.push(wrapped);
    });

    // 2. aria-label
    scope.querySelectorAll('[aria-label]').forEach((el) => {
      if (!(isHTMLElement(el))) return;
      const ariaLabel = el.getAttribute('aria-label') ?? '';
      if (matchText(ariaLabel, text, exact)) results.push(el);
    });

    // 3. aria-labelledby
    scope.querySelectorAll('[aria-labelledby]').forEach((el) => {
      if (!(isHTMLElement(el))) return;
      const labelledby = el.getAttribute('aria-labelledby') ?? '';
      const ids = labelledby.trim().split(/\s+/);
      const labelText = ids
        .map((id) => doc.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim();
      if (matchText(labelText, text, exact)) results.push(el);
    });

    return [...new Set(results)];
  }

  // ---- Placeholder --------------------------------------------------------

  private _queryPlaceholder(
    scope: Element | Document,
    text: string | RegExp,
    options?: TextOptions,
  ): HTMLElement[] {
    const exact = options?.exact ?? false;
    const results: HTMLElement[] = [];
    scope.querySelectorAll('[placeholder]').forEach((el) => {
      if (!(isHTMLElement(el))) return;
      const ph = el.getAttribute('placeholder') ?? '';
      if (matchText(ph, text, exact)) results.push(el);
    });
    return results;
  }

  // ---- TestId -------------------------------------------------------------

  private _queryTestId(scope: Element | Document, id: string | RegExp): HTMLElement[] {
    const attr = this.testIdAttribute;
    if (typeof id === 'string') {
      return Array.from(scope.querySelectorAll(`[${attr}="${id}"]`)).filter(
        (el): el is HTMLElement => isHTMLElement(el),
      );
    }
    return Array.from(scope.querySelectorAll(`[${attr}]`)).filter(
      (el): el is HTMLElement => {
        if (!(isHTMLElement(el))) return false;
        return id.test(el.getAttribute(attr) ?? '');
      },
    );
  }

  // ---- Helpers ------------------------------------------------------------

  private _isAriaHidden(el: HTMLElement): boolean {
    let node: HTMLElement | null = el;
    while (node) {
      if (node.getAttribute('aria-hidden') === 'true') return true;
      node = node.parentElement;
    }
    return false;
  }
}
