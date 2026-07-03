# Claude Code With Chrome Design

## Look And Feel

- Documentation-first UX: setup is explained inside Claude Code docs and Anthropic help-center articles rather than a standalone browser-agent product page.
- The integration design keeps the visible browser as the execution surface while Claude Code remains the planning and reporting surface.
- Troubleshooting pages are part of the product design because connection health, account matching, extension state, and native messaging are core user experience issues.

## Design Tokens To Track

```yaml
surface: Claude Code or Claude Desktop plus visible Chrome extension
visual_style: first-party docs and help-center flow
primary_objects:
  - chrome_extension
  - native_messaging_host
  - browser_tab
  - browser_tool
  - login_state
  - manual_pause
interaction_model:
  - connect_extension
  - run_browser_task_from_cli_or_vscode
  - open_visible_tab
  - pause_for_login_or_captcha
  - return_findings_to_coding_agent
trust_controls:
  - paid_account_gate
  - visible_browser_window
  - manual_handling_for_login_captcha
```

## Differentiators

- First-party distribution through Claude Code gives Anthropic a strong default-channel advantage.
- Claude can chain coding work, browser testing, console-log inspection, form filling, and extraction in one conversation.
- It uses the user's browser login state, which is a powerful wedge for authenticated app testing.

## What Is Good

- The integration reduces context switching for developers who already work inside Claude Code.
- A visible browser makes it easier to notice wrong pages, blocked logins, CAPTCHAs, or bad form entries.
- Official docs normalize browser automation as part of coding-agent workflows, increasing category demand.

## Where It Breaks Down

- Beta connection issues are a repeated UX risk: extension pairing, native messaging, account matching, and missing tools all affect the core flow.
- First-party integration can still feel opaque if tool registration fails and the user only sees a generic "not connected" state.
- Security expectations are high because the extension touches logged-in browser sessions and a powerful coding agent.

## Screenshot References

- Claude Code browser integration docs: `https://code.claude.com/docs/en/chrome`
- Claude in Chrome help-center setup and troubleshooting: `https://support.claude.com/en/articles/12012173-getting-started-with-claude-for-chrome`
