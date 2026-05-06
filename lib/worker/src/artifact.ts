export interface Artifact {
  id: string;
  type: string;
  name?: string;
  mediaType?: string;
  uri?: string;
  content?: Uint8Array;
  metadata?: Record<string, unknown>;
}

export interface Diagnostic {
  severity: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  source?: string;
  location?: {
    path?: string;
    line?: number;
    column?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}

export interface ArtifactStore {
  put(artifact: Artifact): Promise<void>;
  get(id: string): Promise<Artifact | undefined>;
  list(): Promise<Artifact[]>;
  delete(id: string): Promise<void>;
}

export class InMemoryArtifactStore implements ArtifactStore {
  private readonly artifacts = new Map<string, Artifact>();

  async put(artifact: Artifact): Promise<void> {
    this.artifacts.set(artifact.id, cloneArtifact(artifact));
  }

  async get(id: string): Promise<Artifact | undefined> {
    const artifact = this.artifacts.get(id);
    return artifact ? cloneArtifact(artifact) : undefined;
  }

  async list(): Promise<Artifact[]> {
    return [...this.artifacts.values()].map(cloneArtifact);
  }

  async delete(id: string): Promise<void> {
    this.artifacts.delete(id);
  }
}

function cloneArtifact(artifact: Artifact): Artifact {
  return {
    ...artifact,
    content: artifact.content ? new Uint8Array(artifact.content) : undefined,
    metadata: artifact.metadata ? { ...artifact.metadata } : undefined,
  };
}
