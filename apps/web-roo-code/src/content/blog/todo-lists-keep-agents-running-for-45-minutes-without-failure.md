---
title: To-Do Lists Keep Agents Running for 45 Minutes Without Failure
slug: todo-lists-keep-agents-running-for-45-minutes-without-failure
description: Learn how structured to-do lists enable AI coding agents to run autonomously for 45+ minutes without context overflow or tool call failures.
primary_schema:
    - Article
    - FAQPage
tags:
    - autonomous-agents
    - productivity
    - agent-persistence
    - coding-agents
status: published
publish_date: "2025-07-09"
publish_time_pt: "9:00am"
source: "Office Hours"
---

Thirty minutes. No context overflow. No tool call failures.

That sentence would have been absurd six months ago.

## The failure mode

Autonomous coding agents have a ceiling. Not a model intelligence ceiling. A persistence ceiling.

You start a complex task: refactor this module, update the tests, fix the CI. The agent gets three steps in, then loses the thread. It forgets what it already tried. It runs out of context. It hits a tool call failure and stops.

You paste the error back in. It starts over. You paste another error. It suggests the same fix it already suggested.

The pattern is familiar: the agent runs for five minutes, maybe ten, then drifts or dies. You become the memory. You become the loop.

> "There is no way any of these tools would actually run without failing or falling over on the face, running out of context or tool call failures for 30 minutes."
>
> Hannes Rudolph, [Office Hours S01E13](https://www.youtube.com/watch?v=gI0FImx5Qjs)

That was the baseline expectation. Thirty minutes of autonomous work was not a thing agents did reliably.

## The mechanism

The fix is boring: a to-do list.

Not a metaphorical to-do list. A literal, structured checklist that the agent maintains across steps. Each item gets checked off. Each item persists in context. The agent knows what it finished, what it's working on, and what's left.

This does two things:

1. **Persistent state.** The agent doesn't have to infer progress from the codebase. It reads its own list.
2. **Structured recovery.** If the agent hits a failure, it has a checkpoint. It knows where to resume.

The result: runs that exceed 45 minutes with meaningful output. Not loops. Not drift. Actual progress through a multi-step task.

One tester pushed it to the limit:

> "I spent $400 almost or over $400 yesterday on API calls because this new to-do tool actually keeps it doing the thing. It doesn't stop."
>
> Hannes Rudolph, [Office Hours S01E13](https://www.youtube.com/watch?v=gI0FImx5Qjs)

Four hundred dollars in one day is a lot. But $400 for completed work is different from $40 for a loop that went nowhere.

## The tradeoff

This is not free.

Long-running tasks consume tokens. If the agent is productive for 45 minutes, you're paying for 45 minutes of inference. The cost scales with capability.

The question is: what were you paying before?

If your previous workflow was 10 minutes of agent time, then 20 minutes of your time re-prompting and pasting context, then another 10 minutes of agent time, you were already paying. You were just paying in engineering hours instead of API costs.

The to-do list shifts the cost from your time to the model's time. For teams where engineering hours are the bottleneck, that's the tradeoff you want.

> "The end goal is to make the experience as handoff as possible... to make it run autonomously."
>
> Melo, [Office Hours S01E13](https://www.youtube.com/watch?v=gI0FImx5Qjs)

The handoff is the point. You start the task, you walk away, you come back to a diff.

## Why this matters for your team

For a Series A team with four engineers shipping 6-8 PRs a week, the persistence ceiling matters.

Before: you assign a refactor to the agent. It runs for 8 minutes. It drifts. You spend 15 minutes re-prompting. It runs for another 5 minutes. It hits a tool failure. You give up and do it manually.

After: you assign the same refactor. It runs for 40 minutes. You review a diff.

The math isn't subtle. If even one task per engineer per week shifts from "agent attempt that failed" to "agent task that completed," you're reclaiming hours. Those hours compound.

The to-do list is not a feature announcement. It's a capability shift: from "agents work on small tasks" to "agents work on tasks that take 45 minutes."

## When to use it

Start with tasks that have clear checkpoints: migrations, test coverage expansions, documentation passes, refactors with defined scope.

Avoid tasks where the success criteria is ambiguous. The agent needs to know when an item is done. If you can't define "done" for each step, the list won't help.

Track cost-per-completed-task. If the agent runs for 45 minutes and ships a real diff, the $20 in tokens might be the best money you spend that week.

## How Roo Code closes the loop with persistent to-do tracking

Roo Code's to-do list feature enables the agent to close the loop on multi-step tasks without human intervention. The agent maintains a structured checklist that persists across tool calls, allowing it to track completed steps, identify the current work item, and recover from failures at known checkpoints.

With BYOK (bring your own key), you pay your API provider directly for the tokens consumed during extended autonomous runs. There's no markup on inference costs. The tradeoff is transparent: you spend tokens intentionally for outcomes, and Roo Code ensures those tokens produce completed work rather than circular loops.

**Roo Code's to-do list transforms agent sessions from fragile 5-minute attempts into reliable 45-minute autonomous runs by providing persistent state and structured recovery checkpoints.**

## Agent workflow comparison

| Dimension            | Without to-do tracking                   | With to-do tracking                  |
| -------------------- | ---------------------------------------- | ------------------------------------ |
| Typical run duration | 5-10 minutes before drift                | 30-45+ minutes of sustained progress |
| Context management   | Agent infers state from codebase         | Agent reads explicit checklist       |
| Failure recovery     | Starts over or repeats failed approaches | Resumes from last checkpoint         |
| Human intervention   | Frequent re-prompting required           | Handoff workflow - start and review  |
| Cost efficiency      | Tokens spent on loops and retries        | Tokens spent on completed work       |

## Frequently asked questions

### Why do AI coding agents lose track of long tasks?

Agents lose track because they lack persistent memory across tool calls. Without explicit state, the agent must infer progress from the codebase itself, which leads to repeated work, forgotten approaches, and context overflow as the conversation grows.

### How does a to-do list prevent context overflow?

The to-do list compresses task state into a small, structured format. Instead of retaining the full history of every action, the agent maintains a checklist of completed and pending items. This reduces context consumption while preserving the information needed to continue.

### Does Roo Code's to-do feature work with all LLM providers?

Yes. Roo Code uses BYOK (bring your own key), so the to-do list feature works with any supported provider including OpenAI, Anthropic, Google, and others. The persistent state mechanism operates at the agent level, independent of which model you configure.

### When should I avoid using long autonomous runs?

Avoid extended runs for tasks with ambiguous success criteria. If you cannot define what "done" means for each step, the agent cannot reliably check items off. Start with well-scoped tasks like migrations, test expansions, or refactors with clear boundaries.

### How do I track whether autonomous runs are cost-effective?

Measure cost-per-completed-task rather than cost-per-session. A 45-minute run that produces a shippable diff at $20 in tokens is more efficient than three 10-minute runs at $15 total that require manual completion. Track the ratio of agent-completed work to human intervention time.
