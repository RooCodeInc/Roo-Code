---
title: Sonnet 4.5 Does Not Dig for Context and That Changes How You Use It
slug: sonnet-45-does-not-dig-for-context-and-that-changes-how-you-use-it
description: Sonnet 4.5 excels at spec-driven implementation but guesses at debugging tasks instead of reading your codebase first. Learn when to use it and when to switch models.
primary_schema:
    - Article
    - FAQPage
tags:
    - model-selection
    - debugging
    - developer-workflow
    - ai-coding
status: draft
publish_date: "2025-10-03"
publish_time_pt: "9:00am"
source: "After Hours"
---

You describe the bug. The model suggests a fix.

The fix is wrong. Not because the model can't code, but because it never looked at the file where the bug actually lives.

## The guess-first pattern

You've got a failing test in an existing codebase. You prompt Sonnet 4.5: "This endpoint returns 401 when it should return 200. Help me track it down."

The model responds immediately. It suggests checking your auth middleware. It's confident. It's plausible. It's also a guess based on the surface-level description you gave it, not on the actual code in your repo.

You implement the suggestion. The test still fails. You prompt again with more detail. Another confident suggestion. Another guess.

The model never opened your auth service file. Never read the middleware chain. Never looked at the test setup to see what was actually being mocked. It answered based on what a 401 error usually means, not what it means in your codebase.

## Lazy is the right word

Sonnet 4.5 excels at spec-driven work. Give it a clear specification for something that doesn't exist yet, and it will build it. Zero-to-one implementation is where it shines.

But debugging in existing codebases exposes a different behavior.

> "If you take Sonnet 4.5 and you give it a spec and you tell it to build this thing, it's going to nail it. So it's a one-shot from zero to something. But existing codebase: if you're saying like, hey, I've got this problem, I need help tracking it down, it will take the most surface level answer possible."
>
> GosuCoder, [After Hours S01E01](https://www.youtube.com/watch?v=bmZ2Cl8ohlU&t=902)

The pattern is consistent: the model doesn't proactively gather context. It doesn't read files to understand the actual structure before answering. It works with what you gave it in the prompt, and if that's incomplete, the answer will be incomplete.

> "It's lazy. It's a lazy model. That's the best way I can describe it. If you say it, if you tell it here's what you need to do, probably going to do it. But it's not going to be proactive at gathering context."
>
> Dan, [After Hours S01E01](https://www.youtube.com/watch?v=bmZ2Cl8ohlU&t=1040)

## The contrast: models that dig

GPT-5 Codex behaves differently. Given the same ambiguous debugging prompt, it will use available tools (especially codebase indexing) to read files before answering. It gathers context proactively, which means its first answer is more likely to be grounded in your actual code.

This isn't a universal "one model is always the right choice" situation. It's a workflow decision based on what kind of task you're running.

## The tradeoff

Sonnet 4.5 is fast for spec work because it doesn't spend tokens reading your entire codebase first. That efficiency is a feature when you're building something new from a clear specification.

But that same efficiency becomes a liability when you need the model to understand existing code before acting. If you're debugging, or refactoring, or trying to track down why something fails in CI, the model's reluctance to gather context means you end up doing the context-gathering yourself, pasting file contents into prompts, explaining relationships the model should have discovered.

## How Roo Code closes the loop on model selection

Roo Code supports BYOK (bring your own key) for multiple providers, which means you can switch models mid-task without leaving your editor. When you hit a debugging wall with a guess-first model, you switch to one that digs for context. When you have a clear spec for new implementation, you switch back.

This is close the loop in practice: the agent runs commands, surfaces test failures, and lets you iterate with the right model for each step. You're not locked into a single model's behavioral profile. You spend tokens intentionally for outcomes, matching model strengths to task requirements rather than forcing one model to do everything.

## Model behavior comparison for debugging tasks

| Dimension                      | Guess-first models (Sonnet 4.5)  | Context-first models (GPT-5 Codex) |
| ------------------------------ | -------------------------------- | ---------------------------------- |
| Initial response speed         | Fast - answers immediately       | Slower - reads files first         |
| Context gathering              | Manual - you paste file contents | Automatic - uses codebase indexing |
| Spec-to-implementation         | Excellent one-shot execution     | Good but may over-read             |
| Debugging accuracy             | Low on first attempt             | Higher on first attempt            |
| Token efficiency for new code  | High - minimal context overhead  | Lower - reads before writing       |
| Token efficiency for debugging | Low - multiple prompt cycles     | Higher - fewer re-prompts          |

## Why this matters for your team

For a team of 5-8 engineers maintaining a production codebase, debugging tasks outnumber greenfield features most weeks. If your default model guesses at bugs instead of reading your actual code, you're spending time re-prompting and pasting file contents that a more proactive model would have gathered on its own.

The compounding effect: each debugging session that requires three prompts instead of one adds up. Across a sprint, the difference between "read-first" and "guess-first" model behavior translates into hours of context assembly that the model could have done.

The practical heuristic is simple: use Sonnet 4.5 when you have a clear spec and want implementation. Switch to a model with proactive context-gathering when you need it to understand your existing code before acting.

Match the model to the task. Spec work: Sonnet 4.5. Debugging: something that digs for context first.

## Frequently asked questions

### Why does Sonnet 4.5 guess instead of reading my codebase?

Sonnet 4.5 optimizes for speed and token efficiency on spec-driven tasks. It responds based on the information in your prompt rather than proactively using tools to gather additional context. This makes it fast for greenfield implementation but less effective for debugging where the answer depends on code the model hasn't seen.

### How do I know when to switch models during a task?

Switch when you notice the pattern of confident-but-wrong suggestions. If you're pasting file contents manually or re-prompting with additional context more than once, the model isn't gathering context on its own. That's your signal to switch to a model that reads first.

### Can Roo Code help me switch models without breaking my workflow?

Yes. Roo Code's BYOK approach means you configure multiple providers and switch between them inside your editor. You can start a task with one model and switch mid-session when the task requirements change from implementation to debugging or vice versa.

### Does this mean Sonnet 4.5 is bad for production codebases?

Not entirely. Sonnet 4.5 is still effective for well-scoped implementation tasks even in large codebases - when you provide a clear spec and the model doesn't need to discover context on its own. The limitation shows up specifically when you need the model to understand existing code before acting.

### What's the token cost difference between guess-first and context-first approaches?

Guess-first models use fewer tokens per response but often require multiple prompt cycles for debugging. Context-first models spend more tokens upfront reading files but typically resolve issues in fewer attempts. For debugging tasks, context-first approaches often cost less total tokens despite higher per-response usage.
