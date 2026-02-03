---
title: Run Your Documentation MCP Through an Orchestrator, Not Your Main Coding Mode
slug: run-your-documentation-mcp-through-an-orchestrator-not-your-main-coding-mode
description: Learn why running documentation MCPs in a dedicated researcher mode prevents context pollution and keeps your expensive coding model focused on implementation.
primary_schema:
    - Article
    - FAQPage
tags:
    - mcp
    - orchestrator
    - context-management
    - workflow
status: draft
publish_date: "2025-06-18"
publish_time_pt: "9:00am"
source: "Office Hours"
---

Your coding model does not need to know how to query Next.js docs.

It needs to know the answer.

## The context pollution problem

You've set up Context7 or a similar documentation MCP. It's connected. It works. You ask your coding agent about a React hook, and it dutifully calls the MCP, pulls documentation, and gives you an answer.

Then you ask it to implement the feature. The context window now contains the full MCP conversation: the query, the API response, the parsed documentation, the summary. Your coding model is now reasoning about implementation with half its context consumed by reference material it already distilled into a one-paragraph answer.

This is context pollution. The documentation lookup was useful once. Now it's dead weight.

## The separation pattern

The pattern that works: don't run documentation MCPs in your main coding mode at all.

> "You really don't want this to be part of your main coding mode. And I would say you really want your Context7 in an orchestrator type setup."
>
> Adam, [Office Hours S01E10](https://www.youtube.com/watch?v=yVf2LalAubc&t=631)

Create a dedicated researcher mode. Give it a lightweight model. Let it handle the documentation lookup cycle: query the MCP, summarize the relevant parts, and pass the summary back to your orchestrator. Your expensive coding model never sees the raw API traffic.

The orchestrator receives a clean artifact: "Here's what the Next.js docs say about server actions." The coding model receives context it can use, not context it has to wade through.

## Model selection for the lookup layer

The documentation lookup cycle does not require your most capable model. It needs to parse a query, call an MCP, and summarize what comes back.

> "I was using Gemini 2.5 Flash for the MCP stuff because it can gather the basics of your request."
>
> Adam, [Office Hours S01E10](https://www.youtube.com/watch?v=yVf2LalAubc&t=672)

Gemini 2.5 Flash, Claude 3.5 Haiku, or similar lightweight models handle this well. They're inexpensive per token, and the task is bounded: read docs, extract relevant section, summarize. No complex reasoning required.

Your expensive model stays focused on the hard part: understanding your codebase and generating correct implementation.

## Setting up the pattern

The setup looks like this:

1. Create a researcher mode in Roo Code with MCP access
2. Assign a lightweight model (Flash, Haiku, or equivalent)
3. Configure the orchestrator to delegate documentation queries to this mode
4. The researcher returns summaries, not raw MCP output

> "If you have a couple frameworks that you're using constantly, just go figure out like the context that you want in there and like how you want to query that."
>
> Adam, [Office Hours S01E10](https://www.youtube.com/watch?v=yVf2LalAubc&t=287)

For frameworks you use constantly, pre-tune the query patterns. Know what context you need from the Next.js docs versus the Prisma docs. The researcher mode can be specialized per framework if the query patterns differ significantly.

## The tradeoff

This adds orchestration overhead. You're now managing mode delegation instead of running everything in one context. For quick questions, the round-trip through an orchestrator might feel slower than just asking your coding model directly.

But for extended implementation sessions, the payoff compounds. Each documentation lookup stays isolated. The coding model's context stays clean. You're not paying Opus prices to parse API responses that a lighter model handles fine.

## How Roo Code enables clean context separation

Roo Code's orchestrator mode delegates subtasks to specialized modes, each with their own context window. This means documentation lookups in a researcher mode stay isolated from your main coding context. The orchestrator closes the loop by passing only the distilled summary to your coding model, not the raw MCP traffic.

With BYOK (bring your own key), you control exactly which model handles each layer. Run Gemini Flash for documentation gathering at minimal cost while reserving Claude Opus or GPT-4 for complex implementation reasoning. You spend tokens intentionally for outcomes, matching model capability to task complexity.

| Approach                  | Context usage                            | Model cost                               | Session coherence              |
| ------------------------- | ---------------------------------------- | ---------------------------------------- | ------------------------------ |
| MCP in main coding mode   | High - raw API responses consume context | High - expensive model processes lookups | Degrades as lookups accumulate |
| MCP in orchestrator setup | Low - only summaries reach coding model  | Low - cheap model handles lookups        | Stable through long sessions   |
| No documentation MCP      | Zero MCP overhead                        | Variable - manual lookup time            | Depends on developer memory    |

## Why this matters for your workflow

If you're spending tokens on a capable coding model, you're paying for reasoning capacity. Every token of context consumed by MCP traffic is a token not available for understanding your implementation.

The difference shows up in longer sessions. When you hit context limits partway through a refactor, and the model starts losing the thread of earlier changes, some of that limit was consumed by documentation lookups you could have delegated.

The pattern is simple: separate the lookup layer from the reasoning layer. Let lightweight models gather context. Let capable models use it.

Start by identifying which MCPs run in your main coding mode. Move them to a dedicated researcher mode behind an orchestrator. Track whether your coding sessions stay coherent longer.

## Frequently asked questions

### What is context pollution in AI coding agents?

Context pollution occurs when reference material, API responses, or intermediate outputs accumulate in your model's context window without providing ongoing value. Documentation lookups are a common source: the raw MCP traffic was useful for generating an answer but becomes dead weight during implementation.

### How do I set up a researcher mode in Roo Code for documentation lookups?

Create a custom mode in Roo Code with access to your documentation MCPs (like Context7). Assign a lightweight model such as Gemini 2.5 Flash or Claude 3.5 Haiku. Configure your orchestrator to delegate documentation queries to this mode and receive summarized responses back.

### Which models work best for the documentation lookup layer?

Lightweight, cost-effective models handle documentation lookups well because the task is bounded: parse a query, call an MCP, extract relevant sections, and summarize. Gemini 2.5 Flash, Claude 3.5 Haiku, and similar models are good choices. Save your expensive reasoning models for implementation work.

### Does orchestrator overhead slow down simple questions?

Yes, for quick one-off questions the round-trip through an orchestrator adds latency compared to asking your coding model directly. The payoff comes in extended sessions where multiple documentation lookups would otherwise accumulate and degrade context quality.

### Why do my coding sessions lose coherence after many documentation lookups?

Each documentation lookup in your main coding mode consumes context window space. As lookups accumulate, less space remains for your codebase context and implementation reasoning. Moving lookups to a separate researcher mode keeps your coding model's context focused on the work that requires its full capability.
