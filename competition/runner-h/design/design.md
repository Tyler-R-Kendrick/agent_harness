# Runner H / Surfer H Design

## Look And Feel

- Research-lab meets product-studio design: cinematic marketing pages, black/white surfaces, large agent screenshots, benchmark claims, and "teammate" language.
- Runner H emphasizes a finished-work assistant with app integrations, files, memory, and orchestration.
- Surfer H emphasizes lower-level web action: browser interaction powered by Holo VLMs and available through CLI, frontend, portal keys, and open weights.

## Design Tokens To Track

```yaml
surface: marketing site, Runner H app, Studio, portal, Surfer-H CLI, local frontend
primary_objects:
  - workflow prompt
  - specialist agent
  - browsing agent
  - Studio run
  - live run review
  - Holo model
  - API key
  - open weights
core_controls:
  - prompt workflow
  - app connector
  - cloud managed agent call
  - review live run
  - edit past run
  - launch CLI/frontend
trust_controls:
  - encrypted workspace vault
  - file deletion
  - human review in Studio
  - enterprise security claims
```

## Differentiators

- H sells the model substrate, not just the browser wrapper: Holo/Surfer H are positioned as specialized action VLMs for web interfaces.
- Runner H broadens beyond browser control into agent orchestration across Slack, Notion, Google Workspace, Zapier, uploaded files, and future payments.
- Studio's promise to create, review, edit, debug, and teach runs directly overlaps the evidence/recovery surface `agent-browser` wants to own.

## What Is Good

- The product story acknowledges selector brittleness and frames natural-language, self-healing workflows as a concrete relief for web developers.
- Open-weight Surfer H and CLI distribution give technical buyers something inspectable beyond a closed SaaS demo.
- The split between orchestration product and web-agent engine lets H speak to both business users and builders.

## Where It Breaks Down

- The portfolio naming is confusing: Runner H, Studio, Surfer H, Holo, Holo1.5, and portal/API pieces require effort to map.
- Many claims are benchmark- and beta-heavy, so buyers need production proof before trusting autonomy on high-value workflows.
- General "teammate" positioning can dilute the specific browser UX and audit guarantees needed for sensitive logged-in actions.

## Screenshot And Design Studio References

- Runner H Studio beta screenshots: https://hcompany.ai/put-ai-to-work-for-you-with-runner-h
- Runner H orchestration product: https://www.hcompany.ai/runner-h
- Surfer H product surface: https://www.hcompany.ai/surfer-h
- Surfer-H CLI/frontend: https://github.com/hcompai/surfer-h-cli
