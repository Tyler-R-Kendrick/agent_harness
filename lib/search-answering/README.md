# @agent-harness/search-answering

`@agent-harness/search-answering` contains pure utilities for deciding when a web-search request can be answered directly from fetched source results and for formatting that answer consistently.

Use this package when a caller already has search results and needs deterministic answer shaping without coupling that formatting logic to browser, agent, or provider runtimes.

## Public API

Import from the package root:

```ts
import {
  canAnswerFromSourceResults,
  composeSourceResultAnswer,
  formatUnavailableSearchMessage,
  isDirectSourceSearchIntent,
} from '@agent-harness/search-answering';
import type {
  DirectSourceSearchIntent,
  SourceSearchResult,
} from '@agent-harness/search-answering';
```

## Package Boundary

`@agent-harness/search-answering` exposes one stable public import path:
`@agent-harness/search-answering`. Package consumers should import values and
types from that root entry point instead of reaching into implementation files.

Source files under `@agent-harness/search-answering/src/*` are private package
internals. They are shipped only because this workspace consumes TypeScript
source directly through the package export map, not because deep imports are a
supported API.

Published package artifacts are intentionally limited to README.md, package.json, and runtime source files.
Tests, coverage output, local configs, and package-internal fixtures are excluded from the npm package.

### `isDirectSourceSearchIntent(intent)`

Returns `true` only for direct source lookups that should be answered with current web results instead of entity-ranking or location-aware search flows.

The current contract accepts requests such as documentation, API reference, release, status, website, or "latest/current" lookups when all of the following are true:

- `externalSearchRequired` is `true`
- `locationRequired` is `false`
- `requestedCount` is unset or `0`
- `rankingGoal` is unset, `current`, or `recommended`
- `validationConstraints` does not include list-shaping constraints such as `count`, `location`, `name_prefix`, `name_suffix`, `rhyme`, or `exclusion`

### `canAnswerFromSourceResults({ intent, searchResult })`

Returns `true` when the request is a direct source lookup and the search provider returned at least one result with `status: 'found'`.

Use this as the final gate before composing a direct answer from fetched search results.

### `composeSourceResultAnswer({ subject, results, limit, maxSnippetLength })`

Formats a short markdown answer that starts with:

```txt
Here are web results for <subject>:
```

Each result is rendered as a numbered markdown link with an optional snippet:

```txt
1. [Title](https://example.com) - Snippet text
```

Behavior details:

- Empty result sets return `I could not find search results for <subject>.`
- `limit` defaults to `3`
- Snippets are whitespace-normalized before truncation
- Empty snippets are omitted rather than rendered as trailing punctuation

### `formatUnavailableSearchMessage({ answerSubject, location, reason })`

Formats a deterministic fallback when web search is unavailable:

```txt
Web search is unavailable for OpenAI docs.
```

If a location is present, it is appended as `near <location>`. If a provider issue is present, it is appended on a new `Search issue:` line.

## Minimal example

```ts
import {
  canAnswerFromSourceResults,
  composeSourceResultAnswer,
} from '@agent-harness/search-answering';
import type {
  DirectSourceSearchIntent,
  SourceSearchResult,
} from '@agent-harness/search-answering';

const intent: DirectSourceSearchIntent = {
  currentTaskText: 'latest OpenAI Responses API tool calling docs',
  subject: 'OpenAI Responses API tool calling docs',
  externalSearchRequired: true,
  locationRequired: false,
  validationConstraints: [],
};

const searchResult: SourceSearchResult = {
  status: 'found',
  query: 'OpenAI Responses API tool calling docs',
  results: [{
    title: 'OpenAI Responses API tool calling guide',
    url: 'https://platform.openai.com/docs/guides/tools',
    snippet: 'The OpenAI Responses API guide documents tool calling.',
  }],
};

if (canAnswerFromSourceResults({ intent, searchResult })) {
  const answer = composeSourceResultAnswer({
    subject: intent.subject,
    results: searchResult.results,
  });

  console.log(answer);
}
```

Expected output:

```txt
Here are web results for OpenAI Responses API tool calling docs:

1. [OpenAI Responses API tool calling guide](https://platform.openai.com/docs/guides/tools) - The OpenAI Responses API guide documents tool calling.
```

## Validation

Run the package-local coverage suite:

```bash
npm.cmd --workspace @agent-harness/search-answering run test:coverage
```

This package keeps its contract coverage in [`src/__tests__/sourceResults.test.ts`](./src/__tests__/sourceResults.test.ts), including:

- accepted and rejected direct-source intent patterns
- positive and negative answerability checks
- result formatting, snippet truncation, and empty-result behavior
- unavailable-search fallback formatting
