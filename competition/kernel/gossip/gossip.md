# Kernel Gossip

## Positive Signals

- Kernel publishes direct migration guidance from Scrapybara, positioning itself as an active replacement path for teams affected by vendor churn.
- Pricing docs are detailed and transparent compared with many browser automation vendors.
- The direct agent-browser integration page is a strong ecosystem signal for this repo.

## Negative Signals

- The same migration framing highlights category risk: browser-agent infrastructure vendors can change availability, pricing, or product direction quickly.
- Paid-tier gates around profiles, managed auth, replays, and file transfers may block serious evaluation for small teams.
- Standby mode reduces idle cost but still counts against on-demand concurrency limits.

## Bug And UX Risk Themes

- Stealth and CAPTCHA handling can create a false sense of reliability if workflows lack explicit verification.
- Profile persistence is powerful but can make auth state, data retention, and cleanup policies harder to reason about.
- Cloud provider integration means agent-browser users must debug across local client, provider session, CDP transport, and target website.

## Sources

- https://www.kernel.sh/docs
- https://www.kernel.sh/docs/info/pricing
- https://www.kernel.sh/docs/integrations/agent-browser
- https://www.kernel.sh/docs/reference/cli/browsers
- https://www.onkernel.com/docs/browsers/stealth/
- https://www.kernel.sh/docs/migrations/scrapybara
