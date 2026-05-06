# Browserbase + Stagehand Gossip

## Positive Signals

- Public docs claim large adoption for Stagehand, including 22k+ GitHub stars and 700k+ weekly downloads at the time captured.
- Reddit automation discussion praised fast session spin-up, stealth/fingerprinting, and Stagehand stability compared with custom pipelines.

## Negative Signals

- Reddit high-volume usage complaint focused on the one-minute billing floor for very short sessions and the need to batch tasks around it.
- GitHub issues show active rough edges including Cloudflare Workers logging support, CUA image handling, Anthropic model response wrapping, debug logging behavior, and model allowlists.

## Bug And UX Risk Themes

- Cost predictability matters for high-volume short tasks.
- AI primitives need semantic verification or they can still click/extract the wrong thing.
- Multi-provider model support is powerful but increases compatibility bugs.

## Sources

- https://docs.browserbase.com/welcome/what-is-browserbase
- https://docs.browserbase.com/introduction/stagehand
- https://github.com/browserbase/stagehand/issues
- https://www.reddit.com/r/automation/comments/1sl1um7/browserbase_review_after_running_10k_sessions/

