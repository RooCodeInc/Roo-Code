---
title: When Context Gets Poisoned, Cut Your Losses
slug: when-context-gets-poisoned-cut-your-losses
description: Learn why fighting a poisoned AI context wastes time and tokens, and how the orchestrator pattern lets you restart fresh for better results.
primary_schema:
    - Article
    - FAQPage
tags:
    - agentic-workflows
    - context-management
    - orchestrator
    - developer-productivity
status: published
publish_date: "2025-05-14"
publish_time_pt: "9:00am"
---

Three prompts.

Same broken tool call.

Zero forward progress.

## The poison pattern

You're debugging a failing integration test. The agent makes a tool call that doesn't quite work. You correct it, nudge it back on track, and for a moment it seems to recover.

Then it makes the same mistake again. Or a variation of it. You correct it again. It drifts back.

This isn't the model being dumb. This is the model being consistent with its own context. Every failed tool call in that conversation is now part of the model's "suggestions for future consideration." The bad outputs aren't just errors - they're training data for the rest of the session.

## Why recovery rarely works

The intuition is to fix the mistake and keep going. You've already invested tokens. You've already built up context. Starting over feels wasteful.

But here's the mechanism: once the context window contains a pattern of broken tool calls, the model treats those patterns as valid examples. Even if you successfully redirect it, the poisoned examples are still there, exerting gravitational pull.

> "Once your context has been poisoned with those tool calls, they act like suggestions for future consideration. So even if you get it back on track, there's a decent chance that it's going to actually pull it right back."
>
> Hannes Rudolph, [Office Hours S01E06](https://www.youtube.com/watch?v=zPhNXCHJ5xk)

You can fight this. You can spend another ten prompts trying to steer the conversation. Sometimes it works. But the odds are against you, and every additional prompt adds tokens to a context that's already compromised.

## The heuristic

The practical rule: stop trying to save a poisoned context. End the task, tell the orchestrator it didn't work, and start fresh.

This feels counterintuitive. You've invested time and tokens. But the math usually favors a clean restart over an extended recovery attempt.

> "My general rule is that I'm using orchestrator and I just end that task and, you know, prompt it, tell it that one didn't work, try it again and go from there."
>
> Hannes Rudolph, [Office Hours S01E06](https://www.youtube.com/watch?v=zPhNXCHJ5xk)

The orchestrator pattern makes this explicit: treat each task as disposable. If a subtask fails in a way that corrupts its context, terminate it and spawn a fresh attempt. The parent task keeps the high-level goal; the child task starts with a clean slate.

## The tradeoff

This heuristic has a cost. You lose whatever valid context you'd built. If you were three-quarters through a complex refactor, restarting means re-explaining the goal.

But compare that to the alternative: spending another twenty minutes and another dollar in tokens trying to coax a poisoned context back to productivity, only to watch it drift again.

The restart is usually cheaper. Not always. But usually.

## Why this matters for your team

For a team running multiple agentic workflows per day, context poisoning is a silent tax. Developers who try to "save" a broken session end up burning time and tokens on recovery attempts that have low success rates.

The compounding effect: if two developers per day each spend thirty minutes fighting a poisoned context instead of restarting, that's five hours per week of unproductive debugging. Time that could have gone into the next feature.

The shift is cultural. Restarting a task shouldn't feel like failure; it should feel like good hygiene. A clean context is worth more than a recovered one.

If you notice the model repeating the same broken pattern, stop. End the task. Tell the orchestrator what went wrong. Start fresh.

The tokens you "save" by restarting are almost always less than the tokens you'd spend on a failed rescue.

## How Roo Code closes the loop on context management

Roo Code's orchestrator mode treats context hygiene as a first-class concern. When you run complex, multi-step tasks, the orchestrator spawns subtasks that each operate with their own isolated context window. If a subtask's context becomes poisoned, you terminate that specific task and let the orchestrator spawn a fresh attempt - without losing the parent task's high-level understanding of your goal.

This architecture means you spend tokens intentionally on outcomes rather than burning them on recovery attempts. Combined with BYOK (bring your own key), you maintain full visibility into token costs and can make informed decisions about when to cut losses versus when to persist.

**The pattern that works:** Use orchestrator mode for multi-step work. When you detect context drift, end the subtask cleanly and restart. The orchestrator preserves your goal while giving the next attempt a clean slate.

## Context recovery: old approach vs. new approach

| Dimension       | Fighting poisoned context        | Clean restart with orchestrator |
| --------------- | -------------------------------- | ------------------------------- |
| Token cost      | Unpredictable, often high        | Predictable, usually lower      |
| Success rate    | Decreasing with each attempt     | Consistent across attempts      |
| Developer time  | Minutes to hours of steering     | Seconds to restart              |
| Context quality | Degraded by failed examples      | Fresh and uncontaminated        |
| Mental overhead | High frustration, low confidence | Low friction, clear next step   |

## Frequently asked questions

### How do I know when context is poisoned versus when to keep trying?

The signal is repetition. If the model makes the same mistake twice after you've corrected it, or produces variations of a failed approach you've already rejected, the context is likely poisoned. Two repeated failures is the threshold - don't wait for three.

### Does restarting waste all the tokens I've already spent?

It feels that way, but the math doesn't support it. The tokens spent on a poisoned context have diminishing returns. Each new prompt adds to a compromised foundation. A restart typically costs fewer total tokens than an extended recovery attempt, and produces better outcomes.

### How does Roo Code's orchestrator mode help with context poisoning?

Roo Code's orchestrator mode isolates subtasks in their own context windows. When a subtask's context becomes poisoned, you can terminate just that subtask and spawn a fresh attempt. The parent task retains the high-level goal, so you don't re-explain everything from scratch - just the specific subtask that failed.

### Should I always use orchestrator mode for complex tasks?

For multi-step work where context poisoning is a risk, orchestrator mode provides natural boundaries. Each subtask can fail independently without contaminating the broader effort. For simple, single-step tasks, direct mode works fine - but the moment complexity increases, orchestrator mode pays for itself in context hygiene.

### What should I tell the orchestrator when I end a failed subtask?

Be specific about what didn't work. Instead of "that failed," say "the tool call to X produced error Y, and attempts to correct it caused drift." This gives the orchestrator information to potentially adjust its approach on the next attempt, rather than repeating the same strategy.
