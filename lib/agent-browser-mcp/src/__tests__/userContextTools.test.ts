import { describe, expect, it, vi } from 'vitest';
import { getModelContextRegistry, ModelContext } from '../../../webmcp/src/index';

import { createWebMcpTool } from '../tool';
import { registerWorkspaceTools } from '../workspaceTools';

describe('registerUserContextTools', () => {
  it('registers app-owned memory recall, browser location, user elicitation, and secret request tools', async () => {
    const modelContext = new ModelContext();
    const getUserContextMemory = vi.fn(async ({ query }: { query?: string }) => ({
      status: 'found',
      query,
      memories: [{
        id: 'location.city',
        label: 'Saved city',
        value: 'Chicago, IL',
        source: 'workspace-memory',
        updatedAt: '2026-04-26T00:00:00.000Z',
      }],
    }));
    const getBrowserLocation = vi.fn(async () => ({
      status: 'denied',
      reason: 'Browser location permission was denied.',
    }));
    const onElicitUserInput = vi.fn(async ({ prompt }: { prompt: string }) => ({
      status: 'needs_user_input',
      requestId: 'elicitation-1',
      prompt,
      fields: [{ id: 'location', label: 'City or neighborhood', required: true }],
    }));
    const onRequestSecret = vi.fn(async ({ name }: { name?: string }) => ({
      status: 'secret_ref_created',
      requestId: 'secret-1',
      name: name ?? 'API_KEY',
      secretRef: 'secret-ref://local/api-key',
    }));

    (registerWorkspaceTools as (context: ModelContext, options: Record<string, unknown>) => void)(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      getUserContextMemory,
      getBrowserLocation,
      onElicitUserInput,
      onRequestSecret,
    });

    expect(getModelContextRegistry(modelContext).list().map(({ name }) => name)).toEqual(expect.arrayContaining([
      'recall_user_context',
      'read_browser_location',
      'elicit_user_input',
      'request_secret',
    ]));

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({
      tool: 'recall_user_context',
      args: { query: 'location', limit: 30 },
    }, {} as never)).resolves.toEqual({
      status: 'found',
      query: 'location',
      memories: [expect.objectContaining({ id: 'location.city', value: 'Chicago, IL' })],
    });
    await expect(webmcpTool.execute?.({ tool: 'read_browser_location' }, {} as never)).resolves.toEqual({
      status: 'denied',
      reason: 'Browser location permission was denied.',
    });
    await expect(webmcpTool.execute?.({
      tool: 'elicit_user_input',
      args: {
        prompt: 'What city or neighborhood should I use?',
        fields: [{ id: 'location', label: 'City or neighborhood', required: true }],
      },
    }, {} as never)).resolves.toEqual({
      status: 'needs_user_input',
      requestId: 'elicitation-1',
      prompt: 'What city or neighborhood should I use?',
      fields: [{ id: 'location', label: 'City or neighborhood', required: true }],
    });
    await expect(webmcpTool.execute?.({
      tool: 'request_secret',
      args: {
        name: 'OPENWEATHER_API_KEY',
        reason: 'Weather API calls need authentication.',
      },
    }, {} as never)).resolves.toEqual({
      status: 'secret_ref_created',
      requestId: 'secret-1',
      name: 'OPENWEATHER_API_KEY',
      secretRef: 'secret-ref://local/api-key',
    });

    expect(getUserContextMemory).toHaveBeenCalledWith({ query: 'location', limit: 20 });
    expect(getBrowserLocation).toHaveBeenCalledTimes(1);
    expect(onElicitUserInput).toHaveBeenCalledWith({
      prompt: 'What city or neighborhood should I use?',
      fields: [{ id: 'location', label: 'City or neighborhood', required: true }],
      reason: undefined,
    });
    expect(onRequestSecret).toHaveBeenCalledWith({
      name: 'OPENWEATHER_API_KEY',
      prompt: 'Create a secret named OPENWEATHER_API_KEY.',
      reason: 'Weather API calls need authentication.',
    });
  });

  it('returns empty and unavailable results when app providers are absent', async () => {
    const modelContext = new ModelContext();
    (registerWorkspaceTools as (context: ModelContext, options: Record<string, unknown>) => void)(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({
      tool: 'recall_user_context',
      args: { query: 'location' },
    }, {} as never)).resolves.toEqual({ status: 'empty', query: 'location', memories: [] });
    await expect(webmcpTool.execute?.({
      tool: 'recall_user_context',
      args: {},
    }, {} as never)).resolves.toEqual({ status: 'empty', memories: [] });
    await expect(webmcpTool.execute?.({ tool: 'read_browser_location' }, {} as never)).resolves.toEqual({
      status: 'unavailable',
      reason: 'Browser location is not available in this workspace.',
    });
    await expect(webmcpTool.execute?.({ tool: 'elicit_user_input' }, {} as never)).resolves.toEqual({
      status: 'needs_user_input',
      requestId: expect.stringMatching(/^elicitation-[0-9a-z]+$/),
      prompt: 'Please provide the missing information before I continue.',
      fields: [{ id: 'location', label: 'City or neighborhood', required: true, placeholder: 'Chicago, IL' }],
    });
    await expect(webmcpTool.execute?.({
      tool: 'elicit_user_input',
      args: { fields: [null, 'bad', [], { id: '', label: 'Missing' }] },
    }, {} as never)).resolves.toEqual({
      status: 'needs_user_input',
      requestId: expect.stringMatching(/^elicitation-[0-9a-z]+$/),
      prompt: 'Please provide the missing information before I continue.',
      fields: [{ id: 'location', label: 'City or neighborhood', required: true, placeholder: 'Chicago, IL' }],
    });
    await expect(webmcpTool.execute?.({
      tool: 'request_secret',
      args: {},
    }, {} as never)).resolves.toEqual({
      status: 'needs_secret',
      requestId: expect.stringMatching(/^secret-[0-9a-z]+$/),
      name: 'API_KEY',
      prompt: 'Create a secret named API_KEY.',
    });
  });

  it('normalizes elicitation fields before sending them to the app callback', async () => {
    const modelContext = new ModelContext();
    const onElicitUserInput = vi.fn(async (request) => ({
      status: 'needs_user_input',
      requestId: 'elicitation-normalized',
      prompt: request.prompt,
      fields: request.fields,
    }));
    (registerWorkspaceTools as (context: ModelContext, options: Record<string, unknown>) => void)(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      onElicitUserInput,
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({
      tool: 'elicit_user_input',
      args: {
        prompt: 'Where should I search?',
        reason: 'Missing location',
        fields: [
          null,
          'bad',
          [],
          { id: '', label: 'Missing' },
          { id: 'location', label: 'Location', required: false, placeholder: '  ' },
          { id: 'postal', label: 'Postal code', required: true, placeholder: '60601' },
          { id: 'cuisine', label: 'Cuisine', placeholder: 'Any' },
          { id: 'notes', label: 'Notes', type: 'textarea', defaultValue: 'near transit' },
          {
            id: 'urgency',
            label: 'Urgency',
            type: 'select',
            required: true,
            defaultValue: 'soon',
            options: [
              { label: 'Soon', value: 'soon' },
              { label: 'Later', value: 'later' },
              { label: '', value: 'missing-label' },
              { label: 'Missing value', value: '' },
            ],
          },
          { id: 'notify', label: 'Notify me', type: 'checkbox', defaultValue: 'true' },
          { id: 'count', label: 'Result count', type: 'number', defaultValue: '3' },
          { id: 'fallback', label: 'Fallback', type: 'unsupported', defaultValue: 'defaulted' },
        ],
      },
    }, {} as never)).resolves.toEqual({
      status: 'needs_user_input',
      requestId: 'elicitation-normalized',
      prompt: 'Where should I search?',
      fields: [
        { id: 'location', label: 'Location', required: false },
        { id: 'postal', label: 'Postal code', required: true, placeholder: '60601' },
        { id: 'cuisine', label: 'Cuisine', placeholder: 'Any' },
        { id: 'notes', label: 'Notes', type: 'textarea', defaultValue: 'near transit' },
        {
          id: 'urgency',
          label: 'Urgency',
          type: 'select',
          required: true,
          defaultValue: 'soon',
          options: [
            { label: 'Soon', value: 'soon' },
            { label: 'Later', value: 'later' },
          ],
        },
        { id: 'notify', label: 'Notify me', type: 'checkbox', defaultValue: 'true' },
        { id: 'count', label: 'Result count', type: 'number', defaultValue: '3' },
        { id: 'fallback', label: 'Fallback', defaultValue: 'defaulted' },
      ],
    });

    expect(onElicitUserInput).toHaveBeenCalledWith({
      prompt: 'Where should I search?',
      reason: 'Missing location',
      fields: [
        { id: 'location', label: 'Location', required: false },
        { id: 'postal', label: 'Postal code', required: true, placeholder: '60601' },
        { id: 'cuisine', label: 'Cuisine', placeholder: 'Any' },
        { id: 'notes', label: 'Notes', type: 'textarea', defaultValue: 'near transit' },
        {
          id: 'urgency',
          label: 'Urgency',
          type: 'select',
          required: true,
          defaultValue: 'soon',
          options: [
            { label: 'Soon', value: 'soon' },
            { label: 'Later', value: 'later' },
          ],
        },
        { id: 'notify', label: 'Notify me', type: 'checkbox', defaultValue: 'true' },
        { id: 'count', label: 'Result count', type: 'number', defaultValue: '3' },
        { id: 'fallback', label: 'Fallback', defaultValue: 'defaulted' },
      ],
    });
  });
});
