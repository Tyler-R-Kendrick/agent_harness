/**
 * tool-agents/inbrowser-use.ts
 *
 * Registers inbrowser-use DOM actions as LLM-callable tools.
 *
 * Structure:
 *  - AGENT_INSTRUCTIONS  – System prompt / Instructions layer
 *  - createInBrowserUseTools – Tool layer: wraps each page action as an AI SDK tool
 *  - createInBrowserUseAgent – Combines Instructions + Tools into an agent descriptor
 *                              ready to be passed to ToolLoopAgent (Inference layer)
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { LanguageModel, ToolSet } from 'ai';
import type { PlaywrightLikePage } from 'inbrowser-use';
import { runToolAgent, type AgentRunCallbacks, type AgentRunResult } from '../../services/agentRunner';

// ── Instructions ──────────────────────────────────────────────────────────────

export const AGENT_INSTRUCTIONS = `\
You are an in-browser DOM automation agent. You control the current web page by \
calling tools that map to Playwright-shaped actions. Use CSS selectors to target \
elements unless a semantic locator is more appropriate.

Available capabilities:
- click a selector
- fill an input with text
- selectOption from a dropdown
- check / uncheck a checkbox
- hover over an element
- press a keyboard key on a focussed element
- focus / blur an element
- read text content of an element
- read the current value of an input
- query visibility and enabled state
- count elements matching a selector
- read an attribute value

Always prefer the most specific, stable selector. Prefer role or label over brittle CSS \
when practical. Confirm success by querying state after mutations.`.trim();

// ── Tools ─────────────────────────────────────────────────────────────────────

export function createInBrowserUseTools(page: PlaywrightLikePage) {
  return {
    click: tool({
      description: 'Click an element identified by a CSS selector.',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the element to click.'),
      }),
      execute: async ({ selector }) => {
        await page.locator(selector).click();
      },
    }),

    fill: tool({
      description: 'Clear and fill an input or textarea with the given text.',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the input element.'),
        value: z.string().describe('Text to fill into the element.'),
      }),
      execute: async ({ selector, value }) => {
        await page.locator(selector).fill(value);
      },
    }),

    selectOption: tool({
      description: 'Select an option in a <select> element by value.',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the <select> element.'),
        value: z.string().describe('The option value to select.'),
      }),
      execute: async ({ selector, value }) => {
        await page.locator(selector).selectOption(value);
      },
    }),

    check: tool({
      description: 'Check a checkbox or radio button.',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the checkbox or radio.'),
      }),
      execute: async ({ selector }) => {
        await page.locator(selector).check();
      },
    }),

    uncheck: tool({
      description: 'Uncheck a checkbox.',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the checkbox.'),
      }),
      execute: async ({ selector }) => {
        await page.locator(selector).uncheck();
      },
    }),

    hover: tool({
      description: 'Hover the mouse over an element.',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the element to hover.'),
      }),
      execute: async ({ selector }) => {
        await page.locator(selector).hover();
      },
    }),

    press: tool({
      description: 'Press a keyboard key while the element is focused (e.g. "Enter", "Tab", "Escape").',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the target element.'),
        key: z.string().describe('Key name to press (Playwright key format).'),
      }),
      execute: async ({ selector, key }) => {
        await page.locator(selector).press(key);
      },
    }),

    focus: tool({
      description: 'Focus an element.',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the element to focus.'),
      }),
      execute: async ({ selector }) => {
        await page.locator(selector).focus();
      },
    }),

    blur: tool({
      description: 'Remove focus from an element.',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the element to blur.'),
      }),
      execute: async ({ selector }) => {
        await page.locator(selector).blur();
      },
    }),

    getTextContent: tool({
      description: 'Read the visible text content of an element.',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the element.'),
      }),
      execute: async ({ selector }) => {
        return page.locator(selector).textContent();
      },
    }),

    getInputValue: tool({
      description: 'Read the current value of an input, textarea, or select element.',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the input element.'),
      }),
      execute: async ({ selector }) => {
        return page.locator(selector).inputValue();
      },
    }),

    isVisible: tool({
      description: 'Check whether an element is visible on the page.',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the element.'),
      }),
      execute: async ({ selector }) => {
        return page.locator(selector).isVisible();
      },
    }),

    isEnabled: tool({
      description: 'Check whether an element is enabled (not disabled).',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the element.'),
      }),
      execute: async ({ selector }) => {
        return page.locator(selector).isEnabled();
      },
    }),

    countElements: tool({
      description: 'Count the number of elements matching a CSS selector.',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector to count.'),
      }),
      execute: async ({ selector }) => {
        return page.locator(selector).count();
      },
    }),

    getAttribute: tool({
      description: 'Read an attribute value from an element.',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the element.'),
        name: z.string().describe('Attribute name to read (e.g. "href", "aria-label").'),
      }),
      execute: async ({ selector, name }) => {
        return page.locator(selector).getAttribute(name);
      },
    }),
  } as const;
}

// ── Agent descriptor ──────────────────────────────────────────────────────────

/**
 * Returns the Instructions + Tools layers for the InBrowserUse agent.
 *
 * To wire up Inference, pass `agent.tools` and `agent.instructions` to
 * `runToolAgent` along with a `model`:
 *
 * ```ts
 * const agent = createInBrowserUseAgent(page);
 * await runToolAgent({ model, ...agent, messages }, callbacks);
 * ```
 */
export function createInBrowserUseAgent(page: PlaywrightLikePage) {
  return {
    instructions: AGENT_INSTRUCTIONS,
    tools: createInBrowserUseTools(page),
  };
}

// ── Execution ─────────────────────────────────────────────────────────────────

export type InBrowserUseRunOptions = {
  /** Natural-language goal for the agent, e.g. "Click the Submit button". */
  goal: string;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
  /** Maximum number of tool-loop steps. Default: 20. */
  maxSteps?: number;
  /** Additional tools to expose alongside the DOM tools (e.g. MCP-bridged tools). */
  extraTools?: ToolSet;
};

/**
 * Runs the InBrowserUse tool-agent to completion.
 *
 * This is the primary entry point for executing browser automation tasks.
 * The model performs a full agentic tool loop: it calls DOM tools, observes
 * results, and continues until the goal is achieved or maxSteps is reached.
 *
 * @example
 * ```ts
 * const page = createInAppPage();
 * const result = await runInBrowserUseAgent(page, model, {
 *   goal: 'Fill the name field with "Alice" and click Submit.',
 *   onDone: (text) => console.log('Agent finished:', text),
 * });
 * ```
 */
export async function runInBrowserUseAgent(
  page: PlaywrightLikePage,
  model: LanguageModel,
  options: InBrowserUseRunOptions,
  callbacks: AgentRunCallbacks = {},
): Promise<AgentRunResult> {
  const agent = createInBrowserUseAgent(page);
  return runToolAgent(
    {
      model,
      tools: { ...agent.tools, ...options.extraTools },
      instructions: agent.instructions,
      messages: [{ role: 'user', content: options.goal }],
      maxSteps: options.maxSteps,
      signal: options.signal,
    },
    callbacks,
  );
}
