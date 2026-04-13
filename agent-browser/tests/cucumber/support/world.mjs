import { World, setWorldConstructor } from '@cucumber/cucumber';

class AgentBrowserWorld extends World {
  constructor(options) {
    super(options);
    this.baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
    this.context = null;
    this.page = null;
    this.runtimeErrors = [];
    this.currentWorkspace = 'Research';
    this.lastModelName = null;
    this.lastModelId = null;
    this.lastFilePath = null;
    this.lastTerminalSession = null;
  }
}

setWorldConstructor(AgentBrowserWorld);