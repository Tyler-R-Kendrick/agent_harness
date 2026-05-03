# Assertion Patterns

Prefer assertions that are easy to verify and hard to misread.

## Good assertion qualities

- Objective and concrete.
- Tied to user-visible success criteria.
- Resistant to accidental false positives.

## Common assertion types

- `contains` for exact expected text or markers.
- `equals` for fully deterministic output values.
- `matches` for constrained structured output.

Avoid vague assertions such as "looks good" or "is high quality".