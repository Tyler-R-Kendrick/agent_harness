import type { Sandbox } from './sandbox';

export class DeepAgentsSandboxAdapter {
  constructor(private readonly sandbox: Sandbox) {}

  async execute(command: string) {
    return this.sandbox.execute({ command });
  }

  async uploadFiles(files: Array<[string, Uint8Array]>) {
    if (!this.sandbox.uploadFiles) {
      throw new Error('Sandbox does not support file upload');
    }

    return this.sandbox.uploadFiles({
      files: files.map(([path, content]) => ({ path, content })),
    });
  }

  async downloadFiles(paths: string[]) {
    if (!this.sandbox.downloadFiles) {
      throw new Error('Sandbox does not support file download');
    }

    return this.sandbox.downloadFiles({ paths });
  }
}
