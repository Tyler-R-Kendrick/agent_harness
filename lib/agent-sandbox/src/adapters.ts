import type { SkillSandbox } from './types';

export class DeepAgentsBrowserSandboxAdapter {
  constructor(private readonly sandbox: SkillSandbox) {}

  execute(command: string) {
    return this.sandbox.execute(command);
  }

  uploadFiles(files: Array<[string, Uint8Array]>) {
    return this.sandbox.uploadFiles(files);
  }

  downloadFiles(paths: string[]) {
    return this.sandbox.downloadFiles(paths);
  }
}
