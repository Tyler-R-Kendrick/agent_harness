# Voice Runtime With Speech To Speech

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra includes a real-time voice runtime that supports text-to-speech, speech-to-text, and speech-to-speech, so agents can operate through continuous audio rather than only turn-based text.

## Evidence
- Official docs: [Adding Voice to Agents](https://mastra.ai/en/docs/agents/adding-voice)
- Official docs: [Speech-to-Speech Capabilities in Mastra](https://mastra.ai/en/docs/voice/speech-to-speech)
- Official docs: [Speech-to-Text](https://mastra.ai/en/docs/voice/speech-to-text)
- First-party details:
  - the voice docs say agents can be configured with provider-backed voice runtimes directly on the `Agent` primitive
  - the speech-to-speech docs describe a standardized interface for real-time bidirectional audio interactions across providers
  - the same docs say STS keeps an open connection and processes speech continuously instead of chaining separate STT and TTS steps
  - the voice surface includes provider integrations, runtime events, and methods for connecting, sending audio, and speaking responses
- Latest development checkpoint:
  - the current documentation still presents real-time voice as a supported runtime surface, not a deprecated experiment

## Product signal
Mastra is building agents as multi-surface runtimes with live audio channels, which widens the harness model beyond text and code workflows.
