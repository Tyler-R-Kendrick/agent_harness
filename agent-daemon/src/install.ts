import { Service } from '@cross/service';

function resolveExecutable(): string {
  if (Deno.build.os === 'windows') {
    return 'dist\\agent-harness-local-inference-daemon-windows-x64.exe';
  }

  if (Deno.build.os === 'darwin') {
    return Deno.build.arch === 'aarch64'
      ? './dist/agent-harness-local-inference-daemon-macos-arm64'
      : './dist/agent-harness-local-inference-daemon-macos-x64';
  }

  return './dist/agent-harness-local-inference-daemon';
}

const executable = resolveExecutable();

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
