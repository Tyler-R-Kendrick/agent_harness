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

- `score`: `1.0` only if the answer lists actual named entities of the requested subject, uses source-backed links, includes location/proximity evidence for local requests, and rejects page chrome. Exception: when the Expected Contract explicitly expects `insufficient`, `blocked`, or `no-publish`, `score` can be `1.0` for an honest insufficient-evidence/blocking answer that publishes no fabricated entity list and no page-chrome entities.
- `hits`: criteria satisfied.
- `misses`: criteria failed.
- `reasoning`: concise explanation.

The Expected Contract may include a `validationContract` object. Treat every required constraint in that object as a hard gate unless the contract says `successSemantics: allow-partial-with-acknowledgement` and the answer explicitly names the unmet constraint. This includes arbitrary constraints such as count, subject/type, location/proximity, exclusions, name prefixes/suffixes, rhyme targets, impossible or fictional locations, source evidence, and link requirements.

Hard fail with `score: 0.0` if the answer renders page chrome, navigation labels, account links, ticketing/header labels, trailers, featured/content buckets, schedule/zip-code controls, aggregate/list-page titles, generic directory labels, or stale prior-turn subjects as requested entities. Examples that must fail include `Moviefone TV`, `Sign In/Join`, `FanClub`, `Fandango Ticketing Theaters My`, `Featured Movie Animal Farm`, `Movie Showimes`, `IL 60004 Update Zipcode Monday`, `Yelp: Best Bars in Arlington Heights, IL`, `Chicago Bound: Arlington Heights' Best Bars`, `Yellow Pages: Bars in Arlington Heights`, `Restaurantji: Best Bars near Arlington Heights`, and `Restaurant Guru: Top 7 pubs & bars`.

For follow-up count cases, treat the requested count as a hard contract. If the Expected Contract requires three additional entities, an answer with one or two entities is a failure unless it explicitly says it could only verify fewer than requested and does not present the short list as success.
