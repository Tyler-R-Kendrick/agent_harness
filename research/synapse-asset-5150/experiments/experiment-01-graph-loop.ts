export type BlackboardValue = string | number | boolean | null;

export interface Blackboard {
  readonly attempts: number;
  readonly goalMet: boolean;
}

export interface NodeContext {
  readonly blackboard: Blackboard;
}

export interface NodeResult {
  readonly patch?: Partial<Blackboard>;
  readonly note: string;
}

export interface Transition {
  readonly to: string;
  readonly reason: string;
  readonly guard: (ctx: NodeContext) => boolean;
}

export interface NodeDefinition {
  readonly id: string;
  readonly run: (ctx: NodeContext) => NodeResult;
  readonly transitions: readonly Transition[];
}

export interface GraphDefinition {
  readonly entryNodeId: string;
  readonly terminalNodeIds: readonly string[];
  readonly nodes: Readonly<Record<string, NodeDefinition>>;
}

export interface StepRecord {
  readonly from: string;
  readonly to: string;
  readonly reason: string;
  readonly note: string;
}

export interface RunResult {
  readonly steps: readonly StepRecord[];
  readonly blackboard: Blackboard;
  readonly terminalNodeId: string;
}

function applyPatch(blackboard: Blackboard, patch?: Partial<Blackboard>): Blackboard {
  if (!patch) {
    return blackboard;
  }

  return {
    ...blackboard,
    ...patch,
  };
}

function chooseTransition(node: NodeDefinition, ctx: NodeContext): Transition {
  const selected = node.transitions.find((edge) => edge.guard(ctx));
  if (!selected) {
    throw new Error(`No valid transition from node: ${node.id}`);
  }

  return selected;
}

export function runGraph(graph: GraphDefinition, initial: Blackboard, maxSteps = 32): RunResult {
  let current = graph.entryNodeId;
  let blackboard = initial;
  const steps: StepRecord[] = [];

  for (let i = 0; i < maxSteps; i += 1) {
    if (graph.terminalNodeIds.includes(current)) {
      return { steps, blackboard, terminalNodeId: current };
    }

    const node = graph.nodes[current];
    if (!node) {
      throw new Error(`Unknown node: ${current}`);
    }

    const result = node.run({ blackboard });
    blackboard = applyPatch(blackboard, result.patch);

    const transition = chooseTransition(node, { blackboard });
    steps.push({
      from: current,
      to: transition.to,
      reason: transition.reason,
      note: result.note,
    });

    current = transition.to;
  }

  throw new Error(`Step budget exceeded (${maxSteps})`);
}

export const demoGraph: GraphDefinition = {
  entryNodeId: 'plan',
  terminalNodeIds: ['done'],
  nodes: {
    plan: {
      id: 'plan',
      run: () => ({ note: 'Plan next action' }),
      transitions: [
        { to: 'act', reason: 'plan ready', guard: () => true },
      ],
    },
    act: {
      id: 'act',
      run: ({ blackboard }) => ({
        note: 'Execute tool step',
        patch: { attempts: blackboard.attempts + 1 },
      }),
      transitions: [
        { to: 'observe', reason: 'action complete', guard: () => true },
      ],
    },
    observe: {
      id: 'observe',
      run: ({ blackboard }) => ({
        note: 'Assess outcome',
        patch: { goalMet: blackboard.attempts >= 2 },
      }),
      transitions: [
        {
          to: 'done',
          reason: 'goal achieved',
          guard: ({ blackboard }) => blackboard.goalMet,
        },
        {
          to: 'act',
          reason: 'retry needed',
          guard: ({ blackboard }) => !blackboard.goalMet,
        },
      ],
    },
    done: {
      id: 'done',
      run: () => ({ note: 'Terminal' }),
      transitions: [],
    },
  },
};
