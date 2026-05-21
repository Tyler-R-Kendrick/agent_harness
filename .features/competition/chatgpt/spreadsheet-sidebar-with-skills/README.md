# Spreadsheet Sidebar With Skills

- Harness: ChatGPT
- Sourced: 2026-05-21

## What it is
ChatGPT for Excel and Google Sheets puts a spreadsheet-native agent sidebar directly inside the host application, with natural-language editing, workbook-aware reasoning, reusable Skills, and optional app connectivity.

## Evidence
- Help article: [ChatGPT for Excel and Google Sheets](https://help.openai.com/en/articles/20001063-chatgpt-for-excel-and-google-sheets)
- Release notes: [ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes)
- Capabilities called out:
  - build, update, and explain spreadsheets in place
  - work across large multi-tab files with formulas, references, and assumptions
  - use Skills as reusable playbooks for spreadsheet work
  - connect apps where available for more contextual spreadsheet outputs
  - install from Microsoft Marketplace or Google Workspace Marketplace
- Governance details called out:
  - RBAC enablement path for workspaces
  - limited memory support inside spreadsheet chats
  - explicit warning to review formulas, calculations, citations, and changed cells before relying on outputs

## Product signal
OpenAI is exporting the ChatGPT harness into host-native work surfaces, with skills and guardrails embedded directly where the work artifact already lives.
