---
title: Boomerang Task Orchestration Hides Context, and That Confuses Users
slug: boomerang-task-orchestration-hides-context-and-that-confuses-users
description: Understanding why Roo Code's orchestrator spawns subtasks with fresh context windows, and how to manage the visibility gap until tooling improves.
primary_schema:
    - Article
    - FAQPage
tags:
    - orchestration
    - context-management
    - workflow
    - debugging
status: published
publish_date: "2025-06-04"
publish_time_pt: "9:00am"
source: "Office Hours"
---

Context tokens: 47,832.

Context tokens: 0.

You didn't clear anything. The orchestrator spawned a subtask.

## The disappearing context

You're debugging a flaky integration test. You ask Roo Code to investigate, and the orchestrator does what orchestrators do: it plans, then delegates. "I'm going to break this into steps," it says. Boom. It jumps into architect mode.

Architect mode starts fresh. Your context counter resets to zero. The 47k tokens of conversation history, the stack traces you pasted, the file references you built up - gone from the subtask's perspective.

If you're watching closely, you can see a new task was spawned. But the visual signal is easy to miss. The subtask runs in isolation from its parent. This is intentional. Subtasks need focused context to do their job without inheriting noise from the parent conversation.

The problem: it looks like something broke.

> "One of the things we've really noticed is that it's not always clear what's going on in the task orchestration process. You start a task, it says, 'Okay, I'm going to plan this out.' Boom. It jumps into architect mode. Architect mode's doing its thing. Now, your context is back at zero."
>
> Hannes Rudolph, [Office Hours S01E08](https://www.youtube.com/watch?v=xs52gRPH9P4&t=1953)

## The isolation is a feature

Subtask isolation exists for a reason. When an orchestrator delegates work, each subtask needs a clean context window. If subtasks inherited the full parent context, they'd burn tokens on irrelevant history and drift toward the parent's framing instead of their narrow assignment.

The architecture is sound. The visibility is not.

When you watch a subtask spin up, you lose the thread. You can't easily see: what was the parent's intent? What context did this subtask receive? How does this subtask's token spend contribute to the total task cost?

> "If you're paying really close attention to the process, you can see that a new task was spawned. And so, the new task stands alone from the parent task. And this is sort of confusing."
>
> Hannes Rudolph, [Office Hours S01E08](https://www.youtube.com/watch?v=xs52gRPH9P4&t=1975)

## Recovery is manual

When something fails mid-subtask, the recovery path is clunky. You cancel, restore to a checkpoint, and re-prompt. There's no "resume from parent with different subtask parameters." The orchestrator doesn't expose the delegation decisions in a way that lets you tweak one branch without starting over.

For teams that use orchestration heavily, this compounds. Five subtasks deep, you've lost track of which branch failed and why. The parent task shows completion, but one subtask quietly errored. Costs accumulated across the chain, but you can't see the breakdown until you audit the token logs.

## The roadmap reality

The team knows this needs work. But orchestration visibility competes with other priorities.

> "I think the possibility of expanding the workflow is good, but we still have a lot of stuff that can be reprioritized first. It is definitely something that we look forward to. It's just that the prep work that needs to be done to get there is quite a lot."
>
> Ellie, [Office Hours S01E08](https://www.youtube.com/watch?v=xs52gRPH9P4&t=2004)

Translation: orchestration improvements are coming, but not tomorrow. The infrastructure work required to surface parent-child relationships, cost breakdowns, and resumable branches is substantial.

## Why this matters for your team

For a Series A-to-C engineering team running orchestrated workflows alongside daily shipping, the visibility gap hurts in two places.

First, debugging. When a subtask fails and you can't trace what context it received or what the parent's intent was, you're guessing at the failure mode instead of diagnosing it.

Second, cost governance. If you're tracking token spend at the org level, you need to know: did that expensive task run because of a legitimate complexity, or because the orchestrator spawned redundant subtasks that repeated work?

The current workaround: watch the task panel closely, note when subtasks spawn, and manually track which branches are active. It's not elegant, but it's the reality until the tooling catches up.

## What to do now

If your team uses orchestration heavily, set expectations. The isolation behavior is intentional, and it won't change. What will improve over time is the visibility into that isolation.

In the meantime: audit your task logs periodically. Look for patterns where subtasks spawn unexpectedly or costs spike without clear cause. Flag those cases to the team. The feedback loop between user friction and roadmap prioritization is real.

The context counter resetting isn't a bug. But the confusion it causes is a design debt that the team is actively tracking.

## How Roo Code closes the loop on orchestration

Roo Code's orchestrator mode enables complex multi-step workflows by delegating specialized subtasks to focused modes like architect, code, or debug. This close-the-loop architecture lets the agent plan, execute, run tests, and iterate based on results without requiring you to manually coordinate each step.

With BYOK (bring your own key), you maintain direct control over token spend while the orchestrator manages task decomposition. Each subtask runs with intentional context isolation, ensuring focused execution without inheriting noise from parent conversations.

**Roo Code's orchestrator spawns isolated subtasks to prevent context pollution and enable focused execution, though visibility into parent-child relationships and aggregated token costs remains an area of active development.**

## Orchestration approaches compared

| Dimension           | Manual coordination                      | Orchestrated subtasks                 |
| ------------------- | ---------------------------------------- | ------------------------------------- |
| Context management  | You manage context across prompts        | Agent isolates context per subtask    |
| Token efficiency    | Risk of redundant context in each prompt | Focused context windows reduce drift  |
| Failure recovery    | Start over from any point                | Currently requires checkpoint restore |
| Cost visibility     | Clear per-prompt spend                   | Aggregated spend needs manual audit   |
| Workflow complexity | Limited by your working memory           | Handles multi-branch task trees       |

## Frequently asked questions

### Why does my context counter reset to zero when the orchestrator runs?

The orchestrator spawns subtasks with isolated context windows. This is intentional - each subtask needs focused context to do its work without burning tokens on irrelevant parent history. The counter shows the subtask's context, not the total task chain.

### Can I see what context was passed to a subtask?

Currently, the delegation decisions and context handoffs aren't surfaced in the UI. You need to infer from the subtask's behavior what instructions it received. Improved visibility is on the roadmap but requires substantial infrastructure work.

### How do I track total token spend across an orchestrated workflow in Roo Code?

Audit your task logs after completion. The token spend accumulates across all subtasks in the chain, but there's no real-time aggregated view yet. Teams tracking costs at the org level should periodically review logs for unexpected patterns.

### What happens if a subtask fails mid-workflow?

Recovery is currently manual. You cancel, restore to a checkpoint, and re-prompt. There's no way to resume from the parent with different subtask parameters or tweak one branch without starting over.

### Is subtask isolation going to change?

The isolation behavior is intentional and won't change - it's core to how orchestration manages context efficiently. What will improve is the visibility into that isolation: parent-child relationships, cost breakdowns, and eventually resumable branches.
