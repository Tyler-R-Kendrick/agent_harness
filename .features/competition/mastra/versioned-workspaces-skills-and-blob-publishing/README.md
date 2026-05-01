# Versioned Workspaces, Skills, And Blob Publishing

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra gives workspaces and skills first-class storage domains with versioning, plus a draft-to-publish workflow backed by a content-addressable blob store, so agent context and reusable skills behave more like deployable artifacts.

## Evidence
- Official changelog: [Mastra Changelog 2026-02-19](https://mastra.ai/blog/changelog-2026-02-19)
- First-party details:
  - Mastra says workspaces and skills now have CRUD and versioning across common databases.
  - The same release says skills support a filesystem-native draft-to-publish workflow backed by a BlobStore with S3 support.
  - Skill discovery can use globs, direct directory paths, or direct `SKILL.md` paths, and inaccessible configured skill paths degrade to warnings instead of failing the whole discovery process.
- Latest development checkpoint:
  - the February 19, 2026 release positions workspaces and skills as persistent runtime assets that can be iterated locally and hydrated as immutable versions later

## Product signal
Mastra is moving skills and workspace state toward the same lifecycle discipline teams already expect for builds and deployments. That suggests harness platforms will increasingly need publishable, versioned workflow assets rather than loose local prompt files.
