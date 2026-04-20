export interface AgentEvalScaffold {
  agentName: string;
  evalName: string;
  outputPath: string;
  content: string;
}

function normalizeName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function createAgentEvalScaffold(agentInput: string, evalInput: string): AgentEvalScaffold {
  const agentName = normalizeName(agentInput);
  const evalName = normalizeName(evalInput);

  return {
    agentName,
    evalName,
    outputPath: `.agents/${agentName}/.evals/${evalName}.yaml`,
    content: `name: ${evalName}\nversion: "1.0"\ndescription: Describe what this eval suite verifies.\ncases:\n  - id: case-001\n    description: Describe the case.\n    prompt: |\n      Put the user request here.\n    assertions:\n      - type: contains\n        value: "expected text"\n`,
  };
}