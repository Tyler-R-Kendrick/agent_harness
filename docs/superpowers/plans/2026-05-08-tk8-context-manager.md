# TK-8 Context Manager

## Feature Summary

The Context Manager is a first-class Agent Browser chat agent and runtime context layer. It compresses older conversation history into chapter summaries, keeps recent turns raw, and preserves important tool output references without replaying full large payloads into every downstream model call.

## User Flow

- Select `Context Manager` from the partner-agent selector.
- Choose a context mode in Settings: `lean`, `standard`, `deep`, or `caveman`.
- Toggle compressed transcript cards on or off.
- Configure large tool-output caching thresholds for inline versus file-backed preservation.
- Review context cards in the transcript and expand originals when needed.
- Inspect chapter summaries and cached tool-output references in History.

## Integration Notes

- The agent is implemented under `agent-browser/src/chat-agents/ContextManager/` and wired through the existing chat-agent provider registry.
- Runtime prompt paths now call `buildContextManagedMessages` so partner agents receive managed context rather than raw long transcripts.
- Session chaptering owns context-manager state, chapter summaries, token-budget snapshots, and tool-output cache metadata.
- Visual smoke coverage seeds a managed transcript and verifies the settings/history/transcript surfaces.

## Verification

- `npm.cmd --workspace agent-browser run test -- src/services/sessionChapters.test.ts src/chat-agents/ContextManager/index.test.ts src/chat-agents/index.test.ts`
- `npm.cmd --workspace agent-browser run lint`
- `npm.cmd --workspace agent-browser run smoke:context-manager`
- `npm.cmd run visual:agent-browser`
- `npm.cmd run verify:agent-browser`
