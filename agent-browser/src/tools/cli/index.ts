import { tool } from 'ai';
import { z } from 'zod';
import { executeCliCommand } from './exec';
import type { TerminalExecutorContext } from '../types';

export function createCliTool(context: TerminalExecutorContext) {
  return tool({
    description: 'Run a single bash command in the active workspace terminal session. The tool call is shown in the chat transcript.',
    inputSchema: z.object({
      command: z.string().trim().min(1).max(4000).describe('A single bash command to execute in the active session.'),
    }),
    execute: async ({ command }) => executeCliCommand(context, command, { emitMessages: false }),
  });
}