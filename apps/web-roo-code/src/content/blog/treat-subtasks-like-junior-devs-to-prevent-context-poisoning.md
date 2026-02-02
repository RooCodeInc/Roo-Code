---
title: Treat Subtasks Like Junior Devs to Prevent Context Poisoning
slug: treat-subtasks-like-junior-devs-to-prevent-context-poisoning
description: Learn how to prevent context poisoning in orchestrated AI workflows by treating subtasks like junior developers with atomic, scoped instructions.
primary_schema:
    - Article
    - FAQPage
tags:
    - orchestration
    - context-management
    - agentic-workflows
    - best-practices
status: published
publish_date: "2025-05-21"
publish_time_pt: "9:00am"
source: "Office Hours"
---

Twenty-seven hours. One autonomous run. Zero human interventions.

The secret wasn't a special model or a clever prompt. It was a constraint: keep subtasks so short that context never has time to rot.

## The drift problem

You're running an orchestrated workflow. The parent agent delegates a chunk of work to a subtask. The subtask starts fine: reads the repo, proposes a change, runs a test.

Then it keeps going. It accumulates context from three different files. It remembers a failed approach from ten minutes ago. It starts referencing assumptions it made earlier that were never validated.

By the time the subtask returns to the orchestrator, the context is poisoned. The orchestrator inherits stale beliefs. The next subtask launches with contaminated instructions.

This is context drift at scale. The longer a subtask runs, the more opportunity for garbage to accumulate.

## The junior dev heuristic

The fix is counterintuitive: treat your subtasks like junior developers.

Not as an insult. As a constraint. Junior devs need extremely specific, simple instructions. They can't be trusted with ambiguous scope. They work best when given one clear task with explicit success criteria.

> "The way that I managed that was just simply by telling orchestrator that your subtasks are junior devs and you need to treat them like they are stupid."
>
> Shank, [Office Hours S01E07](https://www.youtube.com/watch?v=yGVPIdn0mVw&t=1199)

This framing forces the orchestrator to decompose work into atomic units. Each subtask gets a narrow mandate. When something goes wrong, the blast radius is one short task, not a chain of contaminated context.

The 27-hour autonomous run worked because subtasks were kept extremely short:

> "Keeping tasks extremely short so that context didn't really have a chance to get poisoned before the task was returned back to orchestrator."
>
> Shank, [Office Hours S01E07](https://www.youtube.com/watch?v=yGVPIdn0mVw&t=1135)

## The model matters

Not every model can follow this pattern. Orchestration requires listening to rules about scope and knowing when to stop.

> "4.1 is the only model that actually managed to listen to my rules well enough to actually continue this for a prolonged period of time."
>
> Shank, [Office Hours S01E07](https://www.youtube.com/watch?v=yGVPIdn0mVw&t=2112)

The tradeoff: models that follow rules well may be slower or cost more per token. But if a cheaper model ignores your scope constraints and runs subtasks too long, you pay in poisoned context and failed orchestration runs.

## The guardrails

If you're setting up orchestrated workflows, here's the policy:

1. **Scope each subtask as if you're delegating to someone who just joined the team.** One file. One function. One test. Not "fix the authentication flow."

2. **Set explicit return conditions.** The subtask should know exactly when to stop and hand back to the orchestrator.

3. **Treat long subtasks as a smell.** If a subtask runs for more than a few minutes, it's probably accumulating context that will poison the next step.

4. **Pick a model that follows rules.** Test whether your model actually respects scope constraints before trusting it with multi-hour runs.

## Subtask scoping: old approach vs. new approach

| Dimension        | Old approach                           | New approach                                               |
| ---------------- | -------------------------------------- | ---------------------------------------------------------- |
| Task scope       | "Fix the authentication flow"          | "Update the login function in auth.ts to return a boolean" |
| Context lifetime | Subtask runs until work feels complete | Subtask returns after one atomic change                    |
| Failure handling | Debug within the same context          | Return to orchestrator, spawn fresh subtask                |
| Instructions     | Assume the agent understands intent    | Explicit success criteria and stop conditions              |
| Context health   | Degrades over time                     | Stays fresh through short cycles                           |

## How Roo Code prevents context poisoning

Roo Code's Orchestrator mode is built around the principle that subtasks should close the loop quickly and return control to the parent agent. When you configure Orchestrator, you can set explicit boundaries for each subtask, ensuring that no single agent accumulates stale context.

With BYOK (bring your own key), you control which models handle orchestration versus subtasks. This lets you assign a rule-following model like GPT-4.1 to the orchestrator role while using faster models for atomic subtasks. The result: context stays clean because each subtask operates in isolation, reports back, and terminates before drift sets in.

**Roo Code's orchestration pattern treats subtasks as disposable workers with narrow mandates, preventing the context poisoning that kills long-running autonomous workflows.**

## Why this matters for your team

For a team running orchestrated agents on production code, context poisoning is the silent killer. The orchestrator looks like it's working. Subtasks complete. But the output drifts because each step inherited garbage from the last.

The junior dev heuristic is a forcing function. It makes you think about scope before you delegate. It limits the damage when something goes wrong. And it turns a 27-hour autonomous run from a lucky experiment into a repeatable pattern.

The first step: audit how long your subtasks actually run. If any exceed a few minutes, break them down further.

## Frequently asked questions

### What is context poisoning in AI agent workflows?

Context poisoning occurs when an AI agent accumulates stale, incorrect, or irrelevant information during a long-running task. This contaminated context gets passed to subsequent subtasks or back to the orchestrator, causing downstream failures and drift from the original goal.

### How short should subtasks be to avoid context drift?

Subtasks should be scoped to complete in minutes, not hours. A good rule of thumb: if a subtask touches more than one file or one function, it's probably too broad. The goal is to return to the orchestrator before the context has time to accumulate garbage.

### Does Roo Code support orchestrated workflows with subtask isolation?

Yes. Roo Code's Orchestrator mode lets you define explicit boundaries for subtasks and configure which models handle different roles. This architecture keeps subtasks atomic and prevents context from bleeding between tasks, which is essential for long-running autonomous workflows.

### Why do some models fail at orchestration while others succeed?

Orchestration requires a model to follow rules about scope, stop conditions, and delegation. Some models ignore these constraints and let subtasks run too long. Testing your model's ability to respect scope boundaries is critical before trusting it with extended autonomous runs.

### How do I audit my current subtask duration?

Review your orchestration logs to measure how long each subtask runs before returning. Look for subtasks exceeding a few minutes or touching multiple files. These are candidates for further decomposition into smaller, atomic units.
