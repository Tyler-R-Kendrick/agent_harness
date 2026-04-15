export class WebContainer {
  static async boot(): Promise<never> {
    throw new Error('WebContainer runtime is disabled unless VITE_ALLOW_SANDBOX_SAME_ORIGIN=true is enabled for a separately reviewed deployment.');
  }
}
