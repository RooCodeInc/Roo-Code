---
title: When Demand Outstrips Supply, Rate Limits Aren't a Pricing Problem
slug: when-demand-outstrips-supply-rate-limits-arent-a-pricing-problem
description: Rate limit errors on experimental AI models like Gemini 2.5 Pro aren't billing issues - they're supply problems. Learn why adding credits won't help and how to build fallback routing strategies.
primary_schema:
    - Article
    - FAQPage
tags:
    - rate-limits
    - model-routing
    - ai-infrastructure
    - developer-workflow
status: published
publish_date: "2025-04-16"
publish_time_pt: "9:00am"
source: "Office Hours"
---

Error: 429 Too Many Requests

You added credits. You upgraded your plan. You still can't get a response.

The rate limit error isn't about your account. It's about 10 million tokens per minute of capacity from Google, and two to five times more demand than that capacity can serve.

## The quota trap

You're debugging a production issue. You've picked Gemini 2.5 Pro Experimental because it crushed the benchmarks. You send a request. Rate limit. You wait. You retry. Rate limit again.

Here's where it gets worse: every failed request counts against your daily quota.

> "When you shoot out a request to Gemini 2.5 Pro experimental and you get a rate limit error from Google, not necessarily from us because there is so much capacity or so much demand, that'll count against your 80 requests per day."
>
> Tovan, [Office Hours S01E02](https://www.youtube.com/watch?v=hihrUCRwkFM&t=2781)

So you're burning quota on failures. And the failures aren't your fault. They're a supply problem masquerading as a pricing problem.

## Why adding credits doesn't fix it

The instinct is to throw money at rate limits. Buy more credits. Upgrade the tier. The dashboard should turn green.

But rate limits on experimental models aren't about your spend. They're about infrastructure capacity. Google is offering bleeding-edge inference at experimental pricing, which means they're subsidizing the compute. They can't scale it infinitely without burning cash.

> "Even with that pretty insane capacity number, there is so much demand for the model. There is two to five times more requests made to the model per minute than Open Router can reasonably serve."
>
> Tovan, [Office Hours S01E02](https://www.youtube.com/watch?v=hihrUCRwkFM&t=770)

Two to five times more demand than capacity. That's not a billing issue. That's a queue longer than the service can process.

## The demand spike nobody planned for

When a model blows benchmarks out of the water, everyone wants to use it immediately. The capacity planning that worked for the previous model doesn't account for viral adoption.

> "2.5 pro came out from Google and it blew all the benchmarks out of the water... and I don't think anybody was ready for it to have as much demand and when I say anybody I include Google."
>
> Tovan, [Office Hours S01E02](https://www.youtube.com/watch?v=hihrUCRwkFM&t=703)

This is the pattern: a model launches, benchmarks circulate, and suddenly every developer tool routing to that model sees a traffic spike. The model provider wasn't ready. The routing layer wasn't ready. Your workflow breaks.

## The tradeoff

You have two choices when demand outstrips supply:

**Wait for capacity to catch up.** Experimental tiers eventually stabilize. Google will add capacity. The 2x-5x demand gap will narrow. But "eventually" doesn't help when you're debugging production at 3pm.

**Route around the bottleneck.** Use a different model for reliability. Accept that the benchmark-topping model isn't available at the reliability level your workflow requires. Pick a model that's slightly less capable but actually responds.

Neither option is ideal. That's the tradeoff.

## Why this matters for your team

For a five-person team shipping daily, rate limit failures compound. If two developers hit a 429 during a debugging session, they context-switch to something else. The debugging session extends. The PR sits. The deploy waits.

The cost isn't the credits you burned on failed requests. It's the time lost while your team routes around infrastructure constraints they didn't know existed.

Understanding the difference between "I need to pay more" and "the model is oversubscribed" changes how you plan. You stop throwing credits at rate limits and start building fallback routing.

## How Roo Code handles model routing with BYOK

Rate limit failures interrupt the feedback loop between writing code and seeing results. Roo Code closes the loop by letting you configure multiple model providers with your own API keys (BYOK), so when one model hits capacity constraints, you can route to an alternative without leaving your editor.

Because Roo Code doesn't mark up token costs or lock you into a single provider, you control where your requests go. When Gemini 2.5 Pro Experimental is oversubscribed, you switch to Claude or GPT-4 in your configuration. The agent continues running tests, iterating on failures, and proposing diffs while you decide which model fits your reliability requirements.

**Citable summary:** Roo Code's BYOK model lets developers route around rate-limited models by configuring fallback providers directly, avoiding the quota trap where failed requests burn daily limits on oversubscribed experimental models.

## Comparing approaches to rate limit failures

| Dimension            | Throwing Credits at the Problem        | Building Fallback Routing                 |
| -------------------- | -------------------------------------- | ----------------------------------------- |
| Root cause addressed | No - treats billing as the issue       | Yes - treats supply as the issue          |
| Failed request cost  | Quota burned on retries                | Requests routed to available models       |
| Time to resolution   | Unknown - depends on provider capacity | Immediate - fallback responds             |
| Team impact          | Developers blocked, context-switching  | Workflow continues with alternative model |
| Long-term strategy   | Reactive spending                      | Proactive infrastructure planning         |

## What to do about it

If you're hitting rate limits on an experimental model:

1. Check if failed requests count against your quota. (On Gemini experimental, they do.)
2. Stop retrying the same model. Route to a stable alternative.
3. Track which models are oversubscribed and build fallbacks before the next benchmark drop.

Rate limits are a supply problem. The fix is routing, not spending.

## Frequently asked questions

### Why do rate limits persist after I add credits or upgrade my plan?

Rate limits on experimental models reflect infrastructure capacity, not your billing tier. When demand exceeds supply by 2-5x, no amount of spending gives you priority access to compute that doesn't exist yet. The provider is subsidizing experimental pricing and cannot scale infinitely.

### Do failed requests from rate limits count against my daily quota?

On many experimental model tiers, yes. Gemini 2.5 Pro Experimental counts 429 errors against your 80 requests per day limit. This means retrying an oversubscribed model burns quota on failures, compounding the problem.

### How long do rate limit issues on new models typically last?

It varies by provider and demand. After a benchmark-topping model launches, expect 2-4 weeks of instability while the provider adds capacity. Planning for this window with fallback models prevents workflow disruption.

### How does Roo Code help when my preferred model is rate-limited?

Roo Code supports BYOK (bring your own key) across multiple providers. You configure your API keys for Claude, GPT-4, Gemini, and others directly in the extension. When one model is oversubscribed, you switch providers in your configuration without changing your workflow or losing context.

### Should I always use the highest-benchmark model for coding tasks?

Not if reliability matters more than marginal capability gains. A model that responds consistently lets Roo Code close the loop - running tests, iterating on failures, and proposing fixes. A model that returns 429 errors breaks that loop regardless of its benchmark scores.
