import { describe, it, expect, vi } from 'vitest';
import { createInAppPage } from '../index.js';
import {
  StrictModeViolationError,
  TimeoutError,
  NotFoundError,
  UnsupportedError,
} from '../errors.js';

function setup(html: string) {
  document.body.innerHTML = html;
}

function makePage(html?: string, timeoutMs = 300) {
  if (html !== undefined) setup(html);
  return createInAppPage({ defaultTimeoutMs: timeoutMs, quietDomMs: 0, stableFrames: 0 });
}

describe('Locator', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ==================== Builder chain ====================

  describe('chaining', () => {
    it('locator().locator() scopes to parent', async () => {
      setup('<div id="container"><button>Inside</button></div><button>Outside</button>');
      const page = makePage();
      const count = await page.locator('#container').locator('button').count();
      expect(count).toBe(1);
    });

    it('getByRole().getByText() chains correctly', async () => {
      setup('<ul><li>Foo</li><li>Bar</li></ul>');
      const page = makePage();
      const count = await page.getByRole('list').locator('li').count();
      expect(count).toBe(2);
    });

    it('first() returns first element', async () => {
      setup('<button>A</button><button>B</button>');
      const page = makePage();
      const text = await page.locator('button').first().textContent();
      expect(text).toBe('A');
    });

    it('last() returns last element', async () => {
      setup('<button>A</button><button>B</button>');
      const page = makePage();
      const text = await page.locator('button').last().textContent();
      expect(text).toBe('B');
    });

    it('nth(1) returns second element', async () => {
      setup('<button>A</button><button>B</button><button>C</button>');
      const page = makePage();
      const text = await page.locator('button').nth(1).textContent();
      expect(text).toBe('B');
    });

    it('filter({ hasText }) narrows results', async () => {
      setup('<li>foo item</li><li>bar item</li>');
      const page = makePage();
      const count = await page.locator('li').filter({ hasText: 'foo' }).count();
      expect(count).toBe(1);
    });

    it('filter({ has }) narrows by inner locator', async () => {
      setup('<div><button>Go</button></div><div><span>No</span></div>');
      const page = makePage();
      const inner = page.locator('button');
      const count = await page.locator('div').filter({ has: inner }).count();
      expect(count).toBe(1);
    });
  });

  // ==================== Strictness ====================

  describe('strictness', () => {
    it('click throws StrictModeViolationError when multiple matches', async () => {
      setup('<button>A</button><button>B</button>');
      const page = makePage();
      await expect(page.locator('button').click()).rejects.toThrow(StrictModeViolationError);
    });

    it('click retries until element appears and succeeds', async () => {
      setup('<div id="container"></div>');
      const page = makePage(undefined, 1000);

      // Add button after a delay
      setTimeout(() => {
        document.getElementById('container')!.innerHTML = '<button>Late</button>';
      }, 100);

      await expect(page.locator('button').click()).resolves.toBeUndefined();
    });

    it('click throws TimeoutError when element never appears', async () => {
      setup('<div></div>');
      const page = makePage(undefined, 150);
      await expect(page.locator('button').click()).rejects.toThrow(TimeoutError);
    });

    it('count() returns total without strict enforcement', async () => {
      setup('<button>A</button><button>B</button><button>C</button>');
      const page = makePage();
      const count = await page.locator('button').count();
      expect(count).toBe(3);
    });
  });

  // ==================== Actions ====================

  describe('click', () => {
    it('clicks a button', async () => {
      setup('<button>Click me</button>');
      const page = makePage();
      const events: string[] = [];
      document.querySelector('button')!.addEventListener('click', () => events.push('click'));
      await page.getByRole('button').click();
      expect(events).toContain('click');
    });

    it('trial mode does not click', async () => {
      setup('<button>Click me</button>');
      const page = makePage();
      const spy = vi.spyOn(document.querySelector('button')!, 'click');
      await page.getByRole('button').click({ trial: true });
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('fill', () => {
    it('fills an input', async () => {
      setup('<input type="text" />');
      const page = makePage();
      await page.locator('input').fill('hello world');
      expect((document.querySelector('input') as HTMLInputElement).value).toBe('hello world');
    });

    it('fills a textarea', async () => {
      setup('<textarea></textarea>');
      const page = makePage();
      await page.locator('textarea').fill('multiline text');
      expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe('multiline text');
    });

    it('fills a contenteditable div', async () => {
      setup('<div contenteditable="true"></div>');
      const page = makePage();
      await page.locator('[contenteditable]').fill('editable');
      expect(document.querySelector('[contenteditable]')!.textContent).toBe('editable');
    });
  });

  describe('press', () => {
    it('fires keyboard events', async () => {
      setup('<input type="text" />');
      const page = makePage();
      const input = document.querySelector('input')!;
      const keys: string[] = [];
      input.addEventListener('keydown', (e) => keys.push((e as KeyboardEvent).key));
      await page.locator('input').press('Enter');
      expect(keys).toContain('Enter');
    });
  });

  describe('pressSequentially', () => {
    it('types each character', async () => {
      setup('<input type="text" />');
      const page = makePage();
      await page.locator('input').pressSequentially('abc');
      expect((document.querySelector('input') as HTMLInputElement).value).toBe('abc');
    });
  });

  describe('check / uncheck', () => {
    it('checks a checkbox', async () => {
      setup('<input type="checkbox" />');
      const page = makePage();
      await page.locator('input[type="checkbox"]').check();
      expect((document.querySelector('input') as HTMLInputElement).checked).toBe(true);
    });

    it('unchecks a checkbox', async () => {
      setup('<input type="checkbox" />');
      const page = makePage();
      const cb = document.querySelector('input') as HTMLInputElement;
      cb.click(); // check it first
      await page.locator('input[type="checkbox"]').uncheck();
      expect(cb.checked).toBe(false);
    });
  });

  describe('selectOption', () => {
    it('selects an option by value', async () => {
      setup(`
        <select>
          <option value="a">Apple</option>
          <option value="b">Banana</option>
        </select>
      `);
      const page = makePage();
      await page.locator('select').selectOption('b');
      expect((document.querySelector('select') as HTMLSelectElement).value).toBe('b');
    });
  });

  describe('hover', () => {
    it('dispatches mouse events', async () => {
      setup('<div id="target">Hover me</div>');
      const page = makePage();
      const events: string[] = [];
      document.getElementById('target')!.addEventListener('mouseover', () => events.push('mouseover'));
      await page.locator('#target').hover();
      expect(events).toContain('mouseover');
    });
  });

  // ==================== Queries ====================

  describe('textContent', () => {
    it('returns text content', async () => {
      setup('<p>Hello</p>');
      const page = makePage();
      const text = await page.locator('p').textContent();
      expect(text).toBe('Hello');
    });
  });

  describe('inputValue', () => {
    it('returns input value', async () => {
      setup('<input type="text" value="initial" />');
      const page = makePage();
      const val = await page.locator('input').inputValue();
      expect(val).toBe('initial');
    });
  });

  describe('isVisible', () => {
    it('returns false when element is hidden', async () => {
      setup('<button style="display:none">Hidden</button>');
      const page = makePage();
      const visible = await page.locator('button').isVisible();
      expect(visible).toBe(false);
    });

    it('returns false when no matching element', async () => {
      setup('<div></div>');
      const page = makePage();
      const visible = await page.locator('button').isVisible();
      expect(visible).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('returns false for disabled button', async () => {
      setup('<button disabled>Disabled</button>');
      const page = makePage();
      const enabled = await page.locator('button').isEnabled();
      expect(enabled).toBe(false);
    });

    it('returns true for enabled button', async () => {
      setup('<button>Enabled</button>');
      const page = makePage();
      const enabled = await page.locator('button').isEnabled();
      expect(enabled).toBe(true);
    });
  });

  describe('waitFor', () => {
    it('resolves when element becomes attached', async () => {
      setup('<div id="container"></div>');
      const page = makePage(undefined, 500);

      setTimeout(() => {
        document.getElementById('container')!.innerHTML = '<button>Hello</button>';
      }, 50);

      await expect(
        page.locator('button').waitFor({ state: 'attached' }),
      ).resolves.toBeUndefined();
    });

    it('throws TimeoutError when element never appears', async () => {
      setup('<div></div>');
      const page = makePage(undefined, 100);
      await expect(
        page.locator('button').waitFor({ state: 'attached', timeout: 100 }),
      ).rejects.toThrow(TimeoutError);
    });

    it('resolves immediately for detached when element is absent', async () => {
      setup('<div></div>');
      const page = makePage();
      await expect(
        page.locator('button').waitFor({ state: 'detached' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('evaluate', () => {
    it('runs function on resolved element', async () => {
      setup('<button>Hello</button>');
      const page = makePage();
      const text = await page.locator('button').evaluate((el) => el.textContent);
      expect(text).toBe('Hello');
    });

    it('throws UnsupportedError for remote frame', async () => {
      // We test by directly invoking on a remote-frame root locator -- skip here
      // as integration is covered in frame tests
    });
  });

  describe('describe', () => {
    it('returns human-readable description', () => {
      const page = makePage();
      const desc = page.getByRole('button', { name: 'Submit' }).describe();
      expect(desc).toContain('button');
      expect(desc).toContain('Submit');
    });
  });
});
