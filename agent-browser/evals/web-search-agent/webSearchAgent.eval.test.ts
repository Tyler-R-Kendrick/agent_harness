import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  buildWebSearchAgentPrompt,
  evaluateWebSearchAgentPrompt,
  selectWebSearchAgentTools,
} from '../../src/chat-agents/WebSearch';
import type { ToolDescriptor } from '../../src/tools';

interface WebSearchAgentEvalCase {
  id: string;
  task: string;
  location?: string;
  availableToolIds: string[];
  expectedToolIds: string[];
  mustMention: string[];
  mustNotSelectFirst: string[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readCases(): WebSearchAgentEvalCase[] {
  return readFileSync(path.join(__dirname, 'cases.jsonl'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as WebSearchAgentEvalCase);
}

function descriptorFor(toolId: string): ToolDescriptor {
  switch (toolId) {
    case 'webmcp:search_web':
      return {
        id: toolId,
        label: 'Search web',
        description: 'Search the public web for external, current, and local facts.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      };
    case 'webmcp:read_web_page':
      return {
        id: toolId,
        label: 'Read web page',
        description: 'Read and extract entities from result pages.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      };
    case 'webmcp:elicit_user_input':
      return {
        id: toolId,
        label: 'Elicit user input',
        description: 'Ask the user for missing input.',
        group: 'built-in',
        groupLabel: 'Built-In',
      };
    default:
      return {
        id: toolId,
        label: toolId,
        description: 'Run shell commands with curl, HTTP clients, or node fetch.',
        group: 'built-in',
        groupLabel: 'Built-In',
      };
  }
}

describe('web-search-agent evals', () => {
  for (const evalCase of readCases()) {
    it(`passes ${evalCase.id}`, () => {
      const descriptors = evalCase.availableToolIds.map(descriptorFor);
      const selectedToolIds = selectWebSearchAgentTools(descriptors, evalCase.task);
      const prompt = buildWebSearchAgentPrompt({
        task: evalCase.task,
        descriptors,
        location: evalCase.location,
      });

      expect(selectedToolIds).toEqual(evalCase.expectedToolIds);
      for (const forbidden of evalCase.mustNotSelectFirst) {
        expect(selectedToolIds[0]).not.toBe(forbidden);
      }
      for (const expected of evalCase.mustMention) {
        expect(prompt).toContain(expected);
      }
      expect(evaluateWebSearchAgentPrompt({ prompt, selectedToolIds }).passed).toBe(true);
    });
  }
});
