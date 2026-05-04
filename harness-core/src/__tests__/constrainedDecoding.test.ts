import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  buildToonLlGuidanceGrammar,
  constrainToJsonSchema,
  constrainToLarkGrammar,
  constrainToToon,
  constrainToZod,
  createGuidanceTsInferenceClient,
  createHarnessExtensionContext,
  createToonGrammarPlugin,
  decodeConstrainedOutput,
  decodeConstrainedOutputWithHooks,
  guidanceConnectionString,
  resolveGuidanceTsGrammar,
  toGuidanceTsGrammar,
  type CoreInferenceOptions,
} from '../index.js';

interface GuidanceRequest {
  url: string;
  init: RequestInit;
  body: Record<string, unknown>;
}

const guidanceRequests: GuidanceRequest[] = [];

beforeEach(() => {
  guidanceRequests.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestInit = init ?? {};
    guidanceRequests.push({
      url: String(input),
      init: requestInit,
      body: JSON.parse(String(requestInit.body)),
    });
    return new Response(guidanceEventStream('APPROVE'), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function guidanceEventStream(text: string): string {
  const textOutput = {
    object: 'text',
    str: text,
    hex: toHex(text),
    log_prob: 0,
    num_tokens: 1,
    is_generated: true,
    stats: {
      runtime_us: 0,
      rows: 0,
      definitive_bytes: 0,
      lexer_ops: 0,
      all_items: 0,
      hidden_bytes: 0,
    },
  };
  const finalOutput = {
    object: 'final_text',
    str: '',
    hex: '',
    stop_reason: 'EndOfSentence',
  };
  const run = {
    object: 'run',
    forks: [{
      index: 0,
      text,
      error: '',
      logs: `JSON-OUT: ${JSON.stringify(textOutput)}\nJSON-OUT: ${JSON.stringify(finalOutput)}`,
      storage: [],
      micros: 0,
    }],
    usage: { sampled_tokens: 1, ff_tokens: 0, cost: 0 },
  };

  return [
    `data: ${JSON.stringify({ id: 'run-1', object: 'initial-run', created: 0, model: 'test' })}`,
    `data: ${JSON.stringify(run)}`,
    'data: [DONE]',
  ].join('\n\n');
}

function toHex(text: string): string {
  return Array.from(new TextEncoder().encode(text))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function createToonHooks() {
  const context = createHarnessExtensionContext();
  await context.plugins.load(createToonGrammarPlugin());
  return context.hooks;
}

describe('constrained decoding grammar adapters', () => {
  it('serializes JSON Schema, Lark, and hook-provided TOON constraints for guidance-ts', async () => {
    const hooks = await createToonHooks();
    const schema = {
      type: 'object',
      properties: {
        action: { type: 'string' },
      },
      required: ['action'],
    };

    expect(toGuidanceTsGrammar(constrainToJsonSchema(schema, { maxTokens: 32 })).serialize())
      .toEqual({
        grammars: [{ name: 'json_schema', json_schema: schema }],
        max_tokens: 32,
      });
    expect(toGuidanceTsGrammar(constrainToLarkGrammar('start: "APPROVE"', { maxTokens: 8 })).serialize())
      .toEqual({
        grammars: [{ name: 'lark_grammar', lark_grammar: 'start: "APPROVE"' }],
        max_tokens: 8,
      });
    expect(() => toGuidanceTsGrammar(constrainToToon()))
      .toThrow('No constrained decoding hook resolved toon');
    await expect(resolveGuidanceTsGrammar(constrainToToon()))
      .rejects.toThrow('No constrained decoding hook resolved toon');
    expect((await resolveGuidanceTsGrammar(constrainToToon(), { hooks })).serialize())
      .toEqual(buildToonLlGuidanceGrammar());
  });

  it('defaults Zod constraints to JSON Schema and allows grammar overrides', () => {
    const zodLikeSchema = {
      parse: vi.fn((value: unknown) => value),
    };
    const jsonSchema = {
      type: 'object',
      properties: { status: { enum: ['ok'] } },
      required: ['status'],
    };
    const toJsonSchema = vi.fn(() => jsonSchema);
    const overriddenToJsonSchema = vi.fn(() => {
      throw new Error('override should not resolve JSON schema');
    });

    expect(toGuidanceTsGrammar(constrainToZod(zodLikeSchema, { toJsonSchema })).serialize())
      .toEqual({
        grammars: [{ name: 'json_schema', json_schema: jsonSchema }],
      });
    expect(toGuidanceTsGrammar(constrainToZod(zodLikeSchema, {
      grammar: constrainToLarkGrammar('start: "ok"'),
      toJsonSchema: overriddenToJsonSchema,
    })).serialize())
      .toEqual({
        grammars: [{ name: 'lark_grammar', lark_grammar: 'start: "ok"' }],
      });

    expect(toJsonSchema).toHaveBeenCalledWith(zodLikeSchema);
    expect(overriddenToJsonSchema).not.toHaveBeenCalled();
  });

  it('converts explicit Zod schemas to JSON Schema by default', () => {
    const grammar = toGuidanceTsGrammar(constrainToZod(z.object({
      status: z.enum(['ok']),
    }))).serialize();

    expect(grammar).toEqual({
      grammars: [{
        name: 'json_schema',
        json_schema: expect.objectContaining({
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok'] },
          },
          required: ['status'],
          additionalProperties: false,
        }),
      }],
    });
  });

  it('accepts direct guidance grammars, serialized grammars, and per-format overrides', async () => {
    const hooks = await createToonHooks();
    const directGrammar = { serialize: () => ({ grammars: [{ name: 'direct' }] }) };
    const serializedGrammar = { grammars: [{ name: 'serialized' }] };

    expect(toGuidanceTsGrammar(directGrammar)).toBe(directGrammar);
    expect(toGuidanceTsGrammar(serializedGrammar).serialize()).toEqual(serializedGrammar);
    expect(toGuidanceTsGrammar(constrainToJsonSchema({ type: 'string' }, {
      grammar: serializedGrammar,
    })).serialize()).toEqual(serializedGrammar);
    expect(toGuidanceTsGrammar(constrainToToon({
      grammar: constrainToLarkGrammar('start: "toon"'),
    })).serialize()).toEqual({
      grammars: [{ name: 'lark_grammar', lark_grammar: 'start: "toon"' }],
    });
    expect((await resolveGuidanceTsGrammar(constrainToToon({
      grammar: constrainToLarkGrammar('start: "resolved-toon"'),
    }), { hooks })).serialize()).toEqual({
      grammars: [{ name: 'lark_grammar', lark_grammar: 'start: "resolved-toon"' }],
    });
    expect((await resolveGuidanceTsGrammar(constrainToJsonSchema({ type: 'string' }, {
      grammar: constrainToToon({ maxTokens: 3 }),
    }), { hooks })).serialize()).toEqual(buildToonLlGuidanceGrammar(3));
    expect(() => toGuidanceTsGrammar(constrainToZod({ parse: (value: unknown) => value }, {
      format: 'toon',
    }))).toThrow('No constrained decoding hook resolved toon');
    expect((await resolveGuidanceTsGrammar(constrainToZod({ parse: (value: unknown) => value }, {
      format: 'toon',
    }), { hooks })).serialize()).toEqual(buildToonLlGuidanceGrammar());
    expect((await resolveGuidanceTsGrammar(constrainToZod({ parse: (value: unknown) => value }, {
      grammar: serializedGrammar,
    }), { hooks })).serialize()).toEqual(serializedGrammar);
  });
});

describe('guidance-ts inference client', () => {
  it('routes unconstrained messages to the fallback while keeping the guidance runtime required', async () => {
    const fallback = {
      infer: vi.fn(async (_messages: unknown, options?: CoreInferenceOptions) => `fallback:${options?.maxTokens ?? 0}`),
    };
    const client = createGuidanceTsInferenceClient({
      settings: { guidanceServerUrl: 'https://guidance.example/run', apiKey: 'secret' },
      fallback,
      maxTokens: 16,
    });

    await expect(client.infer([{ role: 'user', content: 'plain' }], { maxTokens: 7 }))
      .resolves.toBe('fallback:7');

    expect(fallback.infer).toHaveBeenCalledWith(
      [{ role: 'user', content: 'plain' }],
      { maxTokens: 7 },
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('runs guidance-ts generations through the configured guidance server for constrained requests', async () => {
    const fallback = {
      infer: vi.fn(async () => 'fallback'),
    };
    const client = createGuidanceTsInferenceClient({
      settings: { guidanceServerUrl: 'https://guidance.example/run', apiKey: 'secret' },
      fallback,
      maxTokens: 16,
    });

    await expect(client.infer(
      [{ role: 'user', content: 'decide' }],
      { constrainedDecoding: constrainToLarkGrammar('start: "APPROVE"'), maxTokens: 4 },
    )).resolves.toBe('APPROVE');

    expect(fallback.infer).not.toHaveBeenCalled();
    expect(guidanceRequests).toHaveLength(1);
    expect(guidanceRequests[0].url).toBe('https://guidance.example/run');
    expect(guidanceRequests[0].init.headers).toMatchObject({
      'api-key': 'secret',
      'Content-Type': 'application/json',
    });
    expect(guidanceRequests[0].body).toMatchObject({
      controller: 'llguidance',
      controller_arg: {
        grammar: { grammars: [{ name: 'lark_grammar', lark_grammar: 'start: "APPROVE"' }] },
      },
      messages: [{ role: 'user', content: 'decide' }],
      max_tokens: 4,
    });
  });

  it('resolves constrained generation token limits by request, constraint, client, then undefined', async () => {
    const makeClient = (maxTokens?: number) => createGuidanceTsInferenceClient({
      settings: { guidanceServerUrl: 'https://guidance.example/run', apiKey: 'secret' },
      fallback: { infer: vi.fn(async () => 'fallback') },
      maxTokens,
    });
    const messages = [{ role: 'user' as const, content: 'decode' }];

    await makeClient(16).infer(messages, { constrainedDecoding: constrainToJsonSchema({ type: 'string' }, { maxTokens: 9 }) });
    await makeClient(16).infer(messages, { constrainedDecoding: constrainToJsonSchema({ type: 'string' }) });
    await makeClient().infer(messages, { constrainedDecoding: constrainToJsonSchema({ type: 'string' }) });

    expect(guidanceRequests.map((request) => request.body.max_tokens))
      .toEqual([9, 16, undefined]);
  });

  it('uses output-production hooks to resolve TOON constraints for generation', async () => {
    const hooks = await createToonHooks();
    const client = createGuidanceTsInferenceClient({
      settings: { guidanceServerUrl: 'https://guidance.example/run', apiKey: 'secret' },
      fallback: { infer: vi.fn(async () => 'fallback') },
      hooks,
    });

    await expect(client.infer(
      [{ role: 'user', content: 'encode as toon' }],
      { constrainedDecoding: constrainToToon({ maxTokens: 5 }) },
    )).resolves.toBe('APPROVE');

    expect(guidanceRequests[0].body).toMatchObject({
      controller_arg: {
        grammar: buildToonLlGuidanceGrammar(5),
      },
    });
  });

  it('builds guidance connection strings from remote settings', () => {
    expect(guidanceConnectionString({ guidanceServerUrl: 'https://guidance.example/run', apiKey: 'secret' }))
      .toBe('https://guidance.example/run#key=secret');
    expect(guidanceConnectionString({ guidanceServerUrl: 'https://guidance.example/run#embedded' }))
      .toBe('https://guidance.example/run#embedded');
    expect(() => guidanceConnectionString({ guidanceServerUrl: '   ' }))
      .toThrow('guidanceServerUrl is required');
  });
});

describe('constrained output decoding', () => {
  it('decodes JSON, Zod, hook-provided TOON, and Lark outputs', async () => {
    const hooks = await createToonHooks();
    const zodLikeSchema = {
      parse: vi.fn((value: unknown) => ({ value, parsed: true })),
    };

    expect(decodeConstrainedOutput('{"status":"ok"}', constrainToJsonSchema({ type: 'object' })))
      .toEqual({ status: 'ok' });
    expect(decodeConstrainedOutput('{"status":"ok"}', constrainToZod(zodLikeSchema)))
      .toEqual({ value: { status: 'ok' }, parsed: true });
    await expect(decodeConstrainedOutputWithHooks('{"status":"ok"}', constrainToJsonSchema({ type: 'object' })))
      .resolves.toEqual({ status: 'ok' });
    expect(decodeConstrainedOutput('status: ok', constrainToToon({
      decode: (text) => ({ raw: text }),
    }))).toEqual({ raw: 'status: ok' });
    expect(() => decodeConstrainedOutput('status: ok\ncount: 2', constrainToToon()))
      .toThrow('No constrained decoding hook resolved toon output');
    await expect(decodeConstrainedOutputWithHooks('status: ok\ncount: 2', constrainToToon()))
      .rejects.toThrow('No constrained decoding hook resolved toon output');
    await expect(decodeConstrainedOutputWithHooks('status: ok\ncount: 2', constrainToToon(), { hooks }))
      .resolves.toEqual({ status: 'ok', count: 2 });
    expect(decodeConstrainedOutput('APPROVE', constrainToLarkGrammar('start: "APPROVE"', {
      parse: (text) => text.toLowerCase(),
    }))).toBe('approve');
    expect(decodeConstrainedOutput('APPROVE', constrainToLarkGrammar('start: "APPROVE"')))
      .toBe('APPROVE');
    expect(decodeConstrainedOutput('status: ok', constrainToZod(zodLikeSchema, {
      format: 'toon',
      decodeToon: () => ({ status: 'ok' }),
    }))).toEqual({ value: { status: 'ok' }, parsed: true });
    await expect(decodeConstrainedOutputWithHooks('status: ok', constrainToZod(zodLikeSchema, {
      format: 'toon',
    }), { hooks })).resolves.toEqual({ value: { status: 'ok' }, parsed: true });

    expect(zodLikeSchema.parse).toHaveBeenCalledWith({ status: 'ok' });
  });

  it('reports invalid Zod schema conversion errors', () => {
    expect(() => toGuidanceTsGrammar(constrainToZod({}, {
      toJsonSchema: () => {
        throw new Error('cannot convert');
      },
    }))).toThrow('Pass toJsonSchema');
    expect(() => toGuidanceTsGrammar(constrainToZod({})))
      .toThrow('Unable to convert Zod schema');
  });
});

