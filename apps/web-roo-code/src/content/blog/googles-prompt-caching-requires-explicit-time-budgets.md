---
title: Google's Prompt Caching Requires Explicit Time Budgets
slug: googles-prompt-caching-requires-explicit-time-budgets
description: Google Vertex prompt caching works differently from Anthropic - you must declare TTL upfront. Learn how time-based caching affects multi-provider LLM architectures and cost management.
primary_schema:
    - Article
    - FAQPage
tags:
    - prompt-caching
    - google-vertex
    - multi-provider
    - cost-optimization
status: published
publish_date: "2025-05-07"
publish_time_pt: "9:00am"
---

```python
cache_ttl = 300  # seconds

That line is not a performance optimization. It is a policy decision.

## The assumption that breaks

You've got prompt caching working on Anthropic. Latency dropped. Costs dropped. The system prompt doesn't get re-processed every call. You decide to add Google Vertex as a fallback provider.

Then your costs spike. Or your latency spikes. Or both.

The symptom looks like a bug: requests that should be cached aren't. The caching you thought was happening silently isn't. You check the logs, compare the prompts, diff the configurations. Everything looks identical to what works on Anthropic.

The problem is the mental model. On Anthropic, caching works automatically based on content. On Google Vertex, you have to declare what to cache and for how long.

## The mechanism

Google's caching requires explicit time budgets. Five minutes. Ten minutes. Twenty minutes. You pick a window, and if your session outlives that window, the cache expires. The next request pays full price.

> "So for Google, you basically have to do what you're going to cache and invoke that caching for a certain amount of time. So you have to say: let's cache the system prompt or this user prompt for five minutes, 10 minutes, 20 minutes."
>
> Thibault, [Office Hours S01E05](https://www.youtube.com/watch?v=Wa8ox5EVBZQ)

This isn't a minor implementation detail. It changes your caching strategy from "what content to cache" to "how long will this session last."

The structure is unfamiliar. If you've built caching logic around content hashing and automatic invalidation, Google's time-based model requires a different approach entirely.

> "It was a totally new structure. We've never seen it before."
>
> Thibault, [Office Hours S01E05](https://www.youtube.com/watch?v=Wa8ox5EVBZQ)

## The tradeoff

The time budget forces you to predict session behavior upfront. Set the TTL too short and you pay for re-caching mid-session. Set it too long and you're paying for cache storage you don't need.

Neither is catastrophic. But if you're running cost-sensitive workloads across multiple providers, the unpredictability adds up.

The implementation complexity is also real. Abstracting over multiple caching strategies means your provider layer needs to know things about session duration that it previously didn't care about.

> "The way you do it technically is a nightmare."
>
> Thibault, [Office Hours S01E05](https://www.youtube.com/watch?v=Wa8ox5EVBZQ)

"Nightmare" is strong language, but the frustration is understandable. When you expect caching to be a transparent optimization and it becomes a configuration surface with failure modes, the debugging time compounds.

## Why this matters for your team

For a Series A team running multi-provider setups, this creates a specific kind of risk: silent cost drift.

You test on one provider. Caching works. You add a second provider for redundancy or capability reasons. You assume caching works the same way. It doesn't. Your cost projections are now wrong, and you won't notice until the bill arrives or someone digs into latency metrics.

The fix isn't complicated, but it requires awareness. Your provider abstraction layer needs to handle caching strategy per-provider, not per-content. Session duration becomes a parameter you track, not something you ignore.

If you're building with multiple LLM providers, audit your caching assumptions. What works transparently on one provider may require explicit configuration on another.

The first step: check whether your Google Vertex integration is actually caching, or just pretending to.

## How Roo Code handles multi-provider caching complexity

Roo Code's BYOK (Bring Your Own Key) architecture means you connect directly to providers like Anthropic, Google Vertex, and OpenAI using your own API keys. This direct connection gives you full visibility into provider-specific behaviors - including caching mechanics - without an abstraction layer hiding the differences.

When Roo Code closes the loop by executing tasks, running tests, and iterating on results, each provider interaction uses your configured keys with transparent cost tracking. You see exactly what's happening with each provider, including whether caching is working as expected.

**For teams managing multi-provider LLM deployments, understanding provider-specific caching behavior is essential for accurate cost forecasting and performance optimization.**

## Comparison: content-based vs. time-based caching

| Dimension | Content-based caching (Anthropic) | Time-based caching (Google Vertex) |
|-----------|-----------------------------------|-----------------------------------|
| Cache trigger | Automatic on matching content | Explicit TTL declaration required |
| Configuration | Minimal - content determines caching | Requires session duration prediction |
| Failure mode | Silent hits/misses based on content hash | Cache expiration mid-session |
| Cost predictability | High - consistent per-content | Variable - depends on TTL accuracy |
| Debugging complexity | Check content matching | Check TTL settings and session timing |

## Frequently asked questions

### Why does my Google Vertex caching cost more than expected?

Google Vertex requires you to declare a TTL (time-to-live) for cached content upfront. If your session outlives the TTL, the cache expires and subsequent requests pay full price. Unlike content-based caching where matching prompts automatically hit the cache, Vertex's time-based model means you're paying for re-caching whenever sessions exceed your declared window.

### How do I know if my prompt caching is actually working?

Check your provider's usage dashboard for cache hit rates. For Google Vertex specifically, compare your actual session durations against your configured TTL values. If sessions regularly exceed TTL, you're likely paying for re-caching without realizing it. Monitor latency metrics as well - uncached requests will show higher latency than cached ones.

### Can I use the same caching strategy across all LLM providers?

No. Provider caching implementations differ fundamentally. Anthropic uses content-based automatic caching, while Google Vertex requires explicit time budgets. Your provider abstraction layer needs to handle caching strategy per-provider, which means tracking session duration for time-based providers even if you ignored it for content-based ones.

### How does Roo Code help manage provider-specific differences?

Roo Code's BYOK model connects you directly to each provider with your own API keys. This transparency means provider-specific behaviors like caching mechanics, rate limits, and pricing are visible to you - not hidden behind an opaque abstraction layer. You maintain full control over provider configuration and can audit caching behavior per-provider.

### What TTL should I set for Google Vertex caching?

Analyze your actual session durations before picking a TTL. If most sessions complete in under five minutes, a 300-second TTL works. If you have longer coding sessions or debugging cycles, extend the TTL accordingly. The tradeoff: longer TTLs mean paying for cache storage even when sessions end early, while shorter TTLs risk mid-session cache expiration.

```
