# Observational Memory And Semantic Recall

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra ships a layered memory model that combines working memory, conversation history, semantic recall, and a newer Observational Memory system built to compress long-running conversations into stable, reusable context.

## Evidence
- Official repo: [mastra-ai/mastra README](https://github.com/mastra-ai/mastra)
- Official research: [Observational Memory: 95% on LongMemEval](https://mastra.ai/research/observational-memory)
- Official docs: [Memory overview](https://mastra.ai/docs/memory/overview)
- Official docs: [Working Memory example](https://mastra.ai/examples/memory/working-memory-basic)
- Official releases: [mastra-ai/mastra releases](https://github.com/mastra-ai/mastra/releases)
- First-party details:
  - the README says Mastra combines conversation history, retrieval, working memory, and semantic memory for context management
  - the research page says Observational Memory uses background Observer and Reflector agents to maintain a dense observation log instead of injecting dynamic retrieval every turn
  - the same research page reports a 94.87 percent `gpt-5-mini` score on LongMemEval and positions the system as fully open source
  - the March 25, 2026 release notes added smarter model selection for Observational Memory and model routing based on input size
- Latest development checkpoint:
  - recent releases show Mastra is still actively optimizing long-horizon memory cost and reliability rather than treating memory as a static feature

## Product signal
Mastra sees durable memory as a runtime architecture problem, not just a retrieval add-on, which makes it relevant for harnesses that need coherent multi-turn execution.
