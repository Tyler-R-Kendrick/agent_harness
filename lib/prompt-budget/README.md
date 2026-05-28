# @agent-harness/prompt-budget

Prompt budgeting utilities for fitting model messages into a known context window.

The package is intentionally small: it estimates token counts from text, derives a usable input budget from model capabilities, normalizes model-message content, and keeps the most relevant messages within that budget.

## Install

```sh
npm install @agent-harness/prompt-budget
```

`ai` and `@ai-sdk/openai` are peer dependencies because this package is designed to sit near Vercel AI SDK model configuration, but the runtime helpers do not import provider clients directly.

## Usage

```ts
import {
  createPromptBudget,
  fitMessagesToBudget,
  normalizeModelMessage,
} from '@agent-harness/prompt-budget';

const budget = createPromptBudget({
  contextWindow: 128_000,
  maxOutputTokens: 4_096,
});

const messages = rawMessages.map(normalizeModelMessage);
const fitted = fitMessagesToBudget(messages, budget);
```

## Package Boundary

Use `@agent-harness/prompt-budget` as the stable root import for prompt-budget helpers and related types.

The `@agent-harness/prompt-budget/src/*` files are private implementation modules. They are included in the package artifact so TypeScript-source consumers can load the exported root entry point directly, but consumers should not deep-import those paths.

Published artifacts are intentionally runtime-only: `README.md`, `package.json`, and `src/**/*.ts` are included, while `src/__tests__/**` and `src/**/*.test.ts` are excluded.

## Local Validation

```sh
npm --workspace @agent-harness/prompt-budget run test:coverage
npm --workspace @agent-harness/prompt-budget pack --dry-run
```
