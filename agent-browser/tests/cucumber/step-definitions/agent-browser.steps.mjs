import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import {
  addWorkspaceCapability,
  basename,
  escapeRegExp,
  ensureSecondTerminalSession,
  ensureTerminalMode,
  ensureWorkspaceFile,
  expectWorkspaceTree,
  getRegistryRequests,
  installModelFromSettings,
  modelFixtureByName,
  modelIdByName,
  openBrowserTab,
  openPanel,
  openTerminalSession,
  openWorkspaceSwitcher,
  runTerminalCommand,
  setRegistryEntries,
  switchWorkspace,
  urlForTabName,
} from '../support/helpers.mjs';

async function ensureModelInstalled(world, modelName) {
  const model = modelFixtureByName(modelName);
  await setRegistryEntries(world.page, [model]);
  await openPanel(world.page, 'Settings');
  await installModelFromSettings(world.page, modelName);
  await expect(world.page.getByText('Installed').first()).toBeVisible({ timeout: 8000 });
  world.lastModelName = modelName;
  world.lastModelId = model.id;
}

async function switchWorkspaceByShortcut(world, workspaceName) {
  const shortcutMap = {
    Research: '1',
    Build: '2',
    'Workspace 3': '3',
    Ops: '3',
  };
  const indexKey = shortcutMap[workspaceName];
  if (!indexKey) {
    await switchWorkspace(world.page, workspaceName);
  } else {
    await world.page.evaluate((key) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true }));
    }, indexKey);
    await expect(world.page.getByLabel('Toggle workspace overlay')).toContainText(workspaceName);
    await expectWorkspaceTree(world.page, workspaceName);
  }
  world.currentWorkspace = workspaceName;
}

Given('the agent browser is open', async function() {
  await this.page.goto(this.baseUrl);
  await expect(this.page.getByLabel('Omnibar')).toBeVisible();
});

Given('the active workspace is {string}', async function(workspaceName) {
  await switchWorkspace(this.page, workspaceName);
  this.currentWorkspace = workspaceName;
});

Given('the workspaces {string} and {string} both exist', async function(firstName, secondName) {
  await openWorkspaceSwitcher(this.page);
  const dialog = this.page.getByRole('dialog', { name: 'Workspace switcher' });
  await expect(dialog).toContainText(firstName);
  await expect(dialog).toContainText(secondName);
  await dialog.getByLabel('Close workspace switcher').click();
});

Given('{string} is a separate workspace', async function(workspaceName) {
  await openWorkspaceSwitcher(this.page);
  const dialog = this.page.getByRole('dialog', { name: 'Workspace switcher' });
  await expect(dialog).toContainText(workspaceName);
  await dialog.getByLabel('Close workspace switcher').click();
});

Given('the local model registry returns the {string} model as browser-runnable and ONNX-backed', async function(modelName) {
  const model = modelFixtureByName(modelName);
  await setRegistryEntries(this.page, [model]);
  this.lastModelName = modelName;
  this.lastModelId = model.id;
});

Given('the {string} model is installed for local inference', async function(modelName) {
  await ensureModelInstalled(this, modelName);
});

Given('Terminal mode is open for the active workspace', async function() {
  await ensureTerminalMode(this.page);
});

Given('the active workspace has a second terminal session named {string}', async function(sessionName) {
  await ensureSecondTerminalSession(this.page, this.currentWorkspace, sessionName);
  this.lastTerminalSession = sessionName;
});

Given('Terminal mode is open for {string}', async function(sessionName) {
  await openTerminalSession(this.page, sessionName);
  this.lastTerminalSession = sessionName;
});

Given('{string} has capability files attached to it', async function(workspaceName) {
  await switchWorkspace(this.page, workspaceName);
  this.currentWorkspace = workspaceName;
  await addWorkspaceCapability(this.page, workspaceName, 'AGENTS.md');
  const editor = this.page.getByRole('region', { name: 'File editor' });
  await expect(editor).toBeVisible();
  await expect(editor.locator('.file-editor-path-text')).toHaveText('AGENTS.md');
});

Given('the {string} workspace has the {string} tab open as a page overlay', async function(workspaceName, tabName) {
  await switchWorkspace(this.page, workspaceName);
  this.currentWorkspace = workspaceName;
  await openBrowserTab(this.page, tabName);
  await expect(this.page.getByRole('region', { name: 'Page overlay' })).toBeVisible();
});

Given('the active workspace contains the file {string}', async function(filePath) {
  await ensureWorkspaceFile(this.page, this.currentWorkspace, filePath);
  this.lastFilePath = filePath;
  const closeButton = this.page.getByLabel('Close file editor');
  if (await closeButton.count()) {
    await closeButton.click({ force: true });
  }
});

When('the user opens {string}', async function(panelName) {
  await openPanel(this.page, panelName);
});

When('the user enables the {string} task filter', async function(filterName) {
  const requestsBefore = (await getRegistryRequests(this.page)).length;
  await this.page.getByRole('button', { name: filterName }).click();
  await expect.poll(async () => (await getRegistryRequests(this.page)).length, { timeout: 5000 }).toBeGreaterThan(requestsBefore);
});

When('the user loads the {string} model card', async function(modelName) {
  await installModelFromSettings(this.page, modelName);
  this.lastModelName = modelName;
  this.lastModelId = modelIdByName(modelName);
});

When('the user returns to the chat panel', async function() {
  await openPanel(this.page, 'Workspaces');
  await expect(this.page.getByLabel('Chat input')).toBeVisible();
});

When('the user selects {string} from the installed model picker', async function(modelName) {
  await this.page.getByLabel('Installed model').selectOption({ label: modelName });
});

When('the user sends {string}', async function(message) {
  await this.page.getByLabel('Chat input').fill(message);
  await this.page.getByRole('button', { name: 'Send' }).click();
});

When('the user selects {string} from the panel tabs', async function(tabLabel) {
  if (tabLabel === 'Terminal mode') {
    await ensureTerminalMode(this.page);
    return;
  }
  await this.page.getByRole('tab', { name: tabLabel }).click({ force: true });
});

When('the user runs {string}', async function(command) {
  await runTerminalCommand(this.page, command);
});

When('the user adds an {string} file from the workspace tree', async function(fileName) {
  await addWorkspaceCapability(this.page, this.currentWorkspace, fileName);
  this.lastFilePath = fileName;
});

When('the user adds a skill named {string}', async function(skillName) {
  await addWorkspaceCapability(this.page, this.currentWorkspace, 'Skill', skillName);
  this.lastFilePath = `.agents/skills/${skillName}/SKILL.md`;
});

When('the user creates {string} from {string}', async function(fileName, sessionName) {
  await ensureWorkspaceFile(this.page, this.currentWorkspace, 'AGENTS.md');
  await openTerminalSession(this.page, sessionName);
  await runTerminalCommand(this.page, `touch ${fileName}`);
  this.lastTerminalSession = sessionName;
});

When('the user switches from {string} to {string}', async function(_fromWorkspace, toWorkspace) {
  await switchWorkspace(this.page, toWorkspace);
  this.currentWorkspace = toWorkspace;
});

When('the user switches to the {string} workspace', async function(workspaceName) {
  await switchWorkspaceByShortcut(this, workspaceName);
});

When('the user opens the workspace switcher from the workspace pill toggle', async function() {
  await openWorkspaceSwitcher(this.page);
});

When('the user selects the {string} workspace', async function(workspaceName) {
  const dialog = this.page.getByRole('dialog', { name: 'Workspace switcher' });
  await dialog.locator('.workspace-card-button').filter({ hasText: workspaceName }).first().click();
  this.currentWorkspace = workspaceName;
});

When('the user presses {string}', async function(shortcut) {
  await this.page.keyboard.press(shortcut.replace(/Ctrl/g, 'Control'));
});

When('the user renames the active workspace to {string}', async function(workspaceName) {
  await this.page.getByLabel('Toggle workspace overlay').dispatchEvent('dblclick');
  await expect(this.page.getByRole('dialog', { name: 'Rename workspace' })).toBeVisible();
  await this.page.getByLabel('Workspace name').fill(workspaceName);
  await this.page.getByRole('button', { name: 'Save' }).click();
  this.currentWorkspace = workspaceName;
});

When('the user opens the {string} tab in {string}', async function(tabName, workspaceName) {
  await switchWorkspace(this.page, workspaceName);
  this.currentWorkspace = workspaceName;
  await openBrowserTab(this.page, tabName);
});

When('the user switches back to the {string} workspace', async function(workspaceName) {
  await switchWorkspaceByShortcut(this, workspaceName);
});

When('the user opens the {string} browser tab from the workspace tree', async function(tabName) {
  await openBrowserTab(this.page, tabName);
});

When('the user closes the page overlay', async function() {
  await this.page.getByLabel('Close page overlay').dispatchEvent('click');
});

When('the user opens that workspace file from the workspace tree', async function() {
  await this.page.getByRole('button', { name: basename(this.lastFilePath), exact: true }).click();
});

When('the user edits the file and saves it', async function() {
  const editor = this.page.getByLabel('Workspace file content');
  await editor.fill('# Updated by cucumber\necho "hello from cucumber"');
  await this.page.getByRole('button', { name: 'Save file' }).click({ force: true });
});

Then('the {string} field is visible', async function(fieldLabel) {
  await expect(this.page.getByLabel(fieldLabel)).toBeVisible();
});

Then('no model task filters are selected', async function() {
  await expect(this.page.locator('.chip.active')).toHaveCount(0);
});

Then('the registry request is limited to text-generation models', async function() {
  await expect.poll(async () => {
    const requests = await getRegistryRequests(this.page);
    return requests.some((requestUrl) => new URL(requestUrl).searchParams.get('pipeline_tag') === 'text-generation');
  }, { timeout: 5000 }).toBe(true);

  const requests = await getRegistryRequests(this.page);
  const matchingRequest = requests
    .map((requestUrl) => new URL(requestUrl))
    .find((requestUrl) => requestUrl.searchParams.get('pipeline_tag') === 'text-generation');
  expect(matchingRequest).toBeDefined();
  expect(matchingRequest.searchParams.get('library')).toBe('transformers.js');
  expect(matchingRequest.searchParams.get('tags')).toBe('onnx');
});

Then('the model card enters a loading state', async function() {
  const loadingButton = this.page.getByRole('button', {
    name: new RegExp(`${escapeRegExp(this.lastModelName ?? '')}.*Loading`, 'i'),
  });
  await expect(loadingButton).toBeDisabled();
});

Then('the model card eventually shows {string}', async function(label) {
  await expect(this.page.getByText(label).first()).toBeVisible({ timeout: 8000 });
});

Then('the request includes the active workspace context', async function() {
  await expect(this.page.getByRole('log')).toContainText('workspace=present');
});

Then('the assistant generates a response with the selected local model', async function() {
  await expect(this.page.getByRole('log')).toContainText(`model=${this.lastModelId}`);
});

Then('the {string} region is visible', async function(regionName) {
  if (regionName === 'Terminal') {
    await expect(this.page.getByLabel('Bash input')).toBeVisible();
    return;
  }
  await expect(this.page.getByRole('region', { name: regionName })).toBeVisible();
});

Then('the {string} field is focused', async function(fieldLabel) {
  await expect(this.page.getByLabel(fieldLabel)).toBeFocused();
});

Then('the terminal output welcomes the user to {string}', async function(text) {
  await expect(this.page.getByLabel('Terminal output')).toContainText(text);
});

Then('the terminal output shows {string}', async function(text) {
  await expect(this.page.getByLabel('Terminal output')).toContainText(text);
});

Then('the {string} field is focused again', async function(fieldLabel) {
  await expect(this.page.getByLabel(fieldLabel)).toBeFocused();
});

Then('the Files category shows a {string} node', async function(nodeName) {
  await expect(this.page.getByRole('button', { name: nodeName, exact: true })).toBeVisible();
});

Then('the terminal filesystem belongs only to the active workspace', async function() {
  const nodeName = `${this.lastTerminalSession} FS`;
  const otherWorkspace = this.currentWorkspace === 'Research' ? 'Build' : 'Research';
  await switchWorkspace(this.page, otherWorkspace);
  await expect(this.page.getByRole('button', { name: nodeName, exact: true })).toHaveCount(0);
  await switchWorkspace(this.page, this.currentWorkspace);
});

Then('the file editor opens with the path {string}', async function(filePath) {
  const editor = this.page.getByRole('region', { name: 'File editor' });
  await expect(editor).toBeVisible();
  await expect(editor.locator('.file-editor-path-text')).toHaveText(filePath);
});

Then('the active workspace file editor shows {string}', async function(filePath) {
  const editor = this.page.getByRole('region', { name: 'File editor' });
  await expect(editor).toBeVisible();
  await expect(editor.locator('.file-editor-path-text')).toHaveText(filePath);
});

Then('the Files category includes a {string} node', async function(nodeName) {
  await expect(this.page.getByRole('button', { name: nodeName, exact: true })).toBeVisible();
});

Then('the Files surface still includes persisted workspace capability files', async function() {
  await expect(this.page.getByRole('button', { name: 'AGENTS.md', exact: true })).toBeVisible();
});

Then('the workspace tree shows the {string} root and its Files category', async function(workspaceName) {
  await expectWorkspaceTree(this.page, workspaceName);
});

Then('the Files surface no longer shows the {string} capability files', async function(_workspaceName) {
  await expect(this.page.getByRole('button', { name: 'AGENTS.md', exact: true })).toHaveCount(0);
});

Then('the {string} dialog is visible', async function(dialogName) {
  await expect(this.page.getByRole('dialog', { name: dialogName })).toBeVisible();
});

Then('the workspace pill shows {string}', async function(workspaceName) {
  await expect(this.page.getByLabel('Toggle workspace overlay')).toContainText(workspaceName);
});

Then('the workspace tree updates to the {string} root', async function(workspaceName) {
  await expectWorkspaceTree(this.page, workspaceName);
});

Then('a new workspace named {string} becomes active', async function(workspaceName) {
  await expect(this.page.getByLabel('Toggle workspace overlay')).toContainText(workspaceName);
  this.currentWorkspace = workspaceName;
});

Then('the {string} page overlay is not visible', async function(_workspaceName) {
  await expect(this.page.getByRole('region', { name: 'Page overlay' })).toHaveCount(0);
});

Then('the {string} page overlay is restored', async function(tabName) {
  await expect(this.page.getByRole('region', { name: 'Page overlay' })).toBeVisible();
  await expect(this.page.getByLabel('Address')).toHaveValue(urlForTabName(tabName));
});

Then('the {string} surface is visible', async function(surfaceName) {
  await expect(this.page.getByRole('region', { name: surfaceName })).toBeVisible();
});

Then('the address field shows {string}', async function(url) {
  await expect(this.page.getByLabel('Address')).toHaveValue(url);
});

Then('the chat panel becomes visible again', async function() {
  await expect(this.page.getByRole('region', { name: 'Page overlay' })).toHaveCount(0);
});

Then('the file editor opens in the main content area', async function() {
  await expect(this.page.getByRole('region', { name: 'File editor' })).toBeVisible();
});

Then('the {string} field shows {string}', async function(fieldLabel, value) {
  if (fieldLabel === 'Workspace file path') {
    const editor = this.page.getByRole('region', { name: 'File editor' });
    await expect(editor).toBeVisible();
    await expect(editor.locator('.file-editor-path-text')).toHaveText(value);
    return;
  }
  await expect(this.page.getByLabel(fieldLabel)).toHaveValue(value);
});

Then('the file remains attached to the active workspace', async function() {
  await expect(this.page.getByRole('button', { name: basename(this.lastFilePath), exact: true })).toBeVisible();
});