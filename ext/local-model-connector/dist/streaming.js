import { ConnectorError, failFromUnknown, failure, } from './types';
import { buildHeaders, fetchLocalEndpoint, mapStatusCode } from './openaiLocalClient';
import { assertChatCompletionBody } from './validation';
export function parseOpenAIStreamChunk(chunk) {
    const events = [];
    for (const block of chunk.split(/\r?\n\r?\n/)) {
        const dataLines = block
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice('data:'.length).trimStart());
        if (!dataLines.length)
            continue;
        const data = dataLines.join('\n').trim();
        if (!data)
            continue;
        if (data === '[DONE]') {
            events.push({ done: true });
            continue;
        }
        try {
            const raw = JSON.parse(data);
            const token = extractToken(raw);
            if (token)
                events.push({ done: false, token, raw });
        }
        catch {
            // Some local runtimes interleave comments or partial invalid events; ignore
            // malformed SSE data unless the overall stream cannot be read.
        }
    }
    return events;
}
export async function streamChatCompletion(args) {
    args.emit({ type: 'start', requestId: args.requestId });
    const controller = new AbortController();
    const abortFromDisconnect = () => controller.abort(new ConnectorError('Stream was aborted.', 'STREAM_ABORTED'));
    args.disconnectSignal?.addEventListener('abort', abortFromDisconnect, { once: true });
    try {
        const body = {
            ...assertChatCompletionBody(args.body),
            stream: true,
        };
        const response = await fetchLocalEndpoint({
            baseUrl: args.baseUrl,
            apiKey: args.apiKey,
            timeoutMs: args.timeoutMs,
            fetchImpl: async (url, init) => {
                const fetchImpl = args.fetchImpl ?? fetch;
                return fetchImpl(url, {
                    ...init,
                    signal: controller.signal,
                    headers: buildHeaders('text/event-stream', args.apiKey, true),
                });
            },
            path: '/v1/chat/completions',
            method: 'POST',
            accept: 'text/event-stream',
            body,
        });
        if (!response.ok) {
            const error = mapStatusCode(response.status, 'stream');
            args.emit({
                type: 'error',
                requestId: args.requestId,
                error: error.error,
                code: error.code,
                status: error.status,
            });
            return;
        }
        if (!response.body) {
            args.emit({ type: 'error', requestId: args.requestId, error: 'Streaming response body is empty.', code: 'STREAM_PARSE_ERROR' });
            return;
        }
        await readSseStream(response.body, args);
    }
    catch (error) {
        const streamFailure = error instanceof DOMException && error.name === 'AbortError'
            ? failure('Stream was aborted.', 'STREAM_ABORTED')
            : error instanceof TypeError
                ? failure('No local model server responded at this address.', 'ENDPOINT_UNAVAILABLE')
                : failFromUnknown(error, 'ENDPOINT_UNAVAILABLE');
        args.emit({
            type: 'error',
            requestId: args.requestId,
            error: streamFailure.error,
            code: streamFailure.code,
            status: streamFailure.status,
        });
    }
    finally {
        args.disconnectSignal?.removeEventListener('abort', abortFromDisconnect);
    }
}
async function readSseStream(body, args) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done = false;
    while (!done) {
        const next = await reader.read();
        if (next.done)
            break;
        buffer += decoder.decode(next.value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop();
        done = emitParsedEvents(blocks.join('\n\n'), args);
    }
    if (!done && buffer.trim()) {
        done = emitParsedEvents(buffer, args);
    }
    if (!done) {
        args.emit({ type: 'done', requestId: args.requestId });
    }
}
function emitParsedEvents(chunk, args) {
    for (const event of parseOpenAIStreamChunk(chunk)) {
        if (event.done) {
            args.emit({ type: 'done', requestId: args.requestId });
            return true;
        }
        args.emit({ type: 'token', requestId: args.requestId, token: event.token, raw: event.raw });
    }
    return false;
}
function extractToken(raw) {
    if (!isRecord(raw))
        return '';
    const choices = raw.choices;
    if (!Array.isArray(choices))
        return '';
    const first = choices[0];
    if (!isRecord(first))
        return '';
    if (isRecord(first.delta) && typeof first.delta.content === 'string')
        return first.delta.content;
    if (typeof first.text === 'string')
        return first.text;
    return '';
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=streaming.js.map