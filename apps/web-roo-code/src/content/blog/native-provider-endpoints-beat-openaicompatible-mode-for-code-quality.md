---
title: Native Provider Endpoints Beat OpenAI-Compatible Mode for Code Quality
slug: native-provider-endpoints-beat-openaicompatible-mode-for-code-quality
description: Learn why routing AI models through OpenAI-compatible gateways can silently degrade code quality, and how to diagnose thinking tokens, prompt caching, and context window issues.
primary_schema:
    - Article
    - FAQPage
tags:
    - llm-configuration
    - code-quality
    - model-endpoints
    - developer-productivity
status: published
publish_date: "2025-04-30"
publish_time_pt: "9:00am"
source: "Office Hours"
---

Same model. Same prompt. Different endpoint.

Different results.

If your team thinks Claude 3.7 "feels dumb," the problem might not be the model.

## The invisible configuration gap

Your developers are complaining. They tried Claude 3.7 Sonnet, the model everyone said would handle complex refactors. It didn't. It missed context, ignored edge cases, gave shallow suggestions. They switched back to GPT-4 and wrote off Claude as overhyped.

But here's what they didn't check: which endpoint were they actually hitting?

Many teams route all their model traffic through OpenAI-compatible gateways. It's convenient. One endpoint format, multiple models, simpler infrastructure. The gateway translates requests into whatever the underlying provider expects.

Except the translation isn't lossless.

> "Going through the provider specific endpoint can actually give like drastically different results. Like for Claude 3.7 people were thinking it was pretty dumb until they tried the Anthropic endpoint and they're like okay wait actually this is this is so much better than going through the OpenAI compatible one."
>
> David Leen, [Office Hours S01E04](https://www.youtube.com/watch?v=ZnKkwWuQ9QQ&t=1445)

The model is the same. The capability is the same. But the API layer between your tool and the model can silently misconfigure features that matter: thinking tokens, prompt caching, tool format handling.

## Where the translation breaks

Three places where OpenAI-compatible mode commonly loses fidelity:

**Thinking tokens.** Claude's extended thinking mode lets the model reason through complex problems before responding. But if the gateway doesn't pass the right parameters, thinking mode stays off. The model answers immediately instead of working through the problem. You get a confident, shallow response instead of a considered one.

The tricky part: you can't always tell it's broken.

> "Even if things like thinking isn't working, it's even tricky to figure out that it's not working until it's until it's too late because maybe the LLM didn't feel like spending tokens on thinking for that one particular question."
>
> David Leen, [Office Hours S01E04](https://www.youtube.com/watch?v=ZnKkwWuQ9QQ&t=1392)

The model doesn't error out. It just gives you a worse answer. And if you're evaluating models based on these worse answers, you're making decisions on corrupted data.

**Prompt caching.** Anthropic's prompt caching reduces costs and latency for repeated context. But caching configuration is provider-specific. A generic gateway might not set cache breakpoints correctly, or might not support caching at all. You pay full price for every request and wonder why Claude costs so much.

**Context window defaults.** Even when the underlying model supports 200k or more tokens, the gateway might default to 128k.

> "I've seen some people who didn't realize that we have sane defaults which are not that great where it's like 128k context window instead of 200,000 or a million."
>
> Matt Rubens, [Office Hours S01E04](https://www.youtube.com/watch?v=ZnKkwWuQ9QQ&t=1464)

Your developers truncate context to fit a limit that doesn't need to exist. The model sees less of the codebase. The suggestions get worse.

## The diagnostic checklist

If your team is unhappy with Claude performance, check these before switching models:

1. **Which endpoint are you hitting?** Native Anthropic, or OpenAI-compatible translation?
2. **Is thinking mode enabled?** Check request logs for `thinking` parameters.
3. **What's your context window limit?** Match it to the model's actual capability.
4. **Is prompt caching configured?** Look for cache hits in your billing.

These are infrastructure decisions, not model decisions. But they affect model quality directly.

## Why this matters for your team

For a Series A - C team running 50 model requests a day, the wrong configuration compounds. If thinking mode is silently disabled, every complex refactor suggestion is shallower than it should be. If context is truncated, every large-file edit misses relevant code. Your developers blame the model and switch tools instead of fixing the endpoint.

The cost isn't just the wasted token spend. It's the evaluation time spent on the wrong hypothesis.

## How Roo Code connects you to native provider endpoints

Roo Code uses a BYOK (bring your own key) model, which means you configure direct connections to each provider's native API. When you add your Anthropic API key, Roo Code hits Anthropic's endpoint directly. When you add your OpenAI key, it hits OpenAI directly. No translation layer sits between your prompt and the model.

This architecture means thinking tokens work when you enable them. Prompt caching works when the provider supports it. Context windows default to what the model actually supports, not what a gateway assumes.

**Roo Code's native provider integration ensures you get the full capability of each model without silent configuration degradation from translation layers.**

Because Roo Code closes the loop by running commands, tests, and iterating on results, model quality directly affects how well it handles complex multi-step tasks. A model with thinking mode silently disabled will produce shallower edits. A model with truncated context will miss relevant files. Native endpoints remove these hidden failure modes from your workflow.

## Comparing endpoint approaches

| Dimension       | OpenAI-Compatible Gateway                   | Native Provider Endpoints                 |
| --------------- | ------------------------------------------- | ----------------------------------------- |
| Thinking tokens | May be silently disabled or misconfigured   | Full support when enabled in request      |
| Prompt caching  | Often unsupported or incorrectly configured | Provider-native cache breakpoints         |
| Context window  | May default to lower limits (128k)          | Defaults to model's actual capability     |
| Debugging       | Harder to trace which features are active   | Direct visibility into request/response   |
| Cost visibility | Cache misses inflate bills without warning  | Accurate billing with cache hit reporting |

## The first check

Before you write off a model, verify you're hitting its native endpoint with the right configuration.

The model that "feels dumb" through a translation layer might work fine when you remove the middleman.

## Frequently asked questions

### Why does the same model give different results through different endpoints?

OpenAI-compatible gateways translate requests into a generic format, then convert them to each provider's native format. This translation can drop or misconfigure provider-specific features like thinking tokens, prompt caching, and context window settings. The model receives different parameters than you intended, producing different output quality.

### How can I tell if thinking mode is actually working?

Check your request logs for the `thinking` parameter being passed correctly. The difficulty is that models don't error when thinking mode is disabled. They simply respond without extended reasoning, giving you a faster but shallower answer. If complex refactors seem to miss edge cases, thinking mode configuration is a likely culprit.

### Does Roo Code use OpenAI-compatible endpoints or native provider APIs?

Roo Code connects directly to each provider's native API using your own API keys. When you configure an Anthropic key, requests go to Anthropic's endpoint. When you configure an OpenAI key, requests go to OpenAI's endpoint. This BYOK approach ensures provider-specific features like thinking tokens and prompt caching work correctly without translation layer interference.

### What's the actual cost difference between cached and uncached requests?

Anthropic's prompt caching can reduce costs by up to 90% for repeated context. If your gateway doesn't support caching or configures it incorrectly, you pay full price for every request. Check your billing dashboard for cache hit rates. If you're seeing zero cache hits on repeated workflows, your caching configuration is likely broken.

### Should I always use native endpoints instead of a unified gateway?

For production workflows where model quality matters, native endpoints provide the most reliable results. Unified gateways offer convenience for prototyping or when you need to rapidly switch between models. The tradeoff is between operational simplicity and guaranteed feature support. If you're evaluating model quality, always test against native endpoints first.
