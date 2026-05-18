# Bring Your Own Model Keys And Auto Model Routing

- Harness: GitHub Copilot
- Sourced: 2026-05-18

## What it is
Copilot now lets teams bring their own provider API keys into VS Code chat and custom agents, while also supporting automatic model selection across cloud agent and CLI surfaces.

## Evidence
- Changelog: [Bring your own language model key in VS Code now available](https://github.blog/changelog/2026-04-22-bring-your-own-language-model-key-in-vs-code-now-available/)
- Changelog: [GitHub Copilot in Visual Studio Code, April releases](https://github.blog/changelog/2026-05-06-github-copilot-in-visual-studio-code-april-releases/)
- Changelog: [GitHub Copilot CLI now supports Copilot auto model selection](https://github.blog/changelog/2026-04-17-github-copilot-cli-now-supports-copilot-auto-model-selection/)
- Changelog: [Copilot cloud agent supports auto model selection](https://github.blog/changelog/2026-05-14-copilot-cloud-agent-supports-auto-model-selection)
- GitHub documents:
  - BYOK supports providers such as Anthropic, Gemini, OpenAI, OpenRouter, and Azure, plus local runtimes such as Ollama and Foundry Local
  - BYOK models are available in VS Code chat, the built-in plan agent, and custom agents
  - organizations can disable BYOK with a policy on github.com
  - Copilot Auto can choose models dynamically in CLI and cloud-agent flows, respect admin policies, and reduce multiplier cost

## Product signal
GitHub is turning model routing into an enterprise-governed control plane, not just a per-user dropdown.
