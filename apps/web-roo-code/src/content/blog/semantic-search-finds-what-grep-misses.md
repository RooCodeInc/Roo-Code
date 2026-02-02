---
title: Semantic Search Finds What Grep Misses
slug: semantic-search-finds-what-grep-misses
description: Learn why semantic search outperforms grep for AI coding agents navigating legacy codebases with inconsistent naming conventions, and how it reduces token costs.
primary_schema:
    - Article
    - FAQPage
tags:
    - semantic-search
    - codebase-indexing
    - developer-productivity
    - token-efficiency
status: published
publish_date: "2025-07-09"
publish_time_pt: "9:00am"
---

The model references a file that doesn't exist.

You know the file exists. You wrote it last week. But the name you gave it has nothing to do with what it does, and the model's grep-based search came up empty.

## The naming problem

You're three hours into a refactor. The model keeps suggesting changes to the wrong module. You check the search logs: it's grepping for "authentication" but your auth logic lives in a file called `gatekeeper.ts` because that seemed clever at the time.

Grep matches strings. Your codebase doesn't speak in strings. It speaks in concepts, abstractions, and the questionable naming decisions you made at 11pm on a Friday.

> "My ability to name elements that are totally not what they should be named and an LLM can't guess. My ability to do that is greater than an LLM's ability to guess them."
>
> Hannes Rudolph, [Office Hours S01E13](https://www.youtube.com/watch?v=gI0FImx5Qjs)

This isn't about bad code. It's about the gap between what you meant and what you typed. Semantic search closes that gap by matching meaning rather than characters.

## Where grep fails

Grep finds exact matches. It's fast, predictable, and completely blind to intent.

When the connection between your prompt and the relevant code is conceptual rather than literal, grep returns nothing useful. You ask about "rate limiting" but the implementation uses `throttle` and `backoff`. You ask about "user permissions" but the code calls it `accessPolicy`.

Semantic search indexes the codebase by meaning. When you prompt about a concept, it can surface relevant files even when the naming doesn't match.

> "In situations where grep can't get there, indexing can, the semantic search can. There are edge cases when you're running through your development process where it can easily miss something if it's just using grep."
>
> Hannes Rudolph, [Office Hours S01E13](https://www.youtube.com/watch?v=gI0FImx5Qjs)

The edge cases are where this matters most. On straightforward tasks with obvious file names, grep works fine. On the ambiguous tasks where you need the model to understand your codebase, semantic search is the difference between a useful suggestion and a confidently wrong one.

## The cost angle

There's a token cost to file discovery. Every time the model greps through your codebase looking for relevant files, it's spending tokens on the search operation.

When grep misses and the model has to retry with different search terms, that cost multiplies. Three failed greps followed by a successful one means you paid for four searches when you needed one.

Semantic indexing is an upfront cost. You index once, and subsequent lookups go directly to the relevant files.

> "I think it's a big cost saving too... grep can be very expensive when it's trying to figure out where it needs to go in the codebase; codebase indexing can get you right to the right spot."
>
> Hannes Rudolph, [Office Hours S01E13](https://www.youtube.com/watch?v=gI0FImx5Qjs)

For a team running dozens of tasks per day, the token savings compound. The model stops wandering through your file tree and starts landing on the right files on the first attempt.

## How Roo Code closes the loop with semantic search

Roo Code uses codebase indexing to build a semantic understanding of your project. When you start a task, the agent doesn't rely solely on string matching to find relevant files. It queries the semantic index to surface code by meaning, not just by name.

This matters because Roo Code closes the loop: it proposes changes, runs commands, executes tests, and iterates based on results. If the agent starts with the wrong files, every subsequent step compounds the error. Semantic indexing ensures the agent lands in the right place before it starts making changes.

With BYOK (bring your own key), every token spent on failed file searches comes directly from your API budget. Semantic search reduces wasted tokens by eliminating the grep-retry cycle that inflates costs on legacy codebases.

**Roo Code's semantic search finds conceptually relevant files even when naming conventions don't match the prompt, reducing token waste and improving first-attempt accuracy for AI-assisted coding tasks.**

## Grep vs. semantic search comparison

| Dimension                   | Grep-based search             | Semantic search                  |
| --------------------------- | ----------------------------- | -------------------------------- |
| Match type                  | Exact string matches only     | Matches by meaning and concept   |
| Legacy codebase performance | Poor with inconsistent naming | Strong across naming conventions |
| Token cost on miss          | Multiplies with each retry    | Single lookup cost               |
| Setup requirement           | None                          | One-time indexing                |
| Best use case               | Known, consistent file names  | Conceptual queries, refactoring  |

## Why this matters for your team

For a Series A team with a five-year-old codebase full of legacy naming conventions, semantic search is the difference between an AI that understands your project and one that keeps asking where things are.

The practical shift: instead of rewriting prompts to match your file names, you let the index bridge the gap. The model finds `gatekeeper.ts` when you ask about authentication because the semantic index knows what that file does, not just what it's called.

If the model is repeatedly missing files you know exist, the context is wrong. Semantic indexing fixes the context problem at the source.

## Frequently asked questions

### Why does grep fail on older codebases?

Grep matches exact strings, but legacy codebases accumulate naming inconsistencies over time. Different developers use different conventions, clever names replace descriptive ones, and abstractions obscure what files actually do. When your auth logic lives in `gatekeeper.ts` instead of `auth.ts`, grep searches for "authentication" return nothing.

### How does semantic search reduce token costs?

Every failed grep search costs tokens. When the model tries "authentication," then "auth," then "login," then "user," you pay for four searches. Semantic indexing lets the model find the right file on the first attempt because it indexes by meaning, not strings. The upfront indexing cost pays for itself within a few sessions.

### Does Roo Code support semantic search for codebase indexing?

Yes. Roo Code builds a semantic index of your project that the agent queries when searching for relevant files. This allows the agent to find code by concept rather than relying on exact string matches, which is especially valuable for codebases with inconsistent or legacy naming conventions.

### When should I use grep instead of semantic search?

Grep remains useful when you know the exact string you're looking for and file naming is consistent. For targeted searches like finding all occurrences of a specific function name or error message, grep is fast and precise. Semantic search adds value when the connection between your query and the code is conceptual rather than literal.

### How do I know if my codebase needs semantic indexing?

If your AI coding agent frequently misses files you know exist, or if you find yourself rewriting prompts to match file names, your codebase would benefit from semantic indexing. Teams with codebases older than two years, multiple past contributors, or domain-specific naming conventions see the largest improvements.
