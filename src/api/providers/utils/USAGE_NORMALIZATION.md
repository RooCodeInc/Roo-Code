# Usage Normalization (AI SDK Providers)

This folder centralizes usage/cache normalization for AI-SDK-backed providers.

## Canonical Contract

The normalizer derives a canonical usage shape before emitting stream chunks:

- `inputTokensTotal`
- `inputTokensNonCached` (optional)
- `outputTokens`
- `cacheWriteTokens`
- `cacheReadTokens`
- `reasoningTokens` (optional)
- `totalCostCandidate` (optional, provider-reported)

`ApiStreamUsageChunk` then carries:

- `inputTokens` (always total input tokens)
- `nonCachedInputTokens?`
- `outputTokens`
- `cacheWriteTokens?`
- `cacheReadTokens?`
- `reasoningTokens?`
- `totalCost?`

## Precedence Policy

For each metric, extraction precedence is:

1. `providerMetadata`
2. AI SDK `usage`
3. `usage.raw` fallback

This is implemented in `normalize-provider-usage.ts`.

## Profiles

`usage-profiles.ts` defines per-provider extraction profiles:

- The profile specifies candidate paths per metric for `providerMetadata`, `usage`, and `raw`.
- Profiles should contain field mapping only (no provider-specific arithmetic).
- Exceptions (e.g., custom pricing behavior) should be applied at call sites via `totalCostOverride`.

## New Provider Checklist

1. Add/confirm a profile in `usage-profiles.ts`.
2. Wire provider usage handling to `normalizeProviderUsage(...)`.
3. Ensure `inputTokens` emitted to stream remains total input tokens.
4. Add/extend provider usage tests for:
    - first-turn cache write heavy payload
    - second-turn cache read heavy payload
    - metadata vs usage conflicts
5. If provider has custom pricing logic, pass `totalCostOverride` explicitly and test it.
