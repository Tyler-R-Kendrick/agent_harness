export interface AgentScaffold {
  agentName: string;
  outputPath: string;
  reservedEvalsPath: string;
  content: string;
}

export function normalizeAgentName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function toTitleCase(input: string): string {
  return input
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function createAgentScaffold(input: string): AgentScaffold {
  const agentName = normalizeAgentName(input);
  const title = toTitleCase(agentName);
  const outputPath = `.agents/${agentName}/AGENTS.md`;

  return {
    agentName,
    outputPath,
    reservedEvalsPath: `.agents/${agentName}/.evals/`,
    content: `# ${title}\n\n## Purpose\n- Describe what this agent is responsible for.\n\n## Goals\n- List the outcomes this agent should optimize for.\n\n## Constraints\n- List the rules, safety limits, and quality bars.\n\n## Workflow\n1. Explain how the agent should begin.\n2. Explain how the agent should validate its work.\n\n## Deliverables\n- Describe the expected outputs or file changes.\n`,
  };
}