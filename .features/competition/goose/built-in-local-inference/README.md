# Built-In Local Inference

- Harness: Goose
- Sourced: 2026-05-03

## What it is
Goose now ships a zero-dependency local model path inside the desktop app, using embedded `llama.cpp` so the harness can run offline without Ollama, Docker, or a separate server.

## Evidence
- Official blog: [Private by Default: Built-in Local Inference Models with goose](https://goose-docs.ai/blog/2026/04/24/use-goose-with-built-in-local-inference/)
- First-party details:
  - Goose says built-in local inference is already available in the desktop app.
  - The runtime downloads GGUF models, loads them into GPU or CPU memory, and runs them in-process.
  - Goose positions the feature as private by default because code never leaves the machine and no external API key is required.
  - The blog contrasts this directly with Ollama by emphasizing no background server, in-app model management, and zero extra setup.
  - Goose highlights curated local models including Gemma 4 with native tool calling support.
- Latest development checkpoint:
  - built-in local inference landed in late April 2026 and is framed as a major product direction, not a hidden experimental toggle

## Product signal
Goose is making private, offline, zero-dependency execution a product feature. That creates pressure on other harnesses to offer local-first paths instead of assuming cloud APIs.
