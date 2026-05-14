# Markdown Mermaid Diagrams

Agent Harness file-renderer extension for Markdown and MDX artifacts that contain Mermaid diagrams.

The extension contributes `markdown-mermaid.renderer`, which binds the same Markdown paths as the base preview and has higher priority. Agent Browser renders the selected binding with Mermaid hydration enabled while keeping the raw diagram source available in the preview.
