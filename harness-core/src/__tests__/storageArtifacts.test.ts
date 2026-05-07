import { describe, expect, it } from 'vitest';
import {
  ArtifactRegistry,
  InMemoryHarnessStorage,
  createHarnessStorageAdapter,
  createAgentRuntime,
  createHarnessExtensionContext,
  type ArtifactBody,
  type HarnessStorageEntry,
  type HarnessStorageProvider,
  type RemoteArtifactHandler,
} from '../index.js';

describe('harness storage and artifacts', () => {
  it('stores and lists typed values through the in-memory harness storage adapter', async () => {
    const storage = new InMemoryHarnessStorage({
      now: () => '2026-05-01T00:00:00.000Z',
    });

    const saved = await storage.set('config/theme', { mode: 'dark' }, {
      metadata: { scope: 'ui' },
    });
    await storage.set('artifacts/draft', 'draft body');

    await expect(storage.get<{ mode: string }>('config/theme')).resolves.toEqual(saved);
    await expect(storage.get('missing')).resolves.toBeUndefined();
    await expect(storage.list()).resolves.toHaveLength(2);
    await expect(storage.list({ prefix: 'config/' })).resolves.toEqual([saved]);
    await expect(storage.delete('config/theme')).resolves.toBe(true);
    await expect(storage.delete('config/theme')).resolves.toBe(false);
  });

  it('returns defensive storage snapshots for values and nested metadata', async () => {
    const storage = new InMemoryHarnessStorage({
      now: () => '2026-05-01T00:00:00.000Z',
    });

    const value = {
      preferences: { mode: 'dark' },
    };
    const metadata = { tags: ['ui'] };
    const saved = await storage.set('config/theme', value, { metadata });

    value.preferences.mode = 'original';
    metadata.tags.push('original');
    saved.value.preferences.mode = 'light';
    (saved.metadata.tags as string[]).push('mutated');

    const firstRead = await storage.get<{ preferences: { mode: string } }>('config/theme');
    expect(firstRead?.value.preferences.mode).toBe('dark');
    expect(firstRead?.metadata.tags).toEqual(['ui']);

    firstRead!.value.preferences.mode = 'contrast';
    (firstRead!.metadata.tags as string[]).push('read');

    const listed = await storage.list<{ preferences: { mode: string } }>({ prefix: 'config/' });
    listed[0].value.preferences.mode = 'listed';
    (listed[0].metadata.tags as string[]).push('list');

    await expect(storage.get('config/theme')).resolves.toMatchObject({
      value: { preferences: { mode: 'dark' } },
      metadata: { tags: ['ui'] },
    });

    const backing = new Map<string, HarnessStorageEntry<unknown>>();
    backing.set('remote/theme', {
      key: 'remote/theme',
      value: { preferences: { mode: 'dark' } },
      metadata: { tags: ['remote'] },
      updatedAt: 'host-now',
    });
    const adapter = createHarnessStorageAdapter({
      get: (key) => backing.get(key),
      set: () => undefined,
      list: () => [...backing.values()],
    });

    const adapted = await adapter.get<{ preferences: { mode: string } }>('remote/theme');
    adapted!.value.preferences.mode = 'adapted';
    (adapted!.metadata.tags as string[]).push('adapted');

    expect(backing.get('remote/theme')).toMatchObject({
      value: { preferences: { mode: 'dark' } },
      metadata: { tags: ['remote'] },
    });

    const callback = () => 'runtime handle';
    const callbackEntry = await storage.set('runtime/callback', callback);
    expect(callbackEntry.value).toBe(callback);
    await expect(storage.get('runtime/callback')).resolves.toMatchObject({
      value: callback,
    });
  });

  it('wraps host storage callbacks with a harness storage adapter', async () => {
    const backing = new Map<string, HarnessStorageEntry<unknown>>();
    const adapter = createHarnessStorageAdapter({
      now: () => '2026-05-01T00:00:00.000Z',
      get: (key) => backing.get(key),
      set: (key, value, options) => {
        backing.set(key, {
          key,
          value,
          metadata: { ...(options?.metadata ?? {}) },
          updatedAt: options?.updatedAt ?? 'host-now',
        });
      },
      list: ({ prefix } = {}) => [...backing.values()]
        .filter((entry) => prefix === undefined || entry.key.startsWith(prefix)),
    });

    const saved = await adapter.set('remote/one', { ok: true }, {
      metadata: { source: 'host' },
    });
    await adapter.set('local/two', 'ignored');

    expect(saved).toEqual({
      key: 'remote/one',
      value: { ok: true },
      metadata: { source: 'host' },
      updatedAt: '2026-05-01T00:00:00.000Z',
    });
    await expect(adapter.get('remote/one')).resolves.toEqual(backing.get('remote/one'));
    await expect(adapter.get('missing')).resolves.toBeUndefined();
    await expect(adapter.list({ prefix: 'remote/' })).resolves.toEqual([backing.get('remote/one')]);
    await expect(adapter.set('remote/dated', 'value', { updatedAt: 'explicit-date' })).resolves.toMatchObject({
      updatedAt: 'explicit-date',
    });
    await expect(adapter.delete('remote/one')).resolves.toBe(false);

    const deletingAdapter = createHarnessStorageAdapter({
      get: (key) => backing.get(key),
      set: (key, value, options) => {
        const entry = {
          key,
          value,
          metadata: { ...(options?.metadata ?? {}) },
          updatedAt: options?.updatedAt ?? 'host-set',
        };
        backing.set(key, entry);
        return entry;
      },
      delete: (key) => backing.delete(key),
    });
    await deletingAdapter.set('delete/me', 'value');
    await expect(deletingAdapter.delete('delete/me')).resolves.toBe(true);
    await expect(deletingAdapter.list()).resolves.toEqual([]);

    const defaultClockAdapter = createHarnessStorageAdapter({
      get: () => undefined,
      set: () => undefined,
    });
    const defaultClockEntry = await defaultClockAdapter.set('clock/default', 'value');
    expect(defaultClockEntry.updatedAt).toEqual(expect.any(String));
  });

  it('keeps stored artifacts as persistent refs backed by harness storage', async () => {
    const storage = new InMemoryHarnessStorage();
    const artifacts = new ArtifactRegistry({
      idFactory: () => 'draft',
      now: () => '2026-05-01T00:00:00.000Z',
      storage,
    });

    const created = await artifacts.create({
      title: 'Plan',
      data: '# Draft',
      mediaType: 'text/markdown',
      metadata: { owner: 'agent' },
    });
    const explicit = await artifacts.create({
      id: 'explicit',
      storageKey: 'custom/artifact',
      data: new Uint8Array([1, 2, 3]),
    });

    expect(created).toEqual({
      id: 'draft',
      title: 'Plan',
      mediaType: 'text/markdown',
      metadata: { owner: 'agent' },
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      location: { kind: 'storage', storageKey: 'artifacts/draft' },
    });
    await expect(storage.get('artifacts/draft')).resolves.toMatchObject({
      value: {
        data: '# Draft',
        mediaType: 'text/markdown',
        metadata: { owner: 'agent' },
      },
      metadata: { artifactId: 'draft', artifactKind: 'stored' },
    });
    expect(explicit.location).toEqual({ kind: 'storage', storageKey: 'custom/artifact' });

    await artifacts.write('draft', {
      data: '# Final',
      mediaType: 'text/markdown',
      metadata: { stage: 'final' },
    });

    await expect(artifacts.read(created)).resolves.toEqual({
      artifact: {
        ...created,
        metadata: { owner: 'agent', stage: 'final' },
      },
      data: '# Final',
      mediaType: 'text/markdown',
      metadata: { stage: 'final' },
    });
    expect(artifacts.list().map((artifact) => artifact.id)).toEqual(['draft', 'explicit']);

    const mutableCopy = artifacts.get('draft');
    mutableCopy!.metadata.owner = 'changed';
    expect(artifacts.get('draft')?.metadata.owner).toBe('agent');
    expect(artifacts.get('missing')).toBeUndefined();
    await storage.delete('custom/artifact');
    await expect(artifacts.read('explicit')).resolves.toBeUndefined();
    await expect(artifacts.read('missing')).rejects.toThrow(/Unknown artifact/);

    const defaultArtifacts = new ArtifactRegistry({
      now: () => '2026-05-01T00:00:00.000Z',
    });
    await expect(defaultArtifacts.create({ data: 'auto id' })).resolves.toMatchObject({
      id: 'artifact-1',
      location: { kind: 'storage', storageKey: 'artifacts/artifact-1' },
    });
  });

  it('registers remote artifacts without copying data into harness storage', async () => {
    const writes: ArtifactBody[] = [];
    const figmaHandler: RemoteArtifactHandler = {
      read: (artifact) => ({
        data: `remote:${artifact.id}`,
        mediaType: 'application/json',
        metadata: { source: artifact.location.kind },
      }),
      write: (_artifact, body) => {
        writes.push(body);
      },
    };
    const defaultHandler: RemoteArtifactHandler = {
      read: () => ({
        data: 'default remote',
        metadata: {},
      }),
    };
    const storage = new InMemoryHarnessStorage();
    const artifacts = new ArtifactRegistry({
      idFactory: () => 'default-remote',
      now: () => '2026-05-01T00:00:00.000Z',
      remoteHandlers: {
        default: defaultHandler,
        figma: figmaHandler,
      },
      storage,
    });

    const remote = artifacts.registerRemote({
      id: 'design',
      title: 'Design file',
      uri: 'https://figma.example/file/abc',
      provider: 'figma',
      mediaType: 'application/json',
      metadata: { team: 'design' },
    });
    const defaultRemote = artifacts.registerRemote({ uri: 'remote://default' });
    const orphan = artifacts.registerRemote({
      id: 'orphan',
      uri: 'remote://orphan',
      provider: 'missing-provider',
    });

    await expect(storage.list()).resolves.toEqual([]);
    await expect(artifacts.read(remote)).resolves.toEqual({
      artifact: remote,
      data: 'remote:design',
      mediaType: 'application/json',
      metadata: { source: 'remote' },
    });
    await expect(artifacts.read(defaultRemote)).resolves.toMatchObject({
      data: 'default remote',
    });
    await expect(artifacts.read(orphan)).resolves.toBeUndefined();

    await artifacts.write('design', {
      data: '{"ok":true}',
      mediaType: 'application/json',
      metadata: { revision: 2 },
    });
    expect(writes).toEqual([{
      data: '{"ok":true}',
      mediaType: 'application/json',
      metadata: { revision: 2 },
    }]);
    expect(artifacts.get('design')?.metadata).toEqual({ team: 'design', revision: 2 });
    await expect(artifacts.write(orphan, { data: 'no handler' })).rejects.toThrow(/Remote artifact is not writable/);
  });

  it('shares storage-backed artifacts through agent and subagent contexts', async () => {
    const runtime = createAgentRuntime<string, string>({
      agent: {
        id: 'writer',
        instructions: 'Write and revise artifacts.',
        async run(input, context) {
          const artifact = await context.artifacts.create({
            id: 'story',
            data: input,
            mediaType: 'text/plain',
          });
          await context.storage.set('notes/owner', { agentId: context.agentId });

          return context.runSubagent<string, string>({
            id: 'editor',
            instructions: 'Revise artifacts.',
            async run(_childInput, childContext) {
              const before = await childContext.artifacts.read(artifact.id);
              await childContext.artifacts.write(artifact.id, {
                data: `${String(before?.data)}:edited`,
                mediaType: before?.mediaType,
              });
              const owner = await childContext.storage.get<{ agentId: string }>('notes/owner');
              const after = await childContext.artifacts.read(artifact.id);
              return `${String(after?.data)}:${owner?.value.agentId}:${childContext.parentActorId}`;
            },
          }, 'revise');
        },
      },
    });

    await expect(runtime.run('draft')).resolves.toBe('draft:edited:writer:writer');

    const customStorage = new InMemoryHarnessStorage();
    const customArtifacts = new ArtifactRegistry({ storage: customStorage });
    const customRuntime = createAgentRuntime<string, string>({
      storage: customStorage,
      artifacts: customArtifacts,
      agent: {
        id: 'custom',
        instructions: 'Use supplied components.',
        run: (_input, context) => String(
          context.storage === customStorage
          && context.artifacts === customArtifacts,
        ),
      },
    });
    await expect(customRuntime.run('check')).resolves.toBe('true');

    const artifactsOnly = new ArtifactRegistry();
    const artifactsOnlyRuntime = createAgentRuntime<string, string>({
      artifacts: artifactsOnly,
      agent: {
        id: 'artifacts-only',
        instructions: 'Use artifact storage.',
        run: (_input, context) => String(context.storage === artifactsOnly.storage),
      },
    });
    await expect(artifactsOnlyRuntime.run('check')).resolves.toBe('true');
  });

  it('accepts storage providers wherever harness storage is configured', async () => {
    const adapterStorage = createHarnessStorageAdapter({
      get: () => undefined,
      set: (key, value, options) => ({
        key,
        value,
        metadata: { ...(options?.metadata ?? {}) },
        updatedAt: options?.updatedAt ?? 'provider-set',
      }),
      delete: () => true,
      list: () => [],
    });
    const provider: HarnessStorageProvider = {
      getStorage: () => adapterStorage,
    };
    const artifacts = new ArtifactRegistry({
      storage: provider,
      now: () => '2026-05-01T00:00:00.000Z',
    });
    const runtime = createAgentRuntime<string, string>({
      storage: () => adapterStorage,
      agent: {
        id: 'provider-agent',
        instructions: 'Use provider-backed storage.',
        run: async (_input, context) => {
          const artifact = await context.artifacts.create({ data: 'from runtime' });
          return String(
            context.storage === adapterStorage
            && context.artifacts.storage === adapterStorage
            && artifact.location.kind === 'storage',
          );
        },
      },
    });

    expect(artifacts.storage).toBe(adapterStorage);
    await expect(runtime.run('check')).resolves.toBe('true');

    const extensionArtifacts = new ArtifactRegistry({ storage: adapterStorage });
    const extensionContext = createHarnessExtensionContext({
      artifacts: extensionArtifacts,
    });
    const providerExtensionContext = createHarnessExtensionContext({
      storage: provider,
    });

    expect(extensionContext.storage).toBe(adapterStorage);
    expect(extensionContext.artifacts).toBe(extensionArtifacts);
    expect(providerExtensionContext.storage).toBe(adapterStorage);
    expect(providerExtensionContext.artifacts.storage).toBe(adapterStorage);
  });
});
