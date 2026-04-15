const vscode = require('vscode');
const {
  DEFAULT_LOCALHOST_URL,
  openInSimpleBrowser,
  resolveTargetUrl,
  waitForServer,
} = require('./logic');

let startupOpenTriggered = false;

function getWorkspaceRoot() {
  const [workspaceFolder] = vscode.workspace.workspaceFolders || [];
  return workspaceFolder?.uri.fsPath;
}

async function openAgentBrowserPreview({ force = false } = {}) {
  if (startupOpenTriggered && !force) {
    return;
  }

  const workspaceRoot = getWorkspaceRoot();

  if (!workspaceRoot) {
    return;
  }

  startupOpenTriggered = true;

  const serverReady = await waitForServer({
    url: DEFAULT_LOCALHOST_URL,
  });

  if (!serverReady) {
    void vscode.window.showWarningMessage('Agent Browser preview was not opened because the dev server on port 5173 never became ready.');
    return;
  }

  try {
    const targetUrl = await resolveTargetUrl({ workspaceRoot });
    await openInSimpleBrowser(targetUrl, vscode.commands.executeCommand);
  } catch (error) {
    startupOpenTriggered = false;
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showWarningMessage(`Agent Browser preview could not be opened automatically: ${message}`);
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentHarness.openAgentBrowserPreview', async () => {
      startupOpenTriggered = false;
      await openAgentBrowserPreview({ force: true });
    }),
  );

  void openAgentBrowserPreview();
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};