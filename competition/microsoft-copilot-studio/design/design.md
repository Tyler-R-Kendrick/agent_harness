# Microsoft Copilot Studio Design

## Look And Feel

- Two-tier authoring model: a lightweight Microsoft 365 Copilot Agent Builder embedded in the Copilot app, and a fuller Copilot Studio canvas for topics, actions, knowledge, channels, and orchestration.
- The default experience is conversational setup plus a configuration pane. Users describe an agent in natural language, see name/description/instructions update, then test with starter prompts.
- Full Copilot Studio inherits Power Platform patterns: left navigation, topic lists, node/canvas authoring, publish channels, environment governance, and admin-oriented settings.

## Design Tokens To Track

```yaml
surface: Microsoft 365 Copilot app, Teams, Copilot Studio web app, Power Platform admin surfaces
accent: Microsoft enterprise blue with Copilot gradient branding
primary_control: new agent, configure, test, publish
core_objects:
  - agent
  - topic
  - action
  - knowledge source
  - connector
  - channel
  - copilot credit
information_density: medium-to-high
```

## Differentiators

- The strongest design differentiator is distribution: agent creation starts inside the same Copilot and Teams surfaces where many employees already work.
- The lightweight builder reduces first-agent friction by letting users prompt an agent into existence without learning a full canvas.
- The full studio can escalate from simple declarative agents to topics, tools, knowledge, Power Automate, Microsoft Graph grounding, and admin controls.

## What Is Good

- Clear progressive path from prompt-built agent to configured enterprise agent.
- Preview and starter prompts keep the author close to the runtime conversation.
- Microsoft 365 context and identity permissions are a design advantage: the UI can feel native to files, Teams, SharePoint, and work chat rather than a separate automation console.

## Where It Breaks Down

- The product boundary is confusing: users distinguish Microsoft 365 Agent Builder, Copilot Studio, Power Automate, Copilot Chat, and Teams publishing only after encountering feature or licensing limits.
- Full Copilot Studio can feel like Power Platform administration, which is powerful but heavier than browser-first workflow authoring.
- Multi-agent orchestration and channel availability failures are hard to diagnose because routing, auth, publishing, and state constraints are spread across several Microsoft surfaces.

## Screenshot References

- Agent Builder natural-language setup: `https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/copilot-studio-agent-builder-build`
- Microsoft support walkthrough: `https://support.microsoft.com/en-us/microsoft-365-copilot/build-your-own-agent-with-microsoft-365-copilot`
- Topic authoring and orchestration docs: `https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-create-edit-topics`
