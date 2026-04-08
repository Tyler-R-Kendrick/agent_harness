# Copilot Instructions

- Do not leave production code unimplemented, shimmed, or stubbed. Only tests may use fakes, stubs, or mocks when needed.
- Before finalizing a PR, run the relevant automated checks for the changed area and fix failures rather than documenting them as follow-up work.
- When a PR creates or changes UI, use Playwright to capture screenshots for each impacted screen and include those screenshots in the PR changeset.
- Maintain Playwright examples/specs for each implemented user-facing feature so the screenshots can be reproduced.
