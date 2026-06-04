# ServiceNow AI Agents Design

## Look And Feel

- ServiceNow frames the UI as an AI control tower: agents, workflows, approvals, governance, ROI, observability, and kill-switch controls.
- AI Agent Studio is language-first and no-code oriented, while AI Agent Orchestrator coordinates teams of agents against business goals.
- Build Agent extends ServiceNow Studio and coding tools, bringing governed app and agent creation into Cursor, Windsurf, Claude Code, and GitHub Copilot.

## Design Tokens To Track

```yaml
surface: ServiceNow AI Platform, AI Agent Studio, ServiceNow Studio, AI Control Tower
accent: ServiceNow green with enterprise workflow branding
primary_control: build agent, orchestrate, approve, observe, shut down
core_objects:
  - AI agent
  - specialist
  - orchestrator
  - workflow
  - approval
  - MCP server
  - control tower policy
information_density: high
```

## Differentiators

- The most distinct design idea is governance as the primary product surface, not a secondary admin page.
- AI Control Tower explicitly addresses agent sprawl by discovering, observing, governing, securing, measuring, and pausing AI systems across the enterprise.
- Build Agent connects ServiceNow app/agent development to popular coding agents while keeping ServiceNow context and governance attached.

## What Is Good

- Strong fit for ITSM, HR, security, risk, customer service, and operational workflows that already depend on ServiceNow records.
- Approval and control-tower framing maps to executive worries about unsanctioned agents, hidden costs, and unmanaged permissions.
- The product tells a coherent "autonomous workforce" story that spans building, orchestrating, monitoring, and governing agents.

## Where It Breaks Down

- The broad platform story can feel abstract until a customer has clean ServiceNow data, service maps, approvals, and integrations.
- Dense governance surfaces risk overwhelming users who only need a transparent browser or app workflow trace.
- Agent success is constrained by real enterprise messiness: stale CMDB records, context scattered across tools, and approvals that live outside ServiceNow.

## Screenshot References

- AI Agents product page: `https://www.servicenow.com/products/ai-agents.html`
- AI Control Tower docs: `https://www.servicenow.com/docs/r/intelligent-experiences/ai-control-tower/ai-control-tower-landing.html`
- Build Agent release: `https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-Build-Agent-now-works-inside-every-major-AI-coding-tool-governed-by-default/default.aspx`
