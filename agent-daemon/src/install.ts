import { Service } from '@cross/service';

const executable = Deno.build.os === 'windows'
  ? 'dist\\agent-harness-local-inference-daemon.exe'
  : './dist/agent-harness-local-inference-daemon';

const service = new Service({
  name: 'AgentHarnessLocalInferenceDaemon',
  description: 'Agent Harness local inference daemon',
  command: {
    cmd: executable,
    args: [],
    cwd: Deno.cwd(),
  },
});

if (import.meta.main) {
  await service.install();
  await service.start();
  console.log('Agent Harness Local Inference Daemon installed and started.');
}
