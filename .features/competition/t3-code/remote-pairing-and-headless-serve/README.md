# Remote Pairing And Headless Serve

- Harness: T3 Code
- Sourced: 2026-04-29

## What it is
T3 Code can expose a local or remote backend to other devices, pairing them through one-time credentials, shareable links, or QR codes.

## Evidence
- Remote access doc: [REMOTE.md](https://raw.githubusercontent.com/pingdotgg/t3code/main/REMOTE.md)
- First-party details:
  - the desktop app can enable network access and generate a pairing link
  - `t3 serve` runs the server headlessly and prints a connection string, pairing token, pairing URL, and QR code
  - the docs explicitly describe connecting from another device such as a phone, tablet, or another desktop app
  - access can later be inspected or revoked through `t3 auth`

## Product signal
T3 Code is turning a local coding harness into a remotely steerable service, which overlaps with the broader trend toward multi-device agent continuity.
