# Sigil Browser Design

## Look And Feel

- Dark, security-led landing page with crisp product screenshots, green/blue status accents, and a short top navigation.
- The page favors enterprise trust language over playful browser branding: "Secure", "Efficiency", "Local execution", and "Monitor" are the main visual anchors.
- Product imagery focuses on permission dialogs, connected-agent lists, security-policy toggles, Claude tool use, semantic page snapshots, and audit logs rather than browsing content.

## Design Tokens Observed

- Dominant palette: near-black background, white text, muted gray body copy, green/blue security and status accents.
- Shape language: compact cards, dashboard screenshots, toggle controls, and step-number labels.
- Interaction language: install/connect/secure/automate/monitor sequence, with product controls framed as policy and audit surfaces.

## What Differentiates It

- Sigil makes policy controls the visual center of the product. That is stronger than generic "agent can browse" positioning because the buyer can immediately see where authority is scoped.
- The semantic snapshot screenshot makes token savings concrete. The design explains that the agent receives filtered page state rather than a full DOM or screenshot.
- Audit-log imagery is useful because it turns invisible browser control into something reviewable after the run.

## What Is Good

- The page gets to the key enterprise concern quickly: agents can use the user's existing Chrome, but deterministic guardrails decide what they can touch.
- The five-step flow is easy to scan and maps to a believable setup path.
- Security and local execution are separated instead of collapsed into one vague trust claim.

## Where It Breaks Down

- The public design is mostly a promise surface. There is little visible detail about policy authoring, conflict resolution, emergency stop, redaction, or what happens when a rule blocks a task halfway through.
- "90% less tokens" is prominent, but the design does not show enough before/after evidence to help a skeptical developer evaluate context quality.
- Free beta and demo calls create uncertainty around procurement, pricing, and product maturity.

## Sources

- https://usesigil.ai/
- https://www.reddit.com/r/mcp/comments/1radi22/mcp_browser_agent_that_runs_inside_your_real/
- https://www.reddit.com/r/automation/comments/1qxj14h/browser_mcp_very_slow_and_flaky_whats_the_best/
