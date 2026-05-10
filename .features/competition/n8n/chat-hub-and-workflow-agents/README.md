# Chat Hub And Workflow Agents

- Harness: n8n
- Sourced: 2026-05-10

## What it is
Chat Hub is an organization-wide chat surface that exposes multiple models, personal agents, and workflow-backed agents behind one controlled interface.

## Evidence
- Official docs: [Chat Hub](https://docs.n8n.io/advanced-ai/chat-hub/)
- Official blog: [Introducing Chat Hub](https://blog.n8n.io/introducing-chat-hub/)
- Official docs: [Chat Trigger node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.chattrigger/)
- First-party details:
  - Chat Hub supports multiple AI models, personal agents, and workflow agents selected from the same model picker
  - n8n adds a `Chat user` role so users can interact with the chat surface without access to workflow authoring
  - admins can enable or disable providers, prevent custom model additions, and set default credentials per provider
  - workflow agents become available in Chat Hub when a workflow uses the supported Chat Trigger and streaming agent configuration
- Latest development checkpoint:
  - on January 28, 2026, n8n introduced Chat Hub as an answer to unmanaged "shadow AI" across organizations

## Product signal
n8n is turning workflow-backed agents into an internal AI control plane instead of leaving them as builder-only automations.
