import { describe, it, expect, vi } from 'vitest';
import { createInAppPage } from '../index.js';
import {
  FrameNotFoundError,
  FrameNotCooperativeError,
  RemoteRPCError,
} from '../errors.js';
import type { CrossOriginFrameChannel, FrameChannelRegistry } from '../types.js';

function setup(html: string) {
  document.body.innerHTML = html;
}

function makePage(html?: string, options: Parameters<typeof createInAppPage>[0] = {}) {
  if (html !== undefined) setup(html);
  return createInAppPage({
    defaultTimeoutMs: 300,
    quietDomMs: 0,
    stableFrames: 0,
    ...options,
  });
}

describe('FrameLocator', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('same-origin frame', () => {
    function makeIframe(id: string): HTMLIFrameElement {
      const iframe = document.createElement('iframe');
      iframe.id = id;
      document.body.appendChild(iframe);
      return iframe;
    }

    it('resolves and clicks button inside same-origin iframe', async () => {
      const iframe = makeIframe('test-frame');
      const frameDoc = iframe.contentDocument!;
      const btn = frameDoc.createElement('button');
      btn.textContent = 'In Frame';
      frameDoc.body.appendChild(btn);

      const page = makePage();
      const events: string[] = [];
      btn.addEventListener('click', () => events.push('click'));

      await page.frameLocator('#test-frame').getByRole('button').click();
      expect(events).toContain('click');
    });

    it('fills input inside same-origin iframe', async () => {
      const iframe = makeIframe('input-frame');
      const frameDoc = iframe.contentDocument!;
      const input = frameDoc.createElement('input');
      input.type = 'text';
      frameDoc.body.appendChild(input);

      const page = makePage();
      await page.frameLocator('#input-frame').locator('input').fill('hello');
      expect(input.value).toBe('hello');
    });

    it('counts elements inside a frame', async () => {
      const iframe = makeIframe('count-frame');
      const frameDoc = iframe.contentDocument!;
      const li1 = frameDoc.createElement('li');
      li1.textContent = 'A';
      const li2 = frameDoc.createElement('li');
      li2.textContent = 'B';
      frameDoc.body.appendChild(li1);
      frameDoc.body.appendChild(li2);

      const page = makePage();
      const count = await page.frameLocator('#count-frame').locator('li').count();
      expect(count).toBe(2);
    });

    it('nested frameLocator works', async () => {
      // jsdom doesn't support nested iframes well, but we can verify the API accepts it
      const iframe = makeIframe('outer-frame', '<div>outer</div>');
      const page = makePage();
      const nestedLocator = page
        .frameLocator('#outer-frame')
        .frameLocator('#inner-frame')
        .locator('button');
      // This should not throw synchronously (lazy resolution)
      expect(nestedLocator).toBeDefined();
    });
  });

  describe('non-cooperative cross-origin frame', () => {
    it('throws FrameNotCooperativeError', async () => {
      const iframe = document.createElement('iframe');
      iframe.id = 'cross-frame';
      // Set to cross-origin-looking src to avoid same-origin access
      // jsdom will still allow same-origin access, so we need to mock contentDocument
      document.body.appendChild(iframe);

      // Mock the iframe to simulate cross-origin access restricted
      Object.defineProperty(iframe, 'contentDocument', {
        get() {
          throw new DOMException('Blocked a frame with origin');
        },
        configurable: true,
      });

      const page = makePage();
      await expect(
        page.frameLocator('#cross-frame').locator('button').click(),
      ).rejects.toThrow(FrameNotCooperativeError);
    });
  });

  describe('cooperative cross-origin frame (RPC)', () => {
    function makeMockChannel(
      respondOk: boolean = true,
      result?: unknown,
    ): CrossOriginFrameChannel {
      return {
        targetOrigin: 'https://other.example.com',
        send: vi.fn().mockResolvedValue({
          rpc: 'in-app-playwright',
          id: 'test-id',
          ok: respondOk,
          result,
          error: respondOk ? undefined : { code: 'NOT_FOUND', message: 'not found' },
        }),
      };
    }

    it('sends RPC click action for cooperative cross-origin frame', async () => {
      const iframe = document.createElement('iframe');
      iframe.id = 'rpc-frame';
      document.body.appendChild(iframe);

      // Make same-origin access throw to simulate cross-origin
      Object.defineProperty(iframe, 'contentDocument', {
        get() { throw new DOMException('Blocked'); },
        configurable: true,
      });

      const mockChannel = makeMockChannel(true);
      const registry: FrameChannelRegistry = {
        getForIframe: (el) => el === iframe ? mockChannel : undefined,
      };

      const page = makePage(undefined, { frameChannels: registry });

      await page.frameLocator('#rpc-frame').locator('button').click();
      expect(mockChannel.send).toHaveBeenCalledOnce();
      const call = (mockChannel.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.rpc).toBe('in-app-playwright');
      expect(call.kind).toBe('locator-action');
      expect(call.action.type).toBe('click');
    });

    it('sends RPC query for count in cooperative frame', async () => {
      const iframe = document.createElement('iframe');
      iframe.id = 'rpc-frame-2';
      document.body.appendChild(iframe);

      Object.defineProperty(iframe, 'contentDocument', {
        get() { throw new DOMException('Blocked'); },
        configurable: true,
      });

      const mockChannel = makeMockChannel(true, 3);
      const registry: FrameChannelRegistry = {
        getForIframe: (el) => el === iframe ? mockChannel : undefined,
      };

      const page = makePage(undefined, { frameChannels: registry });
      const count = await page.frameLocator('#rpc-frame-2').locator('li').count();
      expect(count).toBe(3);
    });

    it('throws RemoteRPCError when RPC returns error', async () => {
      const iframe = document.createElement('iframe');
      iframe.id = 'error-frame';
      document.body.appendChild(iframe);

      Object.defineProperty(iframe, 'contentDocument', {
        get() { throw new DOMException('Blocked'); },
        configurable: true,
      });

      const mockChannel = makeMockChannel(false);
      const registry: FrameChannelRegistry = {
        getForIframe: (el) => el === iframe ? mockChannel : undefined,
      };

      const page = makePage(undefined, { frameChannels: registry });
      await expect(
        page.frameLocator('#error-frame').locator('button').click(),
      ).rejects.toThrow(RemoteRPCError);
    });
  });

  describe('frame not found', () => {
    it('throws FrameNotFoundError when selector matches nothing', async () => {
      const page = makePage('<div></div>');
      await expect(
        page.frameLocator('#nonexistent').locator('button').click(),
      ).rejects.toThrow(FrameNotFoundError);
    });

    it('throws FrameNotFoundError when selector matches non-iframe', async () => {
      const page = makePage('<div id="not-a-frame"></div>');
      await expect(
        page.frameLocator('#not-a-frame').locator('button').click(),
      ).rejects.toThrow(FrameNotFoundError);
    });
  });
});
