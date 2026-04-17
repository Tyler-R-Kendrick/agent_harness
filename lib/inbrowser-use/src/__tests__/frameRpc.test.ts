import { describe, it, expect, vi } from 'vitest';
import {
  DefaultFrameChannelRegistry,
  getSameOriginFrameDocument,
  installFrameRPCHandler,
  sendFrameAction,
  sendFrameQuery,
} from '../frameRpc.js';
import { RemoteRPCTimeoutError, RemoteRPCError } from '../errors.js';
import type { CrossOriginFrameChannel, FrameRPCRequest, FrameRPCResponse } from '../types.js';

describe('frameRpc', () => {
  describe('DefaultFrameChannelRegistry', () => {
    it('returns undefined for any iframe', () => {
      const reg = new DefaultFrameChannelRegistry();
      const iframe = document.createElement('iframe');
      expect(reg.getForIframe(iframe)).toBeUndefined();
    });
  });

  describe('getSameOriginFrameDocument', () => {
    it('returns document from same-origin iframe', () => {
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      const doc = getSameOriginFrameDocument(iframe);
      expect(doc).toBeDefined();
      document.body.removeChild(iframe);
    });

    it('throws for cross-origin iframe', () => {
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      Object.defineProperty(iframe, 'contentDocument', {
        get() { throw new DOMException('Blocked'); },
        configurable: true,
      });
      expect(() => getSameOriginFrameDocument(iframe)).toThrow();
      document.body.removeChild(iframe);
    });
  });

  describe('sendFrameAction', () => {
    it('sends action and resolves on ok response', async () => {
      const channel: CrossOriginFrameChannel = {
        targetOrigin: 'https://other.com',
        send: vi.fn().mockResolvedValue({
          rpc: 'in-app-playwright',
          id: 'test-1',
          ok: true,
        } satisfies FrameRPCResponse),
      };

      await expect(
        sendFrameAction(
          channel,
          { steps: [{ kind: 'css', selector: 'button' }] },
          { type: 'click' },
          1000,
        ),
      ).resolves.toBeUndefined();

      expect(channel.send).toHaveBeenCalledOnce();
      const req = (channel.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as FrameRPCRequest;
      expect(req.rpc).toBe('in-app-playwright');
      expect(req.kind).toBe('locator-action');
      expect(req.action?.type).toBe('click');
    });

    it('throws RemoteRPCError on error response', async () => {
      const channel: CrossOriginFrameChannel = {
        targetOrigin: 'https://other.com',
        send: vi.fn().mockResolvedValue({
          rpc: 'in-app-playwright',
          id: 'test-2',
          ok: false,
          error: { code: 'NOT_FOUND', message: 'element not found' },
        } satisfies FrameRPCResponse),
      };

      await expect(
        sendFrameAction(
          channel,
          { steps: [] },
          { type: 'click' },
          1000,
        ),
      ).rejects.toThrow(RemoteRPCError);
    });

    it('throws RemoteRPCTimeoutError on timeout', async () => {
      const channel: CrossOriginFrameChannel = {
        targetOrigin: 'https://other.com',
        send: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
      };

      await expect(
        sendFrameAction(channel, { steps: [] }, { type: 'click' }, 50),
      ).rejects.toThrow(RemoteRPCTimeoutError);
    });
  });

  describe('sendFrameQuery', () => {
    it('sends query and returns result', async () => {
      const channel: CrossOriginFrameChannel = {
        targetOrigin: 'https://other.com',
        send: vi.fn().mockResolvedValue({
          rpc: 'in-app-playwright',
          id: 'q-1',
          ok: true,
          result: 42,
        } satisfies FrameRPCResponse),
      };

      const result = await sendFrameQuery<number>(
        channel,
        { steps: [] },
        { type: 'count' },
        1000,
      );
      expect(result).toBe(42);
    });
  });

  describe('installFrameRPCHandler', () => {
    it('handles locator-action RPC from allowed origin', async () => {
      const executeAction = vi.fn().mockResolvedValue(undefined);
      const executeQuery = vi.fn();
      const mockWindow = { addEventListener: vi.fn(), removeEventListener: vi.fn() };

      installFrameRPCHandler(
        ['https://parent.com'],
        { executeAction, executeQuery },
        mockWindow as unknown as Window,
      );

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));

      // Simulate the message event
      const handler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls[0][1];
      const mockEvent: Partial<MessageEvent> = {
        origin: 'https://parent.com',
        data: {
          rpc: 'in-app-playwright',
          id: 'test-rpc-1',
          kind: 'locator-action',
          plan: { steps: [{ kind: 'css', selector: 'button' }] },
          action: { type: 'click' },
        } satisfies FrameRPCRequest,
        source: { postMessage: vi.fn() } as unknown as Window,
      };

      await handler(mockEvent);
      expect(executeAction).toHaveBeenCalledOnce();
    });

    it('ignores messages from disallowed origins', async () => {
      const executeAction = vi.fn();
      const mockWindow = { addEventListener: vi.fn(), removeEventListener: vi.fn() };

      installFrameRPCHandler(
        ['https://allowed.com'],
        { executeAction, executeQuery: vi.fn() },
        mockWindow as unknown as Window,
      );

      const handler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls[0][1];
      await handler({
        origin: 'https://malicious.com',
        data: { rpc: 'in-app-playwright', id: 'x', kind: 'locator-action' },
        source: { postMessage: vi.fn() },
      });

      expect(executeAction).not.toHaveBeenCalled();
    });

    it('returns cleanup function that removes listener', () => {
      const mockWindow = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
      const cleanup = installFrameRPCHandler(
        ['*'],
        { executeAction: vi.fn(), executeQuery: vi.fn() },
        mockWindow as unknown as Window,
      );
      cleanup();
      expect(mockWindow.removeEventListener).toHaveBeenCalled();
    });
  });
});
