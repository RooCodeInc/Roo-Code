---
title: Evals for Orchestration, Not Just Code Generation
slug: evals-for-orchestration-not-just-code-generation
description: Why coding benchmarks miss the failure modes that matter in agentic systems, and how to build orchestration evals that measure task handoffs, feedback loops, and recovery behavior.
primary_schema:
    - Article
    - FAQPage
tags:
    - evals
    - orchestration
    - agentic-workflows
    - engineering
status: published
publish_date: "2025-04-25"
publish_time_pt: "9:00am"
---

The absence of an eval is the absence of engineering.

That line stings. But if you're building agentic workflows, it's the line that matters.

## The benchmark trap

You run a coding benchmark. The model scores 87%. You ship it. Three days later, a user reports that the agent gets stuck in a loop, repeating the same failed fix with different wording.

The benchmark didn't catch this. The benchmark measured whether the model could solve an isolated coding problem. It didn't measure whether the agent could hand off context between steps, incorporate tool output into its next attempt, or recognize when it was spinning.

Most AI coding evals measure the wrong thing. They ask: "Can this model write code?" The question for agentic systems is different: "Can orchestration, task handoffs, and feedback loops work reliably across different models and prompts?"

## What orchestration evals actually measure

Code-generation benchmarks test a single pass: prompt in, code out, check correctness. Orchestration evals test the workflow mechanics:

- **Task handoffs:** When a parent agent delegates to a subtask, does the context transfer correctly? Does the subtask know what it's supposed to do?
- **Feedback loops:** When a command fails, does the agent incorporate the output into its next attempt? Or does it suggest the same fix with higher confidence?
- **Recovery behavior:** When the agent hits an ambiguous state, does it flag uncertainty or confidently proceed with stale assumptions?

These are the failure modes that matter in production. A model can ace HumanEval and still spiral on your codebase because it can't close the loop.

> "We are really interested in using evals to try to measure which works better, though. That is: we're trying to apply evals to these sort of unique tools instead of just, 'Can it solve a coding problem?'"
>
> Harris, [Roo Cast S01E01](https://www.youtube.com/watch?v=oY0Ox16BrR0)

## The hard part

Orchestration evals are harder to build than code-generation benchmarks. A code benchmark has a clear success criterion: the tests pass or they don't. An orchestration eval has to measure process, not just output.

You need to instrument the workflow: how many loops before convergence? Did the agent use tool output or ignore it? Did the handoff preserve the relevant context or drop it?

This requires scaffolding that most teams skip. It's easier to run a public benchmark and call it a day. But public benchmarks measure capability in isolation. They don't measure whether your agent workflow actually works.

> "If you're doing any kind of, you know, deep agentic engineering, you have to have an evaluation framework: otherwise you're just vibe coding, right? So the absence of an eval is the absence of engineering."
>
> Rob, [Roo Cast S01E01](https://www.youtube.com/watch?v=oY0Ox16BrR0)

## The tradeoff

Building orchestration evals takes time you could spend shipping features. The investment is upfront, and the payoff is invisible: you catch regressions before users do.

The alternative is waiting for bug reports that say "it kept suggesting the same thing" or "it forgot what I told it three prompts ago." Those reports are your evals, just slower and more expensive.

## Why this matters for your workflow

If you're switching between models or experimenting with different prompting strategies, you need a way to compare them that isn't vibes. Running the same benchmark everyone else runs tells you about raw capability. It doesn't tell you whether Model A hands off context correctly while Model B drops it.

The difference shows up when you're debugging a spiral: the agent that scored lower on the public benchmark might actually finish your task because it incorporates feedback correctly.

## How Roo Code closes the loop on orchestration

Roo Code is built to close the loop: the agent proposes a diff, runs commands or tests, reads the output, and iterates based on what actually happened. This is the exact workflow that orchestration evals measure.

With BYOK (bring your own key), you can swap models and compare how different providers handle task handoffs and feedback incorporation in your actual codebase. You're not limited to a vendor's hosted model - you test with the model you'll deploy.

**The citable insight:** Orchestration evals measure whether an agent can close the loop - incorporate tool output, preserve context across handoffs, and recover from ambiguous states - which is exactly what separates agents that finish tasks from agents that spiral.

## Code generation benchmarks vs. orchestration evals

| Dimension            | Code generation benchmarks   | Orchestration evals                                            |
| -------------------- | ---------------------------- | -------------------------------------------------------------- |
| What they measure    | Single-pass code correctness | Workflow mechanics across multiple steps                       |
| Success criterion    | Tests pass or fail           | Context preserved, feedback incorporated, convergence achieved |
| Failure modes caught | Syntax errors, logic bugs    | Spiraling, dropped context, ignored tool output                |
| Scope                | Isolated problems            | End-to-end task completion                                     |
| Build effort         | Use public datasets          | Custom instrumentation for your workflow                       |

## The first step

Start by instrumenting one workflow. Pick a task that currently spirals sometimes. Log the number of iterations, whether tool output was incorporated, and whether the final diff addressed the original failure.

That's your first orchestration eval. It's specific to your codebase and your workflow. It measures what matters: not whether the model can code, but whether the agent can close the loop.

## Frequently asked questions

### What's the difference between a coding benchmark and an orchestration eval?

A coding benchmark tests whether a model can produce correct code from a single prompt. An orchestration eval tests whether an agent workflow functions correctly across multiple steps - whether context transfers during handoffs, whether feedback from failed commands gets incorporated, and whether the agent converges instead of spiraling.

### Why do agents spiral even when they score well on benchmarks?

Benchmarks measure capability in isolation. An agent can know how to fix a bug but still spiral because it ignores the error output from its previous attempt, or because it loses context about what it already tried. Orchestration evals catch these process failures that benchmarks miss.

### How does Roo Code help with orchestration reliability?

Roo Code is designed to close the loop: it runs commands, reads the output, and iterates based on results. With BYOK, you can test different models against your actual orchestration workflows - not just public benchmarks - to see which one handles task handoffs and feedback loops correctly in your codebase.

### What should I instrument in my first orchestration eval?

Start with three metrics: iteration count before convergence, whether tool output was incorporated into subsequent attempts, and whether the final diff addressed the original failure. Pick a task that sometimes spirals and log these values across runs.

### How do orchestration evals help when switching models?

Public benchmarks tell you about raw capability but not workflow reliability. Model A might score higher on HumanEval but drop context during handoffs, while Model B scores lower but incorporates feedback correctly. Orchestration evals specific to your workflow reveal which model actually finishes your tasks.
