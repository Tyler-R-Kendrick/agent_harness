import type {
  CrossOriginFrameChannel,
  FrameChannelRegistry,
  FrameRPCRequest,
  FrameRPCResponse,
  SerializedLocatorPlan,
  SerializedAction,
  SerializedQuery,
} from './types.js';
import { RemoteRPCTimeoutError, RemoteRPCError } from './errors.js';

// ---------------------------------------------------------------------------
// Same-origin frame document helper
// ---------------------------------------------------------------------------

/**
 * Returns the document inside a same-origin iframe.
 * Throws a clear error if the document is inaccessible (cross-origin or not loaded).
 */
export function getSameOriginFrameDocument(iframe: HTMLIFrameElement): Document {
  try {
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) throw new Error('No document available');
    // Reading .body triggers a DOMException for cross-origin frames in some browsers
    void doc.body;
    return doc;
  } catch {
    throw new Error(
      `Cannot access frame document — frame may be cross-origin or not yet loaded`,
    );
  }
}

// ---------------------------------------------------------------------------
// Default no-op frame channel registry
// ---------------------------------------------------------------------------

export class DefaultFrameChannelRegistry implements FrameChannelRegistry {
  getForIframe(_iframe: HTMLIFrameElement): CrossOriginFrameChannel | undefined {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// RPC message builder / dispatcher
// ---------------------------------------------------------------------------

let _rpcCounter = 0;
function nextRPCId(): string {
  _rpcCounter += 1;
  return `iap-${Date.now()}-${_rpcCounter}`;
}

/**
 * Sends a locator-action RPC request to a cooperative cross-origin frame.
 */
export async function sendFrameAction(
  channel: CrossOriginFrameChannel,
  plan: SerializedLocatorPlan,
  action: SerializedAction,
  timeoutMs: number = 5000,
): Promise<void> {
  const request: FrameRPCRequest = {
    rpc: 'in-app-playwright',
    id: nextRPCId(),
    kind: 'locator-action',
    plan,
    action,
  };

  const response = await _sendWithTimeout<FrameRPCResponse>(
    channel,
    request,
    timeoutMs,
  );
  _handleResponse(response);
}

/**
 * Sends a locator-query RPC request and returns the raw result.
 */
export async function sendFrameQuery<T>(
  channel: CrossOriginFrameChannel,
  plan: SerializedLocatorPlan,
  query: SerializedQuery,
  timeoutMs: number = 5000,
): Promise<T> {
  const request: FrameRPCRequest = {
    rpc: 'in-app-playwright',
    id: nextRPCId(),
    kind: 'locator-query',
    plan,
    query,
  };

  const response = await _sendWithTimeout<FrameRPCResponse>(
    channel,
    request,
    timeoutMs,
  );
  _handleResponse(response);
  return response.result as T;
}

async function _sendWithTimeout<T>(
  channel: CrossOriginFrameChannel,
  request: FrameRPCRequest,
  timeoutMs: number,
): Promise<T> {
  const timeoutPromise: Promise<never> = new Promise((_, reject) =>
    setTimeout(
      () => reject(new RemoteRPCTimeoutError(request.id)),
      timeoutMs,
    ),
  );
  return Promise.race([channel.send<FrameRPCRequest, T>(request), timeoutPromise]);
}

function _handleResponse(response: FrameRPCResponse): void {
  if (!response.ok) {
    const err = response.error;
    throw new RemoteRPCError(
      err?.code ?? 'UNKNOWN',
      err?.message ?? 'Unknown remote error',
      err?.details,
    );
  }
}

// ---------------------------------------------------------------------------
// Child-frame RPC handler (installed in cooperative child frames)
// ---------------------------------------------------------------------------

export type ChildSideRuntime = {
  executeAction(plan: SerializedLocatorPlan, action: SerializedAction): Promise<void>;
  executeQuery(plan: SerializedLocatorPlan, query: SerializedQuery): Promise<unknown>;
};

/**
 * Installs a postMessage listener that handles parent → child RPC requests.
 * Returns a cleanup function.
 */
export function installFrameRPCHandler(
  allowedOrigins: string[],
  runtime: ChildSideRuntime,
  targetWindow: Window = window,
): () => void {
  const handler = async (event: MessageEvent) => {
    // Validate origin
    if (!allowedOrigins.includes('*') && !allowedOrigins.includes(event.origin)) {
      return;
    }

    const data = event.data as Partial<FrameRPCRequest>;
    if (data?.rpc !== 'in-app-playwright' || !data.id || !data.kind || !data.plan) {
      return;
    }

    const respondOk = (result?: unknown) => {
      const response: FrameRPCResponse = {
        rpc: 'in-app-playwright',
        id: data.id!,
        ok: true,
        result,
      };
      event.source?.postMessage(response, { targetOrigin: event.origin });
    };

    const respondError = (code: string, message: string, details?: unknown) => {
      const response: FrameRPCResponse = {
        rpc: 'in-app-playwright',
        id: data.id!,
        ok: false,
        error: { code, message, details },
      };
      event.source?.postMessage(response, { targetOrigin: event.origin });
    };

    try {
      if (data.kind === 'locator-action' && data.action) {
        await runtime.executeAction(data.plan, data.action);
        respondOk();
      } else if (data.kind === 'locator-query' && data.query) {
        const result = await runtime.executeQuery(data.plan, data.query);
        respondOk(result);
      } else {
        respondError('UNSUPPORTED', `Unknown RPC kind: ${data.kind}`);
      }
    } catch (err) {
      const e = err as Record<string, unknown>;
      respondError(
        String(e['code'] ?? 'UNKNOWN'),
        String(e['message'] ?? 'Unknown error'),
        e['details'],
      );
    }
  };

  targetWindow.addEventListener('message', handler);
  return () => targetWindow.removeEventListener('message', handler);
}
