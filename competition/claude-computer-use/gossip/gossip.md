# Claude Computer Use Gossip

## Positive Signals

- Anthropic's launch made computer use a mainstream model-provider capability rather than a niche RPA experiment.
- Developers have a public quickstart and docs, making experimentation easier than building a screenshot-action loop from scratch.
- Security warnings are explicit, which helps serious buyers understand the implementation burden.

## Negative Signals

- Anthropic's docs emphasize that computer use has material security risks, including prompt injection and harmful external instructions.
- Public demos and community reports often show the same pattern: impressive when it works, slow or brittle when UI state changes.
- Because the feature is API-first, polish depends entirely on the host product.

## Bug And UX Risk Themes

- Screenshot-based operation can misclick or get stuck on dynamic interfaces.
- Long task latency is more visible than in structured APIs.
- The hardest product problem is not clicking; it is proving what happened and preventing unsafe actions.

## Sources

- https://www.anthropic.com/news/3-5-models-and-computer-use
- https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/computer-use-tool
- https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/computer-use-tool#security-considerations
- https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo
