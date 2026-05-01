import {
  type HarnessStorage,
  type HarnessStorageSource,
  resolveHarnessStorage,
} from './storage.js';

export type ArtifactData = string | Uint8Array;

export interface ArtifactBody {
  data: ArtifactData;
  mediaType?: string;
  metadata: Record<string, unknown>;
}

export type ArtifactBodyInput = Omit<ArtifactBody, 'metadata'> & {
  metadata?: Record<string, unknown>;
};

export interface StoredArtifactLocation {
  kind: 'storage';
  storageKey: string;
}

export interface RemoteArtifactLocation {
  kind: 'remote';
  uri: string;
  provider?: string;
}

export type ArtifactLocation = StoredArtifactLocation | RemoteArtifactLocation;

export interface Artifact {
  id: string;
  title?: string;
  mediaType?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  location: ArtifactLocation;
}

export interface StoredArtifactCreateOptions extends ArtifactBodyInput {
  id?: string;
  title?: string;
  storageKey?: string;
}

export interface RemoteArtifactCreateOptions {
  id?: string;
  title?: string;
  uri: string;
  provider?: string;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

export type ArtifactRef = string | Artifact;

export type ArtifactSnapshot = ArtifactBody & {
  artifact: Artifact;
};

export interface RemoteArtifactHandler {
  read: (artifact: Artifact) => Promise<ArtifactBody> | ArtifactBody;
  write?: (artifact: Artifact, body: ArtifactBody) => Promise<void> | void;
}

export interface ArtifactRegistryOptions {
  storage?: HarnessStorageSource;
  idFactory?: () => string;
  now?: () => string;
  remoteHandlers?: Record<string, RemoteArtifactHandler>;
}

const DEFAULT_REMOTE_ARTIFACT_PROVIDER = 'default';

export class ArtifactRegistry {
  public readonly storage: HarnessStorage;

  private readonly artifacts = new Map<string, Artifact>();
  private readonly idFactory: () => string;
  private readonly now: () => string;
  private readonly remoteHandlers = new Map<string, RemoteArtifactHandler>();
  private nextId = 1;

  constructor(options: ArtifactRegistryOptions = {}) {
    this.storage = resolveHarnessStorage(options.storage);
    this.now = options.now ?? systemTimestamp;
    this.idFactory = options.idFactory ?? (() => `artifact-${this.nextId++}`);
    for (const [provider, handler] of Object.entries(options.remoteHandlers ?? {})) {
      this.remoteHandlers.set(provider, handler);
    }
  }

  async create(options: StoredArtifactCreateOptions): Promise<Artifact> {
    const id = options.id ?? this.idFactory();
    const storageKey = options.storageKey ?? `artifacts/${id}`;
    const timestamp = this.now();
    const body = normalizeArtifactBody(options);
    const artifact: Artifact = {
      id,
      title: options.title,
      mediaType: body.mediaType,
      metadata: { ...body.metadata },
      createdAt: timestamp,
      updatedAt: timestamp,
      location: { kind: 'storage', storageKey },
    };

    await this.storage.set(storageKey, body, {
      metadata: storageMetadataFor(id),
      updatedAt: timestamp,
    });
    this.artifacts.set(id, artifact);
    return cloneArtifact(artifact);
  }

  registerRemote(options: RemoteArtifactCreateOptions): Artifact {
    const id = options.id ?? this.idFactory();
    const timestamp = this.now();
    const artifact: Artifact = {
      id,
      title: options.title,
      mediaType: options.mediaType,
      metadata: { ...(options.metadata ?? {}) },
      createdAt: timestamp,
      updatedAt: timestamp,
      location: {
        kind: 'remote',
        uri: options.uri,
        provider: options.provider,
      },
    };
    this.artifacts.set(id, artifact);
    return cloneArtifact(artifact);
  }

  get(id: string): Artifact | undefined {
    const artifact = this.artifacts.get(id);
    return artifact === undefined ? undefined : cloneArtifact(artifact);
  }

  list(): Artifact[] {
    return [...this.artifacts.values()].map(cloneArtifact);
  }

  async read(ref: ArtifactRef): Promise<ArtifactSnapshot | undefined> {
    const artifact = this.resolve(ref);
    if (artifact.location.kind === 'storage') {
      const entry = await this.storage.get<ArtifactBody>(artifact.location.storageKey);
      return entry === undefined
        ? undefined
        : { artifact: cloneArtifact(artifact), ...normalizeArtifactBody(entry.value) };
    }

    const handler = this.remoteHandlerFor(artifact.location);
    return handler === undefined
      ? undefined
      : { artifact: cloneArtifact(artifact), ...normalizeArtifactBody(await handler.read(cloneArtifact(artifact))) };
  }

  async write(ref: ArtifactRef, bodyInput: ArtifactBodyInput): Promise<Artifact> {
    const artifact = this.resolve(ref);
    const body = normalizeArtifactBody(bodyInput);
    const updatedAt = this.now();
    const updated = withUpdatedBody(artifact, body, updatedAt);

    if (artifact.location.kind === 'storage') {
      await this.storage.set(artifact.location.storageKey, body, {
        metadata: storageMetadataFor(artifact.id),
        updatedAt,
      });
      this.artifacts.set(updated.id, updated);
      return cloneArtifact(updated);
    }

    const handler = this.remoteHandlerFor(artifact.location);
    if (handler?.write === undefined) {
      throw new Error(`Remote artifact is not writable: ${artifact.id}`);
    }
    await handler.write(cloneArtifact(artifact), body);
    this.artifacts.set(updated.id, updated);
    return cloneArtifact(updated);
  }

  private resolve(ref: ArtifactRef): Artifact {
    const id = typeof ref === 'string' ? ref : ref.id;
    const artifact = this.artifacts.get(id);
    if (artifact === undefined) throw new Error(`Unknown artifact: ${id}`);
    return artifact;
  }

  private remoteHandlerFor(location: RemoteArtifactLocation): RemoteArtifactHandler | undefined {
    return this.remoteHandlers.get(location.provider ?? DEFAULT_REMOTE_ARTIFACT_PROVIDER);
  }
}

function normalizeArtifactBody(body: ArtifactBodyInput): ArtifactBody {
  return {
    data: body.data,
    mediaType: body.mediaType,
    metadata: { ...(body.metadata ?? {}) },
  };
}

function withUpdatedBody(artifact: Artifact, body: ArtifactBody, updatedAt: string): Artifact {
  return {
    ...artifact,
    mediaType: body.mediaType,
    metadata: { ...artifact.metadata, ...body.metadata },
    updatedAt,
  };
}

function cloneArtifact(artifact: Artifact): Artifact {
  return {
    ...artifact,
    metadata: { ...artifact.metadata },
    location: { ...artifact.location },
  };
}

function storageMetadataFor(artifactId: string): Record<string, unknown> {
  return {
    artifactId,
    artifactKind: 'stored',
  };
}

function systemTimestamp(): string {
  return new Date().toISOString();
}
