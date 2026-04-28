# AgentEvals Entity Fulfillment Judge

Evaluate whether the candidate answer fulfills the current entity-seeking request.

## Question
{{input}}

## Criteria
{{criteria}}

## Expected Contract
{{expected_output}}

## Candidate Answer
{{output}}

Return JSON with:

- `score`: `1.0` only if the answer lists actual named entities of the requested subject, uses source-backed links, includes location/proximity evidence for local requests, and rejects page chrome.
- `hits`: criteria satisfied.
- `misses`: criteria failed.
- `reasoning`: concise explanation.

Hard fail with `score: 0.0` if the answer renders page chrome, navigation labels, account links, ticketing/header labels, trailers, featured/content buckets, schedule/zip-code controls, generic directory labels, or stale prior-turn subjects as requested entities. Examples that must fail include `Moviefone TV`, `Sign In/Join`, `FanClub`, `Fandango Ticketing Theaters My`, `Featured Movie Animal Farm`, `Movie Showimes`, and `IL 60004 Update Zipcode Monday`.
