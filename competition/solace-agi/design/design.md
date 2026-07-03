# Solace AGI Design

## Look And Feel

- Trust-first automation page with large product claims, explicit approval language, and repeated evidence/audit framing.
- The browser product page uses a direct "see it, approve it, watch it work" rhythm rather than developer API-first framing.
- Feature pages lean on governance vocabulary: scoped permissions, budgets, role-based permissions, cloud evidence, recipes, and audit trails.
- Pricing pages sell against virtual assistants and repetitive work ROI, which makes the interface feel more operator/productivity-oriented than browser-infrastructure-oriented.

## Design Tokens To Track

```yaml
surface: local desktop browser plus cloud evidence and recipe surfaces
visual_style: trust-first SaaS with approval-led workflow copy
primary_objects:
  - browser
  - recipe
  - permission_scope
  - approval
  - evidence_vault
  - cloud_twin
  - app_store_workflow
interaction_model:
  - screenshot_before_action
  - approve_every_action
  - record_and_replay
  - instant_stop
trust_controls:
  - time_bounded_permissions
  - revocable_permissions
  - budget_enforcement
  - audit_trail
  - evidence_retention
```

## Differentiators

- Solace makes human approval and evidence the center of the product story instead of treating logs as a secondary dashboard.
- Recipes position repeated workflows as sealed, versioned playbooks with lower replay cost, which is strategically adjacent to deterministic browser-agent regression artifacts.
- The `/agents` and `/agents.json` positioning treats agent discoverability as a first-class marketing surface for coding assistants and orchestration frameworks.

## What Is Good

- The approval-first copy maps well to the real risk of agents using logged-in browser state.
- The design gives nontechnical operators a simple mental model: approve, record, replay, stop.
- Scoped permissions and budget enforcement are concrete trust primitives that agent-browser should match or exceed in its own authority-boundary language.

## Where It Breaks Down

- The "Software 5.0", OAuth3, rung-gated app store, Part 11, and evidence-vault language can feel overloaded before a buyer sees a concrete run.
- Pricing and plan copy is inconsistent across localized pages, which can weaken buyer trust in the commercial model.
- Claims around certification-oriented evidence need careful wording because regulated customers still need their own validation.

## Screenshot References

- Browser approval workflow and feature illustrations: `https://solaceagi.com/browser.html`
- Developer documentation cards and architecture sections: `https://www.solaceagi.com/docs`
- Pricing and ROI calculator: `https://solaceagi.com/ja/pricing`
