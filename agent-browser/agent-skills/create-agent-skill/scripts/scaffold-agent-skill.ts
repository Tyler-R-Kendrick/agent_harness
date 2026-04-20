export interface AgentSkillScaffold {
  skillName: string;
  outputPath: string;
  content: string;
  directories: string[];
}

export function normalizeSkillName(input: string): string {
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

export function createAgentSkillScaffold(input: string): AgentSkillScaffold {
  const skillName = normalizeSkillName(input);
  const title = toTitleCase(skillName);

  return {
    skillName,
    outputPath: `.agents/skills/${skillName}/SKILL.md`,
    directories: ['references/', 'scripts/', 'assets/'],
    content: `---\nname: ${skillName}\ndescription: Explain what the skill does and when to use it.\n---\n\n# ${title}\n\n## Steps\n\n1. Explain how to start.\n2. Explain the important checks.\n\n## Rules\n\n- Explain the constraints that affect every run.\n\n## References\n\n- Point to deeper docs under references/ when they are needed.\n`,
  };
}