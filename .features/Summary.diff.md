# Summary Diff For Linear Feature Generation

Updated: 2026-05-26
Baseline: `.features/Summary.md` refreshed from the 2026-05-24 Hermes Agent-updated corpus.
Diff type: additive update after Pi feature refresh

## Net new normalized features

### Added: Extensible provider auth bridges with interactive login choices
- Why now: the Pi refresh shows that provider auth is no longer just a static settings page or env-var list. Pi now lets extension-defined providers plug directly into `/login`, choose their own auth path, and mutate the resulting model surface after authentication.
- Research delta:
  - Pi's current `custom-provider.md` lets extensions register new providers or override built-ins with proxy URLs, custom headers, dynamic model discovery, and provider-specific OAuth flows
  - release `v0.73.1` added interactive OAuth login selection, so a provider can present choices like browser OAuth vs device code from inside the main login flow
  - the provider docs show a clear auth precedence order across CLI flags, `auth.json`, env vars, and custom-provider sources, which makes extension-defined providers feel like first-class runtime citizens instead of bolt-on hacks
  - custom providers can also refresh tokens and reshape the visible model catalog after login, for example switching region-specific base URLs based on returned credentials

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: the Pi package surface has matured from "install a bundle" into a richer distribution and governance layer.
- Research delta:
  - package docs now define gallery preview metadata via `pi.video` and `pi.image`, giving packages a first-class showcase surface instead of only README-driven discovery
  - package installs support global, project, and ephemeral single-run scopes, while project package entries auto-install on startup
  - settings-level filters can narrow a package down to exact `extensions`, `skills`, `prompts`, or `themes`, and the docs define deterministic deduplication when the same package exists in both global and project scopes

### Added: Add extension-defined provider auth flows with interactive login choices
- Why now: `agent-browser` already owns provider configuration, policy checks, and app-level auth surfaces, but adding a new gateway, enterprise SSO-backed provider, or subscription-restricted model family still tends to require bespoke product work instead of plugging into one consistent runtime contract.
- Linear issue:
  - Pending external publication in this session if the Linear plugin remains non-callable in this environment; the feature brief below is the canonical issue payload
- Linear issue title:
  - `Add extension-defined provider auth flows with interactive login choices`
- Suggested problem statement:
  - `agent-browser` can already store provider configuration and expose built-in model access, but custom gateways, enterprise SSO-backed providers, and subscription-shaped model catalogs still require one-off integration work. That slows down support for new providers, duplicates auth logic across surfaces, and makes it hard for extensions or team-specific runtimes to behave like first-class providers. Users need a unified login and model-selection surface where provider adapters can define browser or device-code auth, token refresh, auth storage, provider overrides, and post-login model shaping without patching the harness core.`
- One-shot instruction for an LLM:
  - Implement extension-defined provider auth flows for `agent-browser`: let extensions register new providers or override built-ins, plug those providers into the main login UI, support interactive auth-path selection such as browser OAuth vs device code, persist and refresh credentials through the harness auth layer, allow post-login model-list shaping or regional endpoint selection, and surface each provider's auth mode, scopes, and effective model catalog in a first-class settings and runtime UI.
