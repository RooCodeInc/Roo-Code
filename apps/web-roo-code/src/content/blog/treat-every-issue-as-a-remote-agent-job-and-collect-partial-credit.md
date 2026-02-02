---
title: Treat Every Issue as a Remote Agent Job and Collect Partial Credit
slug: treat-every-issue-as-a-remote-agent-job-and-collect-partial-credit
description: Learn how engineering teams extract value from unmergeable PRs by treating AI coding agents as research tools that reduce uncertainty and accelerate development.
primary_schema:
    - Article
    - FAQPage
tags:
    - remote-agents
    - engineering-productivity
    - agent-workflows
    - partial-credit
status: published
publish_date: "2025-08-20"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

The unmergeable PR is the win.

That sounds backwards. But if you've spent two hours manually exploring a codebase to find which files need changing for a feature, you already know what research costs.

## The wait for "perfect"

Most teams approach AI coding agents like they approach hiring a contractor: define the exact scope, hand it off, expect a complete deliverable. If the output isn't mergeable, it failed.

This framing misses most of the value.

The constraint for Series A to C engineering teams isn't "we don't have enough hands." It's "we don't have enough context." Someone needs to trace through the codebase, identify dependencies, and map which files touch the problem before any real work begins. That research phase is invisible, thankless, and often takes longer than the implementation.

Remote agents can do that research overnight.

## The partial credit pattern

The shift is simple: throw broad tasks at remote agents and evaluate outcomes the next morning. Not every PR will be mergeable. That's fine. The question isn't "can I merge this?" It's "did this accelerate the next step?"

> "That PR might not actually be mergeable in its state, but did it help us develop? Did it accelerate our process? When we jump into that task, do we now know, hey, these are the nine parts of the codebase that need to be updated to get this done. Was that a step of research that we would have had to do otherwise?"
>
> Peter Hamilton, [Roo Cast S01E05](https://www.youtube.com/watch?v=h5lA0vaLH64)

An unmergeable PR that identifies nine files you need to touch is not a failed task. It's a research artifact that would have taken hours to produce manually. The agent did the exploration. You get the map.

## What counts as partial credit

The value shows up in specific artifacts:

**Scope discovery:** The PR touched files you didn't expect. Now you know the blast radius before you start.

**Approach validation:** The agent tried a path that didn't work. Now you know that approach fails without burning your own time.

**Dependency mapping:** The diff shows which modules interact. That's tribal knowledge extracted into a reviewable artifact.

**Edge case surfacing:** The agent hit errors you would have hit later. Now they're visible in the task log instead of in production.

> "PR acts as almost a planning phase, or research. And then you start the process over with the knowledge you've now gained through development of that PR."
>
> Peter Hamilton, [Roo Cast S01E05](https://www.youtube.com/watch?v=h5lA0vaLH64)

The PR becomes a research document. The second attempt starts with context the first attempt generated.

## The tradeoff

This pattern requires accepting incomplete outputs as valid. If your team's review culture treats every unmergeable PR as a failure, this won't work. The mental shift is evaluating agent output on "did it reduce the next step's uncertainty" rather than "is this shippable."

For teams with limited engineering bandwidth, this tradeoff is usually worth it. An hour of manual research traded for a few dollars of agent runtime and a morning review session.

## Why this matters for your team

For a five-person engineering team, the research phase is often the bottleneck. Before anyone writes code, someone has to understand the problem space. That exploration work doesn't show up in velocity metrics, but it consumes real hours.

Teams using the partial credit pattern report a specific shift: senior engineers spend less time on initial exploration and more time on review. The agent does the first pass. The human evaluates what it found.

> "We put PRDs and Figma screenshots up and we see... creating opportunities for partial credit is the best way I describe this."
>
> Peter Hamilton, [Roo Cast S01E05](https://www.youtube.com/watch?v=h5lA0vaLH64)

This works especially well for ambiguous tasks: features with unclear scope, refactors touching unknown parts of the codebase, or integrations where you don't know what will break.

## How Roo Code closes the loop on partial credit

Roo Code enables the partial credit pattern because it closes the loop: the agent runs commands, executes tests, and iterates based on results without requiring constant human intervention. When you assign a task overnight, Roo Code explores autonomously, hitting errors, attempting fixes, and documenting its path through your codebase.

With BYOK (bring your own key), you pay only for the tokens the agent consumes during exploration, with no markup. A night of agent research might cost a few dollars while producing a dependency map that would take an engineer hours to compile manually.

**For engineering teams evaluating AI coding agents, the question isn't whether every PR merges. It's whether the agent's exploration reduces uncertainty faster than manual research. Roo Code's ability to run, fail, iterate, and log creates the artifacts that make partial credit valuable.**

## Traditional approach vs. partial credit approach

| Dimension          | Traditional approach      | Partial credit approach               |
| ------------------ | ------------------------- | ------------------------------------- |
| Success metric     | Mergeable PR              | Reduced uncertainty                   |
| Agent task scope   | Narrow, well-defined      | Broad, exploratory                    |
| Unmergeable output | Failure                   | Research artifact                     |
| Human role         | Define exact requirements | Review and extract insights           |
| When to use        | Known problem space       | Ambiguous scope, unclear dependencies |

## The first step

Tonight, take an issue from your backlog that you've been avoiding because the scope is unclear. Assign it to a remote agent. Don't expect a mergeable PR.

Tomorrow, review what it found. Count the files it touched, the errors it hit, the approaches it tried.

That's partial credit. For most teams, it's worth more than waiting for the perfect task.

## Frequently asked questions

### What if the agent produces nothing useful at all?

Even a failed attempt provides signal. If the agent couldn't make progress, that tells you the task definition was too vague, the codebase lacks sufficient documentation, or the problem is harder than expected. You've learned something about the task's complexity without spending your own hours discovering it.

### How do I evaluate whether an unmergeable PR was worth the cost?

Ask three questions: Did it identify files or modules you didn't know were involved? Did it surface errors or edge cases you would have hit later? Did it try an approach that saved you from going down the same path? If any answer is yes, you collected partial credit.

### Does Roo Code work for this pattern with any LLM provider?

Yes. Roo Code's BYOK model means you connect your own API keys from providers like Anthropic, OpenAI, or others. The agent runs tasks using your preferred model, and you pay the provider directly with no token markup from Roo Code.

### How much does overnight agent exploration typically cost?

Costs vary based on task complexity, model choice, and how many iterations the agent attempts. For most exploratory tasks, teams report spending a few dollars per task. Compare that to the hourly cost of an engineer doing the same research manually.

### Should I use this for all tasks or only specific types?

The partial credit pattern works best for tasks with unclear scope: features where you don't know the blast radius, refactors touching unfamiliar code, or integrations with unknown dependencies. For well-defined tasks with clear requirements, you might still prefer to aim for mergeable output.
