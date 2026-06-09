# Cloud And Local Sandboxes With Policy And Snapshots

- Harness: GitHub Copilot
- Sourced: 2026-06-09

## What it is
GitHub Copilot now has first-party local and cloud sandboxes that isolate tool execution, expose tunable filesystem and network policy, and let cloud sessions stop and resume with saved state.

## Evidence
- Docs: [About cloud and local sandboxes for GitHub Copilot](https://docs.github.com/en/copilot/concepts/about-cloud-and-local-sandboxes)
- Docs: [Configuring local sandbox settings](https://docs.github.com/en/copilot/how-tos/cloud-and-local-sandboxes/configuring-local-sandbox-settings)
- Docs: [Enabling or disabling cloud and local sandboxes for GitHub Copilot for your organization](https://docs.github.com/en/copilot/how-tos/cloud-and-local-sandboxes/enabling-or-disabling-cloud-and-local-sandboxes-for-your-organization)
- Changelog: [Cloud and local sandboxes for GitHub Copilot now in public preview](https://github.blog/changelog/2026-06-02-cloud-and-local-sandboxes-for-github-copilot-now-in-public-preview/)
- First-party details:
  - local sandboxing runs Copilot on the user's own machine with restricted filesystem, network, and system-capability access
  - the Copilot CLI exposes `/sandbox` plus `General`, `Filesystem`, and `Network` controls, including working-directory inclusion, outbound-network toggles, local-network toggles, and host-specific rules
  - local sandboxing is documented across macOS, Linux, and Windows and can be centrally enforced through enterprise device-management policy
  - cloud sandboxing runs Copilot in fully isolated ephemeral Linux environments hosted by GitHub, started with `copilot --cloud`
  - cloud sessions can be `Active`, `Stopped`, or `Deleted`, and stopped sessions keep a snapshot so files, environment variables, and in-progress work can resume later
  - cloud sandbox policy shares the same governance surface as Copilot cloud agent, and GitHub exposes separate compute, memory, and snapshot-storage billing meters
- Latest development checkpoint:
  - GitHub moved sandboxes into public preview on 2026-06-02 and now documents them as the execution layer for Copilot CLI plus cloud-backed sessions in the Copilot app

## Product signal
GitHub is turning execution isolation into a harness-native capability instead of outsourcing it to ad hoc Docker setups or trusting the host machine by default.
