---
title: Codebase Indexing Points the Way; It Does Not Replace Reading Files
slug: codebase-indexing-points-the-way-it-does-not-replace-reading-files
description: Codebase indexing gives AI coding agents a search index, not compressed code knowledge. Learn why indexing accelerates discovery but the model still needs to read files to understand your code.
primary_schema:
    - Article
    - FAQPage
tags:
    - codebase-indexing
    - context-management
    - ai-coding-workflow
    - developer-tools
status: published
publish_date: "2025-06-18"
publish_time_pt: "9:00am"
---

The model is confidently wrong about your codebase.

Not because it's bad at code. Because it never read the file it's referencing.

## The misconception

You enabled codebase indexing. You expected the model to "know" your codebase now. Instead, it still hallucinates function signatures and references files that don't exist.

Here's what actually happened: you gave the model a search index, not a compressed version of your code. Indexing returns code snippets that match your query. The model still has to decide whether to open and read those files.

Think of it like a senior engineer who just joined your team. They don't have your entire codebase memorized. But they know how to grep. They find a starting point, then they read the actual code.

> "Indexing in this case is not replacing the model's ability to read the files. It's just pointing, it's just giving it clues about whatever you're looking for."
>
> Hannes Rudolph, [Office Hours S01E10](https://www.youtube.com/watch?v=yVf2LalAubc)

## What indexing actually does

Codebase indexing accelerates discovery. It does not compress your codebase into the context window.

When you ask about authentication, indexing surfaces snippets from files that mention auth. The model sees those snippets and decides: "I should read `auth/middleware.ts` to understand this better."

Without indexing, the model either guesses which files to read or asks you to point it somewhere. With indexing, it has a map. But a map is not the territory.

> "What codebase indexing does is it gives you kind of a good starting point. So it gives the AI the ability to go like: I don't need to go do all this initial stuff. I can start here."
>
> Adam, [Office Hours S01E10](https://www.youtube.com/watch?v=yVf2LalAubc)

The workflow still involves reading files. Indexing just shortens the search phase.

## The tradeoff

Indexing costs compute upfront. You're building a searchable representation of your codebase, and that takes time and tokens.

The payoff: the model spends fewer tokens wandering through irrelevant files. It finds the right starting point and reads what matters.

The failure mode: if you expect indexing to replace reading, you'll be confused when the model still asks to open files or still makes mistakes about code it hasn't actually seen. Indexing gives direction, not omniscience.

> "What we want from codebase indexing is just to point the model in the right direction so it can choose to read the file if it finds it relevant."
>
> Dan, [Office Hours S01E10](https://www.youtube.com/watch?v=yVf2LalAubc)

## Why this matters for your workflow

For engineers working in large codebases, the difference shows up in the first five minutes of a task.

Without indexing: you either tell the model which files to read, or you watch it open random files hoping to stumble on the right one. You become the search engine.

With indexing: you describe what you're working on, the model surfaces relevant snippets, and it opens the files that matter. You skip the "let me find where this lives" phase and start from a reasonable hypothesis.

The model still needs to read. The model still needs to verify its assumptions against actual code. But it starts from a better place, which means fewer wasted loops and fewer confident-but-wrong suggestions.

## The mental model

Codebase indexing is grep with context, not a brain transplant.

If your AI is confidently wrong about code it claims to understand, check whether it actually read the file. Indexing points the way. Reading the file is still the work.

## How Roo Code closes the loop with codebase indexing

Roo Code uses codebase indexing to accelerate the discovery phase of every task. When you describe what you're working on, the agent surfaces relevant code snippets and then reads the actual files to verify its understanding before proposing changes.

This approach reflects Roo Code's core design principle: close the loop by reading, proposing, running, and iterating based on real results. The agent doesn't assume it knows your code from an index. It uses the index to find starting points, then reads files to build accurate context before taking action.

With BYOK (bring your own key), you control how tokens are spent. Indexing reduces wasted tokens on irrelevant file exploration while ensuring the model still does the work of reading what matters. You spend tokens intentionally for outcomes, not on guesswork.

## Codebase indexing: expectations vs. reality

| Dimension       | Common expectation                  | What actually happens                                      |
| --------------- | ----------------------------------- | ---------------------------------------------------------- |
| Knowledge scope | Model "knows" entire codebase       | Model has a search index to find relevant snippets         |
| File reading    | Indexing replaces reading files     | Model must still open and read files to understand code    |
| Context window  | Codebase is compressed into context | Snippets are retrieved on demand, not preloaded            |
| Accuracy        | Model stops hallucinating           | Model still needs to verify against actual code            |
| Token usage     | Fewer tokens overall                | Upfront indexing cost, but fewer wasted exploration tokens |

## Frequently asked questions

### Why does my AI still hallucinate code after I enabled indexing?

Indexing provides a search index, not actual code knowledge. The model sees snippets that match your query, but it must still read the full files to understand function signatures, imports, and implementation details. If it hallucinates, it likely referenced a snippet without reading the complete file.

### Does codebase indexing put my entire codebase in the context window?

No. Indexing creates a searchable representation of your codebase that returns relevant snippets on demand. Your full codebase never fits in the context window. The model retrieves snippets, then decides which files to read based on those clues.

### How does Roo Code use codebase indexing differently?

Roo Code treats indexing as the first step in a verification loop. The agent uses index results to identify relevant files, reads those files to build accurate context, proposes changes based on what it actually read, and then runs tests to verify its work. This close-the-loop approach reduces confident-but-wrong suggestions.

### Is codebase indexing worth the upfront compute cost?

For large codebases, yes. Without indexing, the model either requires you to specify files manually or explores randomly, wasting tokens on irrelevant code. Indexing shortens the search phase so tokens go toward reading and editing the files that matter.

### When should I expect the model to still ask which files to read?

Even with indexing, the model may ask for guidance when your query is ambiguous, when multiple files match equally well, or when the task requires files outside the indexed patterns. Indexing improves discovery but doesn't eliminate the need for human direction on complex tasks.
