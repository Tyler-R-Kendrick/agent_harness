# Agent Subthreads Implementation Notes

Linear: TK-11 Agent Subthreads

## Goal

Extend the existing conversation-branching foundation so branch work opens as a navigable chat subthread, can be steered while active, renders back into the main conversation, and becomes read-only after merge.

## Architecture Fit

This builds on the existing TK-12 branch state rather than creating another state tree:

- `agent-browser/src/services/conversationBranches.ts` remains the durable branch graph owner.
- Subthreads now carry an optional `sessionId`, letting the app reuse normal Agent Browser chat sessions and the existing `ChatMessageView` renderer.
- The main chat renders subthread transcripts inline through the same message renderer used for normal user/assistant turns.
- The subthread view shows a Back control to the main session.
- Merged subthreads are treated as completed work and block further chat submission.
- Steering messages in an active subthread append branch commits with the relevant user/assistant message IDs.

## TDD Evidence

RED attempts:

- `npm.cmd --workspace agent-browser run test -- src/services/conversationBranches.test.ts`
- `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx -t "starts and renders branching conversation controls"`

Earlier automation runs could not reach Vitest because the sandbox lacked hydrated dependencies. After dependency hydration was available, the App smoke regression failed twice on over-specific duplicate-render assertions:

- first because `conversation/research/branch-active-chat-thread` appears in both the branch transcript and History,
- then because `Branch started: Branch active chat thread` appears in three valid surfaces once the branch session is open.

GREEN checks:

- `npm.cmd --workspace agent-browser run test -- src/services/conversationBranches.test.ts` passed with 7 tests.
- `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx -t "starts and renders branching conversation controls"` passed.
- `npm.cmd --workspace agent-browser run lint` passed.
- `npm.cmd --workspace agent-browser run test:scripts` passed.
- `npm.cmd run visual:agent-browser` passed and captured `docs/superpowers/plans/2026-05-08-agent-subthreads-visual-smoke.png`.

Full gate:

- `npm.cmd run verify:agent-browser` passed end to end, including source hygiene, eval validation/tests, script regressions, eval workflow tests, extension lint/coverage/build, Agent Browser lint/coverage/build, audit lockfile, audit, and visual smoke.
