export const CONTEXT_MANAGER_AGENT_ID = 'context-manager';
export const CONTEXT_MANAGER_LABEL = 'Context Manager';
export const CONTEXT_MANAGER_CACHE_ROOT = '.agent-browser/context-cache';

type ContextManagerToolDescriptor = {
  id: string;
  label: string;
  description: string;
};

export function isContextManagerTaskText(text: string): boolean {
  return /\b(context manager|context-management|context management|token usage|token budget|compact(?:ion|ed)?|summari[sz]e .*context|chat context|caveman mode|tool[- ]output cache|large tool output)\b/i.test(text)
    || /\b(context|transcript|conversation)\b.*\b(compact|summari[sz]e|token|budget|retain|originals?)\b/i.test(text)
    || /\b(tool output|logs?|trace payload)\b.*\b(cache|file|memory|large|prompt)\b/i.test(text);
}

export function buildContextManagerOperatingInstructions(): string {
  return [
    '# Context Manager',
    '',
    '## Purpose',
    '- Continuously monitor token usage for the active browser-agent session.',
    '- Keep model input compact by replacing older resolved chapters with durable summaries.',
    '- Preserve original messages, source trace refs, browser evidence refs, validation refs, and tool-output cache refs so summaries never erase provenance.',
    '',
    '## Runtime Posture',
    '- Treat original messages as the source of truth. Summaries are read paths for the model and compact transcript views for humans.',
    '- Keep recent unresolved user and assistant turns visible as originals so active work remains inspectable.',
    '- Store large tool output behind cache refs: memory first for moderate output, file refs under `.agent-browser/context-cache` for very large output.',
    '- caveman mode is a terse compression style, not permission to drop IDs, evidence handles, validation handles, or task-critical facts.',
    '',
    '## Workflow',
    '1. Estimate original and managed token use before deciding whether compaction is needed.',
    '2. Collapse only older resolved chapters; retain the latest active work as original messages.',
    '3. Summarize intent, result, blockers, source refs, evidence refs, validation refs, and tool-output cache refs.',
    '4. Surface a visible summary with a path to inspect original messages.',
    '5. Warn when managed context approaches the available model input budget.',
  ].join('\n');
}

export function buildContextManagerSystemPrompt({
  workspaceName,
  modelId,
}: {
  workspaceName?: string;
  modelId?: string;
}): string {
  return [
    '# Agent Browser Context Manager',
    `Workspace: ${workspaceName?.trim() || 'current workspace'}`,
    modelId ? `Model: ${modelId}` : 'Model: selected runtime model',
    '',
    'Goal: monitor, compact, and preserve browser-agent chat context without losing original-message provenance.',
    '',
    'Constraints:',
    '- Never discard original messages; only change model read paths and compact transcript rendering.',
    '- Keep source trace refs, evidence refs, validation refs, and tool-output cache refs exact.',
    '- Use terse caveman-mode wording only when the context policy requests it.',
    '## Context Manager Operating Instructions',
    buildContextManagerOperatingInstructions(),
  ].join('\n\n');
}

export function buildContextManagerToolInstructions({
  workspaceName,
  workspacePromptContext,
  descriptors,
  selectedToolIds,
  selectedGroups,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  descriptors: readonly ContextManagerToolDescriptor[];
  selectedToolIds?: readonly string[];
  selectedGroups?: readonly string[];
}): string {
  return [
    buildContextManagerSystemPrompt({ workspaceName }),
    [
      '## Context Manager Artifacts',
      `- Tool-output cache root: \`${CONTEXT_MANAGER_CACHE_ROOT}\``,
      '- Context summaries are read paths; original messages remain persisted in the chat session.',
    ].join('\n'),
    '## Workspace Context',
    workspacePromptContext || 'No workspace context provided.',
    '## Available Tools',
    formatToolDescriptors(descriptors, selectedToolIds, selectedGroups),
  ].join('\n\n');
}

function formatToolDescriptors(
  descriptors: readonly ContextManagerToolDescriptor[],
  selectedToolIds: readonly string[] | undefined,
  selectedGroups: readonly string[] | undefined,
): string {
  const selected = new Set(selectedToolIds ?? []);
  const toolLines = descriptors.length
    ? descriptors.map((descriptor) => {
      const active = selected.size === 0 || selected.has(descriptor.id) ? 'selected' : 'available';
      return `- ${descriptor.id} [${active}]: ${descriptor.label} - ${descriptor.description}`;
    })
    : ['- No tools selected.'];
  const groups = selectedGroups?.length ? [`Selected groups: ${selectedGroups.join(', ')}`] : [];
  return [...groups, ...toolLines].join('\n');
}
