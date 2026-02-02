---
title: Why Your Model Searches the Same Files Twice
slug: why-your-model-searches-the-same-files-twice
description: Learn why reasoning models repeat file searches across prompts and how preserving reasoning tokens between API calls can boost coding benchmark performance by 4-5 percentage points.
primary_schema:
    - Article
    - FAQPage
tags:
    - reasoning-models
    - api-architecture
    - context-management
    - ai-coding
status: published
publish_date: "2025-11-05"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

Three prompts. Same file search. Zero new information.

## The amnesia loop

You ask the model to find a bug in your auth module. It searches, finds the file, reads it, reasons about the problem. Suggests a fix.

You say "that's not quite right" and give it more context. It searches again. Reads the same file. Reasons from scratch. Suggests a slightly different fix.

Third prompt. Same search. Same file. The model has no memory of what it thought about the first two times.

This is not a model capability problem. This is an API architecture problem.

## Where the reasoning goes

When you use a reasoning model through chat completions, something counterintuitive happens: the model does all its thinking, but that thinking never makes it back into the conversation history.

The model receives your question. It reasons through the problem, maybe for 30 seconds, maybe longer. It produces an answer. But the reasoning tokens themselves get discarded. The only thing that persists is the question and the final answer.

> "If you were to use an open reasoning model inside of chat completions, it does all the reasoning sort of like out of band and its reasoning tokens don't get outputted at all into the chat completion. So you're like you're asking a question, it thinks about it for a while, it answers, but then all it sees is the ask and the answer, and it doesn't remember what it thought about."
>
> Brian Fioca, [Roo Cast S01E16](https://www.youtube.com/watch?v=Nu5TeVQbOOE)

This explains the file search pattern. The model reasoned about your codebase structure on turn one. It figured out which files matter and why. But that reasoning got thrown away before turn two started. So it searches again, because from its perspective, it has never seen your codebase before.

## The fix: preserve reasoning tokens

The responses API lets you keep encrypted reasoning tokens between calls. The model cannot read its own reasoning (it is encrypted), but the presence of those tokens lets it continue from where it left off instead of starting over.

The impact is measurable. Not "feels smarter" measurable. SWE-bench measurable.

> "We've seen like four to five percentage point boosts in like SWE-bench just by like having it like keep its intelligence along the way."
>
> Brian Fioca, [Roo Cast S01E16](https://www.youtube.com/watch?v=Nu5TeVQbOOE)

Four to five percentage points on a coding benchmark is significant. And that improvement comes entirely from not throwing away context that the model already generated.

## The tradeoff

Preserving reasoning tokens costs more. You are storing and passing more data between calls. If your task completes in one turn, this overhead adds cost without benefit.

But if your task takes multiple turns - and most real debugging tasks do - the cost of re-reasoning from scratch compounds. The model spends tokens rediscovering what it already figured out. You pay for the same file searches multiple times. You wait for reasoning that already happened.

The question is not "is this more expensive per call?" The question is "is this cheaper per completed task?"

## Why this matters for your workflow

If you are integrating a reasoning model into an agentic workflow, check what happens to the reasoning tokens between turns. If they get discarded, your agent is effectively amnesiac. Every turn starts fresh.

This shows up as:

- Repeated file searches for files already analyzed
- The same diagnostic questions asked multiple times
- "I'll need to check the codebase" on turn five of a debugging session

The model is not being lazy or forgetful. The model literally cannot see what it thought about on previous turns.

## How Roo Code closes the loop on context

Roo Code addresses the reasoning amnesia problem by maintaining rich context across the entire task lifecycle. When Roo Code runs commands, reads files, and iterates on test failures, it preserves the full chain of reasoning rather than discarding it between turns.

This is why BYOK (Bring Your Own Key) matters for multi-turn coding tasks: you control the model and the context window, and Roo Code structures the conversation to maximize what the model remembers. The agent does not re-search files it already analyzed because the context architecture prevents that waste.

**Roo Code's agentic loop preserves reasoning context across turns, eliminating the repeated file searches and redundant analysis that plague stateless API integrations.**

## Chat completions vs. responses API: a comparison

| Dimension                   | Chat Completions (Stateless)  | Responses API (Context-Preserving)   |
| --------------------------- | ----------------------------- | ------------------------------------ |
| Reasoning token persistence | Discarded after each turn     | Encrypted and preserved              |
| File search behavior        | Repeats on every turn         | Continues from prior analysis        |
| Multi-turn task cost        | Compounds with redundant work | Amortized across turns               |
| SWE-bench performance       | Baseline                      | 4-5 percentage points higher         |
| Best use case               | Single-turn queries           | Multi-turn debugging and refactoring |

## The shift

Audit your API integration. If you are using chat completions with a reasoning model, the reasoning tokens are gone after each turn. Consider the responses API, or whatever your provider offers for preserving context between calls.

The model already did the work. Stop making it do the work again.

## Frequently asked questions

### Why does my AI assistant keep searching the same files?

When using chat completions with reasoning models, the model's internal reasoning tokens are discarded after each response. This means every new prompt starts fresh with no memory of prior analysis. The repeated file searches are not a bug or laziness - the model genuinely has no record of what it thought about previously.

### What are reasoning tokens and why do they matter?

Reasoning tokens are the intermediate thoughts a model generates while working through a problem. They represent the "thinking" that happens before the final answer. In chat completions, these tokens get discarded, but the responses API preserves them in encrypted form, letting the model continue from where it left off.

### How much does preserving reasoning context actually help?

According to benchmarks discussed on Roo Cast, preserving reasoning tokens between API calls results in a 4-5 percentage point improvement on SWE-bench. This is a significant gain that comes purely from not throwing away context the model already generated.

### Does Roo Code handle reasoning context differently than raw API calls?

Yes. Roo Code's architecture maintains context across the full task lifecycle. When the agent reads files, runs tests, and iterates on failures, that context persists rather than resetting on each turn. This eliminates the redundant file searches and repeated analysis that happen with stateless API integrations.

### When should I pay the extra cost for context preservation?

If your task completes in one turn, preserving reasoning tokens adds cost without benefit. But for multi-turn tasks like debugging, refactoring, or complex feature implementation, the cost of re-reasoning from scratch compounds quickly. The right question is not "is this more expensive per call?" but "is this cheaper per completed task?"
