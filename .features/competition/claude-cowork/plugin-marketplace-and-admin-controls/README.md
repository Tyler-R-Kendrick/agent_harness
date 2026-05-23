# Plugin Marketplace And Admin Controls

- Harness: Claude Cowork
- Refreshed: 2026-05-23

## What it is
Cowork packages reusable workflows as plugins that bundle skills, connectors, and sub-agents, then adds organization marketplaces and installation policies so teams can govern which packages appear in the harness.

## Evidence
- Release notes: [February 24, 2026 Cowork plugins and admin controls](https://support.claude.com/en/articles/12138966-release-notes)
- Official docs: [Use plugins in Claude Cowork](https://support.claude.com/en/articles/13837440-use-plugins-in-cowork)
- Admin docs: [Manage Claude Cowork plugins for your organization](https://support.claude.com/en/articles/13837433-manage-claude-cowork-plugins-for-your-organization)
- First-party details:
  - each plugin bundles skills, connectors, and sub-agents into one installable package
  - the Customize sidebar exposes plugin browsing, installation, upload, and per-plugin customization
  - Cowork includes a built-in Plugin Create path plus Anthropic templates for authoring new plugins
  - org owners can distribute plugins through marketplaces with manual ZIP upload or GitHub repository sync
  - marketplace policies can mark plugins as installed by default, available, required, or not available
  - Enterprise admins can override plugin availability by group
- Latest development checkpoint:
  - Anthropic's current plugin docs make Cowork's package model look closer to an internal app marketplace than a mere prompt-template catalog

## Product signal
Cowork is turning agent workflows into governed, distributable packages, which is a stronger enterprise product signal than ad hoc skill libraries alone.
