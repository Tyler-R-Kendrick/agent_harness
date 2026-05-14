# Disk Context Caching For Long-Running Agent Loops

- Harness: DeepSeek
- Sourced: 2026-05-14

## What it is
DeepSeek enables request-prefix caching by default, so repeated long-context agent turns can reuse persisted prompt segments and expose explicit cache-hit accounting.

## Evidence
- Official docs: [Context Caching](https://api-docs.deepseek.com/guides/kv_cache)
- First-party details:
  - DeepSeek says its disk-based context caching is enabled by default for all users
  - overlapping request prefixes can be fetched from cache instead of recomputed
  - the docs explain how cache prefix units are persisted across request boundaries for conversations and long-document Q&A
  - API responses expose `prompt_cache_hit_tokens` and `prompt_cache_miss_tokens`
  - DeepSeek notes the cache system is best-effort and usually persists for hours to days
- Latest development checkpoint:
  - the current docs still describe this as a live default behavior, which makes it part of DeepSeek's present-day agent-economics story rather than an optional historical optimization

## Product signal
DeepSeek is treating long-running agent loops as an operational workload that needs cost and latency controls at the transport layer, not only better prompting.
