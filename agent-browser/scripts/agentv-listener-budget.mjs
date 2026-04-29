import { EventEmitter, setMaxListeners } from 'node:events';

const AGENTV_STDIO_LISTENER_BUDGET = 256;

EventEmitter.defaultMaxListeners = AGENTV_STDIO_LISTENER_BUDGET;
setMaxListeners(AGENTV_STDIO_LISTENER_BUDGET, process.stdin, process.stdout, process.stderr);
process.stdin.setMaxListeners(AGENTV_STDIO_LISTENER_BUDGET);
process.stdout.setMaxListeners(AGENTV_STDIO_LISTENER_BUDGET);
process.stderr.setMaxListeners(AGENTV_STDIO_LISTENER_BUDGET);
