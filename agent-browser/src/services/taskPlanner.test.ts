import { describe, expect, it } from 'vitest';
import { buildTaskPlanPrompt, parseTaskPlan } from './taskPlanner';

describe('taskPlanner', () => {
  it('builds a prompt that asks for tool selections and predeclared validations', () => {
    const prompt = buildTaskPlanPrompt({
      workspaceName: 'Research',
      userPrompt: 'Fix the broken workflow and verify each task.',
      coordinatorProblem: 'Repair the task execution workflow.',
      toolCatalog: [
        { id: 'cli', label: 'CLI', description: 'Run shell commands.' },
        { id: 'read_session_file', label: 'Read session file', description: 'Read a file from the session filesystem.' },
      ],
    });

    expect(prompt).toContain('Repair the task execution workflow.');
    expect(prompt).toContain('toolIds');
    expect(prompt).toContain('validations');
    expect(prompt).toContain('Return JSON only');
  });

  it('parses and normalizes a valid task plan', () => {
    const parsed = parseTaskPlan(
      JSON.stringify({
        goal: 'Repair the workflow',
        tasks: [
          {
            id: 'inspect-flow',
            title: 'Inspect workflow',
            description: 'Read the current implementation and find the seam.',
            toolIds: ['read_session_file', 'cli', 'unknown'],
            toolRationale: 'Need read access and shell checks.',
            dependsOn: [],
            validations: [
              {
                id: 'contains-report',
                kind: 'response-contains',
                substrings: ['workflow seam'],
              },
            ],
          },
        ],
      }),
      ['cli', 'read_session_file'],
    );

    expect(parsed).toEqual({
      goal: 'Repair the workflow',
      tasks: [
        {
          id: 'inspect-flow',
          title: 'Inspect workflow',
          description: 'Read the current implementation and find the seam.',
          toolIds: ['read_session_file', 'cli'],
          toolRationale: 'Need read access and shell checks.',
          dependsOn: [],
          validations: [
            {
              id: 'contains-report',
              kind: 'response-contains',
              substrings: ['workflow seam'],
            },
          ],
          status: 'pending',
        },
      ],
    });
  });

  it('rejects malformed plans and plans without executable tasks', () => {
    expect(parseTaskPlan('not json', ['cli'])).toBeNull();
    expect(parseTaskPlan(JSON.stringify({ goal: 'x', tasks: [] }), ['cli'])).toBeNull();
    expect(
      parseTaskPlan(
        JSON.stringify({
          goal: 'x',
          tasks: [{ id: 'a', title: 'A', description: 'B', toolIds: ['unknown'], validations: [] }],
        }),
        ['cli'],
      ),
    ).toBeNull();
  });
});