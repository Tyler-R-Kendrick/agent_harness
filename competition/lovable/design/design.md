# Lovable Design

## Look And Feel

- Lovable presents app creation as a calm chat-and-preview workspace rather than a developer IDE.
- The primary design object is the live app preview. Users can prompt, select visible elements, and make visual edits without moving into code.
- The product leans into polished SaaS/web-app defaults: Tailwind-style components, clean spacing, generated imagery, and quick publish links.

## Design Tokens To Track

```yaml
surface: dashboard, chat editor, live preview, visual edit sidebar, code editor, publish controls
accent: friendly no-code app builder
primary_control: prompt or select an element
core_objects:
  - project
  - prompt
  - visual edit
  - version
  - Supabase project
  - GitHub repository
  - published snapshot
  - credit
information_density: low-to-medium
```

## Differentiators

- Visual Edits lets users select UI elements in the preview and adjust text, colors, fonts, images, margins, padding, and layout while Lovable's agent applies the change.
- Screenshot and image input makes design direction concrete for non-designers.
- The Supabase integration makes backend, auth, storage, realtime data, and Edge Functions feel like chat-driven product features instead of separate setup.
- Code Mode and GitHub sync give advanced users an escape hatch after the no-code loop has produced a useful baseline.

## What Is Good

- The design makes the first successful moment very fast: prompt, preview, edit, publish.
- Visual Edits reduce the "one more prompt" cost for copy and layout tweaks because simple UI changes can be made directly.
- Version history and revert controls make experimentation approachable for non-developers.

## Where It Breaks Down

- The same polished default component system can make generated products look similar unless the user has strong brand direction.
- Native mobile and complex responsive design are weaker fits than web apps; community comparisons repeatedly call out mobile-looking results as less convincing.
- Backend setup is approachable, but production data migration, staging, security rules, and observability remain less visible than the happy-path builder flow.
- Credit-based prompting can turn bug repair into a design problem: users see a friendly editor while each failed fix consumes budget.

## Screenshot References

- Lovable dashboard and project flow: `https://docs.lovable.dev/introduction/getting-started`
- Visual editor screenshots: `https://docs.lovable.dev/features/design`
- Code editor screenshot: `https://docs.lovable.dev/features/code-mode`
