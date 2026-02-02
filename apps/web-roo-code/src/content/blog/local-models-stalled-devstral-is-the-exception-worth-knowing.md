---
title: Local Models Stalled; Devstral Is the Exception Worth Knowing
slug: local-models-stalled-devstral-is-the-exception-worth-knowing
description: Local coding models have not kept pace with frontier APIs. Devstral is the one exception that handles agentic workflows reliably with 32GB VRAM.
primary_schema:
    - Article
    - FAQPage
tags:
    - local-models
    - devstral
    - agentic-coding
    - model-evaluation
status: published
publish_date: "2025-06-11"
publish_time_pt: "9:00am"
source: "Office Hours"
---

A year ago, the prediction seemed obvious: local models would catch up.

They did not.

## The expectation versus the reality

The pitch was compelling. Run capable coding models on your own hardware. No API costs. No latency to a data center. No sending your proprietary codebase to a third party.

Engineering teams started evaluating options. Some bought GPUs. Some spun up cloud instances. The assumption: by now, local models would handle agentic workflows as well as frontier APIs.

That assumption broke.

Cloud models kept shipping improvements. Local models for coding stagnated. The gap did not close. It widened.

> "About a year ago I thought local models were going to just progress insanely fast for coding in particular and that just has not happened. In fact I would say like they've kind of stagnated to a point."
>
> Adam, [Office Hours S01E09](https://www.youtube.com/watch?v=QZkxzxTu6Qo)

For teams that invested in local infrastructure, this is frustrating. The hardware is there. The motivation is there. The models are not.

## One exception: Devstral

Not every local model stalled. Devstral stands out.

The difference is in the details that matter for agentic coding: tool calling works reliably, and apply diff handles the back-and-forth of iterative changes without breaking.

> "There is one like shining model that has come out recently called Devstral that works insanely well."
>
> Adam, [Office Hours S01E09](https://www.youtube.com/watch?v=QZkxzxTu6Qo)

The hardware requirement is specific: 32GB of VRAM. That is a meaningful constraint. It rules out most laptops and many workstations. But for teams with the hardware or the budget to acquire it, Devstral delivers.

> "If you can get 32 gigs of VRAM and you can run Devstral model, I could code all day with that and be quite okay."
>
> Adam, [Office Hours S01E09](https://www.youtube.com/watch?v=QZkxzxTu6Qo)

"Code all day" is the bar. Not "handles simple completions." Not "works for prototypes." Productive, sustained coding work.

## The tradeoff

Devstral is not a replacement for frontier API models on every task. The context window is smaller. The reasoning on ambiguous problems is less robust. When you need maximum capability, you still need Claude or GPT-4 class models.

The tradeoff is clear: Devstral gives you local execution (no API costs, no latency, no data leaving your machine) in exchange for narrower capability. For straightforward coding tasks with clear requirements, that trade works. For complex refactors or ambiguous debugging, you may still want the API.

## Local models versus frontier APIs

| Dimension                | Local Models (Most)      | Devstral                  | Frontier APIs              |
| ------------------------ | ------------------------ | ------------------------- | -------------------------- |
| Tool calling reliability | Inconsistent or broken   | Works reliably            | Production-grade           |
| Apply diff handling      | Often fails on iteration | Handles iterative changes | Robust                     |
| Context window           | Limited                  | Smaller than APIs         | Large (100K+)              |
| Data privacy             | Full control             | Full control              | Depends on provider policy |
| Cost per token           | Zero after hardware      | Zero after hardware       | Pay per use                |

## How Roo Code supports model flexibility

Roo Code operates on a BYOK (Bring Your Own Key) model, which means you choose the provider and model that fits your workflow. Run Devstral locally through Ollama or LM Studio, connect to Claude or GPT-4 through their APIs, or mix approaches based on the task.

The agent closes the loop regardless of which model you choose: it proposes diffs, runs commands and tests, and iterates based on results. Your model selection determines capability ceiling and cost structure, but the agentic workflow stays consistent.

**For teams evaluating local models, Roo Code lets you test Devstral against frontier APIs in identical workflows without changing your tooling.**

## What this means for evaluation

If your team is evaluating local models, here is the shift: stop chasing every new release.

The local model space for coding has not kept pace. Testing each new announcement costs engineering time. Most of those models will not handle agentic workflows well enough to be productive.

Instead, narrow your focus. Devstral is the current exception. Set up the hardware, run Devstral, and stop watching the local model leaderboards for a while.

If something changes, you will hear about it. Until then, the signal-to-noise ratio on local model announcements is low.

## Why this matters for your team

For a Series A or B engineering team running lean, the local model question is not academic. API costs compound. Data handling policies matter. The promise of capable local models would solve real problems.

The honest answer: that promise has not materialized broadly. One model works. Most do not.

If you have 32GB of VRAM available (or can budget for it), Devstral is worth the setup time. If you do not, the current answer is still API models, and the local alternative is not close enough to justify the evaluation overhead.

Narrow your focus. Test Devstral if you have the hardware. Stop chasing announcements that do not ship agentic capability.

## Frequently asked questions

### Why have local coding models stagnated while cloud models improved?

Cloud providers have significant resources for training data, compute, and iteration speed. Local models face stricter size constraints to run on consumer hardware. The research focus has shifted toward larger frontier models rather than efficient small models optimized for coding.

### What VRAM do I need to run Devstral effectively?

Devstral requires 32GB of VRAM for productive use. This rules out most laptops and consumer GPUs. Teams typically run it on workstations with RTX 4090 cards, A6000 GPUs, or cloud instances with equivalent specs.

### Can I use Devstral with Roo Code for agentic workflows?

Yes. Roo Code supports local models through Ollama, LM Studio, and other local inference tools. Configure Devstral as your model provider, and Roo Code handles tool calling, diff application, and iterative coding the same way it does with API models.

### Should I wait for better local models or use APIs now?

Use APIs now if you need agentic coding capability. The local model space has not delivered on earlier promises. If you have 32GB VRAM available, test Devstral as your local option, but do not delay productive work waiting for local models to catch up.

### What tasks work well with Devstral versus frontier APIs?

Devstral handles straightforward coding tasks with clear requirements: implementing well-defined features, writing tests against known interfaces, and standard refactors. Use frontier APIs for complex debugging, ambiguous requirements, large context windows, and tasks requiring stronger reasoning.
