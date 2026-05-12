import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createJsonMatchEvaluator,
  createTrajectoryMatchEvaluator,
  exactMatch,
  levenshteinDistance,
  runMultiturnSimulation,
} from 'openevals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const resultsDir = path.join(projectRoot, 'output', 'langchain-openevals-agent-chat');

function toolCall(id, name, args) {
  return { id, name, args };
}

function trajectory({ input, toolCalls = [], toolResults = [], answer }) {
  const messages = [{ role: 'user', content: input }];
  if (toolCalls.length > 0) {
    messages.push({ role: 'assistant', content: '', tool_calls: toolCalls });
    for (const result of toolResults) {
      messages.push({
        role: 'tool',
        tool_call_id: result.tool_call_id,
        content: typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
      });
    }
  }
  messages.push({ role: 'assistant', content: answer });
  return messages;
}

function scoreToNumber(score) {
  return typeof score === 'number' ? score : score ? 1 : 0;
}

async function run() {
  const jsonMatch = createJsonMatchEvaluator({ aggregator: 'all', listMatchMode: 'ordered' });
  const strictTrajectory = createTrajectoryMatchEvaluator({ trajectoryMatchMode: 'strict' });
  const unorderedTrajectory = createTrajectoryMatchEvaluator({ trajectoryMatchMode: 'unordered' });
  const subsetTrajectory = createTrajectoryMatchEvaluator({ trajectoryMatchMode: 'subset' });
  const supersetTrajectory = createTrajectoryMatchEvaluator({ trajectoryMatchMode: 'superset' });

  const weatherTrajectory = trajectory({
    input: 'What is the weather in San Francisco?',
    toolCalls: [toolCall('call-weather-sf', 'get_weather', { city: 'San Francisco' })],
    toolResults: [{ tool_call_id: 'call-weather-sf', content: "It's 75 degrees and sunny in San Francisco." }],
    answer: 'The weather in San Francisco is 75 degrees and sunny.',
  });
  const combinedTrajectory = trajectory({
    input: 'What is happening in SF today and what is the weather?',
    toolCalls: [
      toolCall('call-weather-sf', 'get_weather', { city: 'SF' }),
      toolCall('call-events-sf', 'get_events', { city: 'SF' }),
    ],
    toolResults: [
      { tool_call_id: 'call-weather-sf', content: "It's 80 degrees and sunny in SF." },
      { tool_call_id: 'call-events-sf', content: 'Concert at the park in SF tonight.' },
    ],
    answer: 'Today in SF: 80 degrees and sunny with a concert at the park tonight.',
  });
  const weatherOnlyTrajectory = trajectory({
    input: 'What is happening in SF today and what is the weather?',
    toolCalls: [toolCall('call-weather-sf', 'get_weather', { city: 'SF' })],
    toolResults: [{ tool_call_id: 'call-weather-sf', content: "It's 80 degrees and sunny in SF." }],
    answer: 'Today in SF: 80 degrees and sunny.',
  });

  const simulation = await runMultiturnSimulation({
    user: ["what're the best movie theaters near me?", 'what about bars?'],
    maxTurns: 2,
    threadId: 'agent-chat-dev-evals',
    app: async ({ inputs }) => ({
      role: 'assistant',
      content: String(inputs.content).includes('bars')
        ? 'Hey Nonny, Arlington Ale House, and Peggy Kinnane are bar options near Arlington Heights.'
        : 'AMC Randhurst 12 and CMX Arlington Heights are nearby movie theater options.',
    }),
    trajectoryEvaluators: [
      async ({ outputs }) => {
        const finalAssistant = [...outputs].reverse().find((message) => message.role === 'assistant');
        return exactMatch({
          outputs: finalAssistant?.content ?? '',
          referenceOutputs: 'Hey Nonny, Arlington Ale House, and Peggy Kinnane are bar options near Arlington Heights.',
        });
      },
    ],
  });

  const checks = [
    await exactMatch({
      outputs: 'Done: tests passed and the browser proof is attached.',
      referenceOutputs: 'Done: tests passed and the browser proof is attached.',
    }),
    await levenshteinDistance({
      outputs: 'Tests passed; screenshot attached.',
      referenceOutputs: 'Tests passed; screenshot attached.',
    }),
    ...(await jsonMatch({
      outputs: {
        verdict: 'passing',
        scorers: '["trace-coverage","tool-reliability"]',
        failedTools: '[]',
      },
      referenceOutputs: {
        verdict: 'passing',
        scorers: '["trace-coverage","tool-reliability"]',
        failedTools: '[]',
      },
    })),
    await strictTrajectory({ outputs: weatherTrajectory, referenceOutputs: weatherTrajectory }),
    await unorderedTrajectory({ outputs: combinedTrajectory, referenceOutputs: combinedTrajectory }),
    await subsetTrajectory({ outputs: weatherOnlyTrajectory, referenceOutputs: combinedTrajectory }),
    await supersetTrajectory({ outputs: combinedTrajectory, referenceOutputs: weatherOnlyTrajectory }),
    ...simulation.evaluatorResults,
  ];

  const results = checks.map((check) => ({
    key: check.key,
    score: check.score,
    passed: scoreToNumber(check.score) === 1,
  }));
  const summary = {
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
  };
  const runId = `langchain-openevals-${Date.now()}`;
  const payload = { runId, createdAt: new Date().toISOString(), summary, results };

  await mkdir(path.join(resultsDir, 'runs'), { recursive: true });
  await writeFile(path.join(resultsDir, 'runs', `${runId}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(path.join(resultsDir, 'latest.json'), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ runId, summary, resultsDir }, null, 2));

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

await run();
