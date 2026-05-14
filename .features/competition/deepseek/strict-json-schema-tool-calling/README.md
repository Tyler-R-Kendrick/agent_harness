# Strict JSON Schema Tool Calling

- Harness: DeepSeek
- Sourced: 2026-05-14

## What it is
DeepSeek offers a strict tool-calling mode where function invocations must conform to validated JSON Schema, including during thinking-mode runs.

## Evidence
- Official docs: [Function Calling](https://api-docs.deepseek.com/guides/function_calling/) and [Tool Calls](https://api-docs.deepseek.com/guides/tool_calls)
- First-party details:
  - DeepSeek says `strict` mode validates the provided tool schema server-side
  - the beta mode requires `base_url="https://api.deepseek.com/beta"` and `strict: true` on each function
  - the docs enumerate the supported schema types and require `additionalProperties: false` on objects
  - the tool-calls guide says strict mode works in both thinking and non-thinking paths
- Latest development checkpoint:
  - the current docs, crawled within the last two weeks, still position strict schema enforcement as an active beta feature of the live API

## Product signal
DeepSeek is pushing agent harnesses toward typed tool contracts with runtime validation, which reduces argument drift and makes tool execution safer to automate.
