export type SectionDestination = 'skill' | 'reference';

export interface OptimizationPaths {
  skillRoot: string;
  skillFile: string;
  referencesDir: string;
  evalsFile: string;
  scriptsDir: string;
  fromCompatibilityLink: boolean;
}

export interface OptimizationPlan {
  paths: OptimizationPaths;
  steps: string[];
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

export function resolveCanonicalSkillRoot(input: string): OptimizationPaths {
  const normalizedInput = trimSlashes(input.trim());
  const fromCompatibilityLink = normalizedInput.startsWith('.agents/skills/');
  const canonicalRoot = fromCompatibilityLink
    ? normalizedInput.replace(/^\.agents\/skills\//, 'skills/')
    : normalizedInput;

  return {
    skillRoot: canonicalRoot,
    skillFile: `${canonicalRoot}/SKILL.md`,
    referencesDir: `${canonicalRoot}/references`,
    evalsFile: `${canonicalRoot}/evals/evals.json`,
    scriptsDir: `${canonicalRoot}/scripts`,
    fromCompatibilityLink,
  };
}

export function classifySectionDestination(title: string, body: string): SectionDestination {
  const normalizedTitle = title.toLowerCase();
  const normalizedBody = body.toLowerCase();

  if (
    normalizedTitle.includes('schema')
    || normalizedTitle.includes('example')
    || normalizedTitle.includes('troubleshooting')
    || normalizedTitle.includes('benchmark')
    || normalizedBody.includes('{"')
    || normalizedBody.includes('```json')
  ) {
    return 'reference';
  }

  return 'skill';
}

export function buildOptimizationPlan(input: string): OptimizationPlan {
  const paths = resolveCanonicalSkillRoot(input);

  return {
    paths,
    steps: [
      `Run /sensei --gepa against ${paths.skillFile}`,
      `Keep activation-critical guidance in ${paths.skillFile}`,
      `Move bulky examples, schemas, and recipes into ${paths.referencesDir}`,
      `Write deterministic helpers under ${paths.scriptsDir}`,
      `Create or refresh ${paths.evalsFile}`,
    ],
  };
}