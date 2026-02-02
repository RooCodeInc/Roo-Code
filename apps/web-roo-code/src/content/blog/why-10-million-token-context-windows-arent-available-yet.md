---
title: Why 10 Million Token Context Windows Aren't Available Yet
slug: why-10-million-token-context-windows-arent-available-yet
description: The model exists but the endpoint doesn't. Learn why announced context windows don't match API reality and how cluster economics block long-context inference.
primary_schema:
    - Article
    - FAQPage
tags:
    - context-windows
    - llm-infrastructure
    - ai-engineering
    - gpu-economics
status: published
publish_date: "2025-04-16"
publish_time_pt: "9:00am"
source: "Office Hours"
---

The model exists. The endpoint doesn't.

That's the gap no one explains when they announce a 10 million token context window in a press release.

## The math that breaks

You've read the announcements. Gemini 1.5 Pro with 10 million tokens. The future is here. Except when you try to use it through an API, the context limit is much smaller. Or the latency makes it unusable for real work. Or the endpoint simply isn't available.

The constraint isn't the model. It's the cluster economics.

Serving a 10 million context window request requires a dedicated cluster of 16 to 32 GPUs. That cluster might handle 10, 20, maybe 50 requests per minute. Each request could take minutes to return a response. For a provider running a serverless inference business, this is a nightmare.

> "That 10 million context window node might only be able to serve, I don't know, 10, 20, 50 requests per minute, which is a very, very small number. Those requests might also take minutes to respond to if you are using that 10 million context window."
>
> Tovan, [Office Hours S01E02](https://www.youtube.com/watch?v=hihrUCRwkFM&t=2248)

The inference business runs on thin margins. Providers make money by packing as many requests as possible onto their hardware. A 10 million context endpoint does the opposite: it monopolizes expensive GPUs for minutes at a time, serving a handful of users, generating almost no margin.

## Why the announcements don't match reality

Model providers announce capabilities. Infrastructure providers offer endpoints. These are different businesses with different incentives.

When Google announces a 10 million token context window, they're demonstrating what the model architecture can handle. When you try to access it through Vertex AI or a third-party provider, you're asking someone to provision and maintain hardware that loses money on every request.

> "Offering a 10 million context window is extremely compute intensive. It requires a lot of hardware. The inference business is a very very low margin business."
>
> Tovan, [Office Hours S01E02](https://www.youtube.com/watch?v=hihrUCRwkFM&t=2156)

The result: announced capabilities that exist in demos but not in production APIs. Or context limits that are technically available but priced so high that no one uses them. Or latency so severe that the workflow breaks before the response arrives.

## Where long context actually happens

If the serverless economics don't work, who uses these capabilities?

Organizations with specific use cases and their own infrastructure. Companies that can justify dedicating a cluster to long-context inference because the alternative (not having it) costs more than the hardware.

> "My guess is that these kinds of deployments are going to be happening on prem for organizations that have specific usage and not are not worried about the costs involved because you know they have a need for it outside of serving it as a serverless endpoint for inference."
>
> Tovan, [Office Hours S01E02](https://www.youtube.com/watch?v=hihrUCRwkFM&t=2298)

This is the reality behind the announcements: long-context inference at scale is an on-prem capability for now. The serverless model that makes AI accessible to smaller teams doesn't support it economically.

## Why this matters for your team

For a Series A - C team evaluating AI tooling, this distinction changes how you plan.

If your workflow depends on feeding an entire codebase into a single prompt, you're betting on infrastructure that doesn't exist at accessible price points. The 10 million token context window is real, but the endpoint that serves it affordably isn't.

The practical approach: design workflows that work within current context limits. Use codebase indexing and retrieval to surface relevant context rather than brute-forcing everything into one prompt. Assume that longer context will get cheaper over time, but don't block your roadmap on it.

## The shift to watch

Spare capacity changes this equation. When providers have GPU clusters sitting idle, long-context endpoints become a way to monetize that capacity rather than a margin-destroying obligation. The timeline depends on hardware supply, demand curves, and how much providers are willing to subsidize these deployments to capture market position.

Until then, treat announced context limits as a ceiling, not a floor. Build for what's available today. The 10 million token future will arrive when the infrastructure economics allow it.

## How Roo Code works within context limits

Rather than waiting for mythical 10 million token endpoints, Roo Code closes the loop by working intelligently within today's context constraints. With BYOK (bring your own key), you pay only what your provider charges for inference with no token markup, which matters when context efficiency directly impacts your costs.

Roo Code uses codebase indexing and retrieval to surface the most relevant files and symbols for each task, rather than stuffing everything into a single prompt. This means you get agentic capabilities that can propose diffs, run commands and tests, and iterate on results without requiring infrastructure that doesn't exist at accessible price points.

**The practical reality: an AI coding agent that works within current limits will ship features today, while teams waiting for 10 million token context windows remain blocked.**

## Long-context approaches compared

| Dimension            | Brute-force context stuffing                   | Retrieval-augmented workflows             |
| -------------------- | ---------------------------------------------- | ----------------------------------------- |
| Context dependency   | Requires endpoints that don't exist affordably | Works within current API limits           |
| Cost structure       | Scales linearly with codebase size             | Scales with task relevance                |
| Latency              | Minutes per request at scale                   | Seconds per interaction                   |
| Availability         | Limited to on-prem or premium tiers            | Available through standard API endpoints  |
| Workflow reliability | Blocked when limits hit                        | Degrades gracefully with larger codebases |

## Frequently asked questions

### Why can't I access the 10 million token context window that was announced?

Announced context windows reflect model architecture capabilities, not production API availability. Serving requests at that scale requires dedicated GPU clusters that lose money on every request under serverless pricing models. Providers either don't offer these endpoints, price them prohibitively, or impose latency that breaks real workflows.

### When will long-context endpoints become affordable?

The timeline depends on GPU supply, demand curves, and provider willingness to subsidize these deployments for market position. Spare capacity is the key variable. When providers have idle GPU clusters, long-context becomes a way to monetize that capacity. Until then, design workflows that don't depend on it.

### How does Roo Code handle large codebases without massive context windows?

Roo Code uses codebase indexing to surface relevant files and symbols for each task rather than requiring everything in a single prompt. Combined with BYOK pricing where you pay only your provider's rates, this approach lets you close the loop on real development tasks without waiting for infrastructure that isn't economically viable yet.

### Should my team wait for longer context before adopting AI coding tools?

No. Teams that design workflows around current limits ship features today. The practical approach is retrieval-augmented context selection, not brute-force context stuffing. Longer context will get cheaper over time, but blocking your roadmap on announced-but-unavailable capabilities stalls real productivity gains.

### What's the difference between announced capabilities and production endpoints?

Model providers demonstrate what architectures can handle. Infrastructure providers offer what they can serve profitably. A 10 million token demo proves the model works. A production endpoint requires someone to provision hardware, accept thin margins, and maintain availability at scale. These are different businesses with different incentives.
