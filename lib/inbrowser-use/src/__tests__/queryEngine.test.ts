import { describe, it, expect } from 'vitest';
import { QueryEngine } from '../queryEngine.js';

function setup(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

describe('QueryEngine', () => {
  const engine = new QueryEngine(false, 'data-testid');

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('CSS selector', () => {
    it('resolves a single element', async () => {
      setup('<button>Click me</button>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'css', selector: 'button' }],
      );
      expect(nodes).toHaveLength(1);
      expect(nodes[0].element.tagName).toBe('BUTTON');
    });

    it('resolves multiple elements', async () => {
      setup('<button>A</button><button>B</button>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'css', selector: 'button' }],
      );
      expect(nodes).toHaveLength(2);
    });

    it('returns empty for no match', async () => {
      setup('<div>nothing</div>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'css', selector: 'button' }],
      );
      expect(nodes).toHaveLength(0);
    });
  });

  describe('getByRole', () => {
    it('finds button by implicit role', async () => {
      setup('<button>Submit</button>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'role', role: 'button' }],
      );
      expect(nodes).toHaveLength(1);
    });

    it('finds element with explicit role', async () => {
      setup('<div role="button">Click</div>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'role', role: 'button' }],
      );
      expect(nodes).toHaveLength(1);
    });

    it('finds button by accessible name (exact)', async () => {
      setup('<button>Submit</button><button>Cancel</button>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'role', role: 'button', options: { name: 'Submit', exact: true } }],
      );
      expect(nodes).toHaveLength(1);
      expect(nodes[0].element.textContent).toBe('Submit');
    });

    it('finds button by accessible name (regex)', async () => {
      setup('<button>Submit order</button>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'role', role: 'button', options: { name: /order/i } }],
      );
      expect(nodes).toHaveLength(1);
    });

    it('finds input[type=text] as textbox', async () => {
      setup('<input type="text" />');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'role', role: 'textbox' }],
      );
      expect(nodes).toHaveLength(1);
    });

    it('finds input[type=checkbox] as checkbox', async () => {
      setup('<input type="checkbox" />');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'role', role: 'checkbox' }],
      );
      expect(nodes).toHaveLength(1);
    });

    it('finds heading', async () => {
      setup('<h1>Title</h1><h2>Subtitle</h2>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'role', role: 'heading' }],
      );
      expect(nodes).toHaveLength(2);
    });

    it('finds link', async () => {
      setup('<a href="/foo">Go</a>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'role', role: 'link' }],
      );
      expect(nodes).toHaveLength(1);
    });
  });

  describe('getByText', () => {
    it('finds element by exact text', async () => {
      setup('<button>Hello</button>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'text', text: 'Hello', options: { exact: true } }],
      );
      expect(nodes).toHaveLength(1);
    });

    it('finds element by partial text (case insensitive)', async () => {
      setup('<p>Hello World</p>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'text', text: 'hello world' }],
      );
      expect(nodes).toHaveLength(1);
    });

    it('finds element by regex', async () => {
      setup('<span>Foo Bar</span>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'text', text: /bar/i }],
      );
      expect(nodes).toHaveLength(1);
    });

    it('returns most specific match (not ancestor)', async () => {
      setup('<div>Hello<span>Hello</span></div>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'text', text: 'Hello', options: { exact: true } }],
      );
      // Should return span, not div (most specific)
      expect(nodes).toHaveLength(1);
      expect(nodes[0].element.tagName).toBe('SPAN');
    });
  });

  describe('getByLabel', () => {
    it('finds input by label for= attribute', async () => {
      setup('<label for="name">Name</label><input id="name" type="text" />');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'label', text: 'Name' }],
      );
      expect(nodes).toHaveLength(1);
      expect(nodes[0].element.tagName).toBe('INPUT');
    });

    it('finds input wrapped in label', async () => {
      setup('<label>Username <input type="text" /></label>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'label', text: 'Username' }],
      );
      expect(nodes).toHaveLength(1);
      expect(nodes[0].element.tagName).toBe('INPUT');
    });

    it('finds element by aria-label', async () => {
      setup('<input type="text" aria-label="Search query" />');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'label', text: 'Search query' }],
      );
      expect(nodes).toHaveLength(1);
    });
  });

  describe('getByPlaceholder', () => {
    it('finds input by placeholder', async () => {
      setup('<input type="text" placeholder="Enter your name" />');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'placeholder', text: 'Enter your name' }],
      );
      expect(nodes).toHaveLength(1);
    });

    it('finds by regex placeholder', async () => {
      setup('<input placeholder="Search for items" />');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'placeholder', text: /search/i }],
      );
      expect(nodes).toHaveLength(1);
    });
  });

  describe('getByTestId', () => {
    it('finds element by data-testid string', async () => {
      setup('<button data-testid="submit-btn">Submit</button>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'testid', id: 'submit-btn' }],
      );
      expect(nodes).toHaveLength(1);
    });

    it('finds element by data-testid regex', async () => {
      setup(
        '<button data-testid="submit-btn">OK</button><button data-testid="cancel-btn">No</button>',
      );
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'testid', id: /submit/ }],
      );
      expect(nodes).toHaveLength(1);
    });
  });

  describe('filter', () => {
    it('filters by hasText', async () => {
      setup('<li>foo</li><li>bar</li>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'css', selector: 'li' }, { kind: 'filter', hasText: 'foo' }],
      );
      expect(nodes).toHaveLength(1);
      expect(nodes[0].element.textContent).toBe('foo');
    });

    it('filters by has (inner locator)', async () => {
      setup('<div><button>Go</button></div><div><span>No</span></div>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [
          { kind: 'css', selector: 'div' },
          { kind: 'filter', has: [{ kind: 'css', selector: 'button' }] },
        ],
      );
      expect(nodes).toHaveLength(1);
      expect(nodes[0].element.querySelector('button')).not.toBeNull();
    });
  });

  describe('nth / first / last', () => {
    it('nth(0) returns first element', async () => {
      setup('<button>A</button><button>B</button><button>C</button>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'css', selector: 'button' }, { kind: 'nth', index: 0 }],
      );
      expect(nodes).toHaveLength(1);
      expect(nodes[0].element.textContent).toBe('A');
    });

    it('nth(2) returns third element', async () => {
      setup('<button>A</button><button>B</button><button>C</button>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'css', selector: 'button' }, { kind: 'nth', index: 2 }],
      );
      expect(nodes).toHaveLength(1);
      expect(nodes[0].element.textContent).toBe('C');
    });

    it('first() returns first element', async () => {
      setup('<button>A</button><button>B</button>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'css', selector: 'button' }, { kind: 'first' }],
      );
      expect(nodes[0].element.textContent).toBe('A');
    });

    it('last() returns last element', async () => {
      setup('<button>A</button><button>B</button>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'css', selector: 'button' }, { kind: 'last' }],
      );
      expect(nodes[0].element.textContent).toBe('B');
    });

    it('nth out of range returns empty', async () => {
      setup('<button>A</button>');
      const nodes = await engine.resolveAll(
        { kind: 'document', document },
        [{ kind: 'css', selector: 'button' }, { kind: 'nth', index: 5 }],
      );
      expect(nodes).toHaveLength(0);
    });
  });

  describe('element root', () => {
    it('scopes query to element root', async () => {
      setup('<div id="container"><button>Inside</button></div><button>Outside</button>');
      const container = document.getElementById('container') as HTMLElement;
      const nodes = await engine.resolveAll(
        { kind: 'element', element: container },
        [{ kind: 'css', selector: 'button' }],
      );
      expect(nodes).toHaveLength(1);
      expect(nodes[0].element.textContent).toBe('Inside');
    });
  });

  describe('same-origin-frame root', () => {
    it('includes framePath in resolved node', async () => {
      const iframe = document.createElement('iframe');
      iframe.id = 'my-frame';
      document.body.appendChild(iframe);
      const frameDoc = iframe.contentDocument!;
      frameDoc.body.innerHTML = '<button>In Frame</button>';

      const nodes = await engine.resolveAll(
        { kind: 'same-origin-frame', iframe, document: frameDoc },
        [{ kind: 'css', selector: 'button' }],
      );
      expect(nodes).toHaveLength(1);
      expect(nodes[0].framePath).toContain('my-frame');
    });
  });

  describe('remote-frame root', () => {
    it('throws UnsupportedError for remote-frame root', async () => {
      const channel = { targetOrigin: 'https://other.com', send: async () => ({}) };
      await expect(
        engine.resolveAll({ kind: 'remote-frame', channel }, [{ kind: 'css', selector: 'button' }]),
      ).rejects.toThrow();
    });
  });
});
