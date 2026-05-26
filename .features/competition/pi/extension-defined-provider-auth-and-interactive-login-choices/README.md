# Extension-Defined Provider Auth And Interactive Login Choices

- Harness: Pi
- Sourced: 2026-05-26

## What it is
Pi lets extensions register or override model providers, plug custom auth into the main `/login` flow, and present provider-specific login choices such as browser OAuth vs device code instead of forcing every provider through one built-in auth path.

## Evidence
- Official providers docs: [docs/providers.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md)
- Official custom provider docs: [docs/custom-provider.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/custom-provider.md)
- Official releases page: [earendil-works/pi releases](https://github.com/earendil-works/pi/releases)
- First-party details:
  - `providers.md` says Pi supports subscription providers via OAuth, stores tokens in `~/.pi/agent/auth.json`, auto-refreshes expired credentials, and resolves auth in a clear precedence order across CLI flags, `auth.json`, env vars, and custom-provider configuration
  - `custom-provider.md` shows `pi.registerProvider()` overriding built-in providers or adding new ones, including proxy URLs, custom headers, dynamic model discovery, and provider-defined OAuth flows
  - the same docs show `OAuthLoginCallbacks.onSelect(...)`, which lets a provider surface multiple login options such as browser auth vs device code inside `/login`
  - custom providers can refresh tokens automatically and even mutate the visible model catalog after login, for example selecting a region-specific base URL from the returned token
- Latest development checkpoint:
  - release `v0.73.1` on 2026-05-07 explicitly calls out interactive OAuth login selection as a new feature, making provider-specific auth branching a first-class product capability rather than just an extension trick

## Product signal
Pi is moving provider auth and model access toward an extension-defined control plane. That matters because enterprise gateways, subscription-backed providers, and regional deployments can all behave like first-class built-ins without patching the harness core.
