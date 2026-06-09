# Bolt.new Design

## Look And Feel

- Bolt.new feels like an AI chat wrapped around a live browser IDE.
- The workspace combines prompt input, generated task progress, file tree, editor, terminal/server output, browser preview, project settings, and publish controls.
- Compared with pure UI generators, Bolt puts runtime state on screen: packages install, servers start, previews fail, and console issues become part of the user loop.

## Design Tokens To Track

```yaml
surface: prompt homepage, project workspace, editor, terminal, preview, settings, publish flow
accent: developer browser IDE with AI-first entry
primary_control: prompt the full-stack agent
core_objects:
  - project
  - chat
  - file
  - WebContainer
  - terminal
  - preview
  - GitHub repository
  - deployment
  - token
information_density: medium-to-high
```

## Differentiators

- WebContainers let the browser run Node.js, package installs, dev servers, and frontend previews without local setup.
- The AI has environment control, including filesystem, terminal, package manager, and browser console, so it can do more than generate static code.
- Opening public GitHub repositories in Bolt by prefixing URLs with `bolt.new` creates a low-friction import path.
- Built-in Bolt hosting and Netlify publishing make deployment part of the workspace.

## What Is Good

- The "running app in the browser" feedback loop is compelling because users can see generated code execute immediately.
- Developers can export, open in StackBlitz, connect GitHub, or download a zip instead of being trapped in a no-code surface.
- Runtime logs and previews create more concrete debugging context than chat-only generators.

## Where It Breaks Down

- The dense workspace can overwhelm non-developers once terminal errors, dependencies, and type failures appear.
- WebContainer limits show up as preview failures, startup issues, browser compatibility problems, VPN/ad-blocker conflicts, and out-of-memory states.
- Token visibility helps, but also makes every repeated repair attempt feel expensive.
- Because the agent controls the environment, users can experience dramatic regressions when a later prompt reintroduces errors or resets previously repaired work.

## Screenshot References

- Bolt quickstart and token display: `https://support.bolt.new/building/quickstart`
- Project management screenshots: `https://support.bolt.new/building/using-bolt/projects-files`
- Deployment settings screenshots: `https://support.bolt.new/building/deploy`
