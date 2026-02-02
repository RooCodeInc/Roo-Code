---
title: Strip the Comments Before You Feed the Context
slug: strip-the-comments-before-you-feed-the-context
description: Stale code comments confuse AI coding agents by providing contradictory context. Learn how to audit comment freshness and practice context hygiene for better agent output.
primary_schema:
    - Article
    - FAQPage
tags:
    - context-management
    - ai-coding-agents
    - developer-workflow
    - prompt-engineering
status: published
publish_date: "2025-04-09"
publish_time_pt: "9:00am"
---

The model read the comment. Then it read the code. Then it got confused.

## The contradiction problem

Your codebase has comments. Some were written last week. Some were written three years ago by someone who left. Some describe behavior that was refactored twice since then.

To a human reviewer, stale comments are noise. You skim past them, trust the code, maybe leave a "TODO: update this comment" that never gets done.

To an LLM, every comment is context. Equal weight. Equal validity. The model cannot distinguish between "accurate description of current behavior" and "outdated note from 2019 that contradicts the implementation."

When the comments disagree with each other, the model has to pick a side. Sometimes it picks the wrong one. Sometimes it tries to satisfy both, generating duplicate methods or ignoring your instructions entirely.

> "If your code is full of comments, those comments are often not in agreement with one another. And so those comments influence the large language model as you go."
>
> Hannes Rudolph, [Office Hours S01E01](https://www.youtube.com/watch?v=DZIkxSMPKOY)

## The experiment

One developer hit a wall on an experimental project. Full vibe-coding mode: let the agent run, don't look at anything, ship fast. It worked until it didn't. The agent started producing output that made no sense, ignoring clear instructions, generating code that contradicted itself.

The fix was not a prompt change. It was not a model switch. It was stripping the comments.

> "I was working on an experimental project where I 100% vibed it and I didn't look at anything and then I got to a place where it just stopped working. So what I did is strip out all the comments and it responded 100 times better immediately."
>
> Hannes Rudolph, [Office Hours S01E01](https://www.youtube.com/watch?v=DZIkxSMPKOY)

No tuning. No elaborate system prompt. Just removing the contradictory context that was poisoning every interaction.

## The tradeoff

This is not "comments are bad." Comments written for humans serve a real purpose: explaining intent, documenting edge cases, warning future maintainers about non-obvious behavior.

The problem is accuracy decay. Comments that were true when written become false as code changes. The code gets updated; the comment does not. Over time, a codebase accumulates layers of contradictory documentation, each layer confident about behavior that no longer exists.

For human readers, this is annoying but manageable. For LLMs treating every token as valid signal, it is actively harmful.

> "If you're going to have comments, make sure they're extremely accurate. Otherwise, just don't have them."
>
> Hannes Rudolph, [Office Hours S01E01](https://www.youtube.com/watch?v=DZIkxSMPKOY)

The rule is binary: accurate comments help. Inaccurate comments hurt. There is no neutral middle ground where stale comments are "fine."

## The practical workflow

Before running an agentic task on a legacy codebase:

1. **Audit comment freshness.** When was this file last meaningfully edited? Do the comments describe current behavior or historical behavior?

2. **Strip aggressively if uncertain.** If you cannot verify a comment is accurate, remove it. The model will read the code. The code does not lie about what it does.

3. **Keep comments that encode intent.** "We do X because of constraint Y" is valuable if Y is still true. "This function does Z" is worthless if the function was refactored.

4. **Re-add comments after the task.** Once the agent finishes and you review the output, add fresh comments that describe the new state. Future agents (and future humans) will thank you.

## Comment freshness: old approach vs. context-aware approach

| Dimension           | Old approach                                  | Context-aware approach                                  |
| ------------------- | --------------------------------------------- | ------------------------------------------------------- |
| Comment treatment   | Leave all comments in place                   | Audit and strip stale comments before agent tasks       |
| Accuracy assumption | Comments are helpful documentation            | Comments are context that LLMs weight equally with code |
| Debugging focus     | Prompt engineering and model selection        | Context hygiene and contradiction removal               |
| Post-task workflow  | Move on to next task                          | Re-add accurate comments describing new state           |
| Signal quality      | Mixed signals from years of accumulated notes | Clean signal from verified, current documentation       |

## How Roo Code handles context for better agent output

Roo Code closes the loop by reading your codebase, proposing changes, running tests, and iterating based on results. This agentic workflow means every piece of context in your files directly influences what the agent produces.

When you use BYOK (Bring Your Own Key) with Roo Code, you control the models and the tokens. But model quality only matters if the context is clean. Contradictory comments in your codebase act as noise that competes with your actual instructions.

**Before starting an agentic task in Roo Code, strip stale comments from files the agent will touch.** The agent reads code as truth. When comments contradict that truth, the agent may generate code that satisfies the outdated comment instead of your current requirements.

## Why this matters for your workflow

If you have been debugging agent behavior and the model keeps making confident mistakes, check the comments. The model might be reading a description of how the code worked two years ago and trying to make the current code match that description.

The fix is not a prompt. The fix is context hygiene.

Strip the comments. Let the model read the code. Add accurate comments back when you are done.

## Frequently asked questions

### Why do stale comments hurt AI coding agents more than human developers?

Human developers subconsciously discount comments that seem outdated or contradictory. LLMs process every token with equal weight. A comment from 2019 describing deprecated behavior carries the same authority as code written yesterday. The model cannot infer that one source is more trustworthy than another.

### Should I remove all comments before using an AI coding agent?

Not all comments. Keep comments that encode intent or explain constraints that are still valid. Remove comments that describe implementation details, especially if you cannot verify they match current behavior. The goal is accurate context, not zero context.

### How does Roo Code handle contradictory information in my codebase?

Roo Code reads your files and uses that context to propose changes. When your codebase contains contradictory comments, the agent must resolve the conflict somehow. It may follow the outdated comment, ignore your instructions, or produce inconsistent output. Stripping stale comments before the task gives the agent clean context to work with.

### What is the fastest way to audit comment freshness in a large codebase?

Check file modification dates against comment content. If a file was substantially refactored but comments still describe the old structure, those comments are candidates for removal. For legacy codebases, consider stripping comments from files the agent will modify and re-adding accurate documentation after the task completes.

### Does this apply to documentation strings and docstrings too?

Yes. Docstrings that describe function signatures, parameters, or return values can mislead an agent if the function signature changed. Any text the model reads as context can introduce contradictions. Audit docstrings with the same scrutiny as inline comments.
