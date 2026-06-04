# Salesforce Agentforce Design

## Look And Feel

- Agentforce inherits Salesforce's enterprise console style: dense setup pages, object-aware admin flows, CRM record context, builder previews, and Trailhead-style enablement.
- Builder concepts are business-labeled: agents, topics, instructions, actions, trust layer, Data 360, and Atlas reasoning.
- Marketplace design leans on AppExchange/AgentExchange browsing: partner listings, prebuilt agents, sub-agents, tools, and MCP servers.

## Design Tokens To Track

```yaml
surface: Salesforce setup, Agentforce Builder, CRM record pages, Slack, AgentExchange
accent: Salesforce blue and Agentforce 360 product branding
primary_control: create agent, configure topic, add action, test conversation, activate
core_objects:
  - agent
  - topic
  - instruction
  - action
  - Data 360 grounding
  - trust layer
  - flex credit
information_density: high
```

## Differentiators

- The design maps agents directly onto Salesforce metadata, CRM objects, permissions, and business processes.
- Topics and actions give admins a structured way to constrain what an agent can reason about and do.
- AgentExchange adds a marketplace surface around agent discovery, partner tools, Slack apps, MCP servers, and implementation expertise.

## What Is Good

- Strong fit for CRM, service, sales, marketing, commerce, and Slack workflows that already live in Salesforce.
- Trust Layer framing gives buyers concrete language around data masking, toxicity checks, audit trails, permissions, and governed action.
- Builder preview and topic/action decomposition make agent behavior more inspectable than a single prompt box.

## Where It Breaks Down

- The interface can feel like another Salesforce admin domain: powerful, but dependent on platform knowledge, Data 360 setup, and careful permission modeling.
- Product naming moves quickly across Agentforce, Agentforce 360, AgentExchange, Slack Marketplace, AppExchange, and Agentforce Coworker, which increases buyer and admin confusion.
- Variable conversation/action credit pricing can make the design feel less like a predictable agent tool and more like a consumption-metered enterprise platform.

## Screenshot References

- Agentforce developer guide: `https://developer.salesforce.com/docs/ai/agentforce/guide/get-started.html`
- Agentforce 360 platform page: `https://www.salesforce.com/platform/agentforce-platform/`
- Step-by-step Agentforce PDF with builder screens: `https://www.salesforce.com/en-us/wp-content/uploads/sites/4/Agentforce.pdf`
