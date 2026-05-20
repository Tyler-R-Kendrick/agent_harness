# Browsaur Design

## Look And Feel

- Browsaur uses a direct, comparison-heavy developer landing page with quick-start snippets, metrics, pricing cards, and competitor tables.
- The aesthetic is utilitarian and sales-aggressive: "real Chrome", "31/31 stealth", "$10/month", and "self-host free" repeat as first-screen anchors.
- The site exposes agent-readable entry points such as llms-full.txt, glossary, and API docs in the first line of the page.
- Visual structure favors proof blocks: metrics, feature rows, bot-detection tables, testimonials, pricing, and FAQ.

## Design Tokens Observed

```yaml
visual_language:
  mode: developer infrastructure landing page
  evidence_blocks:
    - quickstart snippets
    - stealth test table
    - competitor comparison
    - pricing cards
    - testimonials
  tone: blunt, price-conscious, anti-datacenter-browser
  density: high
interaction_patterns:
  primary_actions:
    - get started
    - read quickstart
  buyer_shortcuts:
    - pricing
    - compare
    - self-hosting
    - MCP docs
```

## Differentiators

- The strongest design choice is proof density. Bot-detection claims, pricing math, and competitor comparisons are visible without requiring a sales call.
- Agent-readable docs at the top are a smart category-specific signal: the product expects agents to inspect and use the docs directly.
- Self-hosting and cloud are presented as the same mental model, which reduces migration anxiety.
- The pricing table is unusually concrete for the category.

## Where It Breaks Down

- The tone is adversarial toward competitors, especially Steel. That can be memorable, but it may reduce trust for enterprise buyers who prefer neutral technical evidence.
- Heavy reliance on anti-bot and residential-IP claims can attract scraping-heavy use cases and make abuse controls a buyer concern.
- The page is dense enough that non-infrastructure buyers may miss the basic workflow.
- Some claims, such as developer counts and stealth scores, need independent validation before being treated as proof.

## Sources

- https://browsaur.dev/
- https://browsaur.dev/pricing
- https://browsaur.dev/mcp
