import type { SkillDefinition } from './skillContracts';

export class SkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill);
  }

  get(skillId: string): SkillDefinition | undefined {
    return this.skills.get(skillId);
  }

  list(): SkillDefinition[] {
    return [...this.skills.values()];
  }
}
