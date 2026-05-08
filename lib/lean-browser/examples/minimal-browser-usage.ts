import {
  BrowserLeanChecker,
  JsonPromptValidationModel,
  createLeanServer,
  runAgentBrowser,
  type TaskInput,
} from '../src';

const task: TaskInput = {
  task_id: 'nat-add-zero',
  goal: 'Validate that forall n : Nat, n + 0 = n.',
  context: {},
  constraints: [],
  evidence: [],
  require_formal_proof: true,
  require_symbolic_checking: false,
  max_iterations: 2,
  max_branches: 1,
};

export async function validateWithHostProvidedGenerator(
  generateText: (prompt: string) => Promise<string>,
) {
  const llm = new JsonPromptValidationModel(generateText);
  const leanServer = await createLeanServer({ baseUrl: '/lean' });
  await leanServer.connect();

  return runAgentBrowser(task, {
    llm,
    leanChecker: new BrowserLeanChecker(leanServer),
  });
}
