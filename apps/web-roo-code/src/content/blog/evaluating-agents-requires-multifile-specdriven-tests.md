---
title: Evaluating Agents Requires Multi-File, Spec-Driven Tests
slug: evaluating-agents-requires-multifile-specdriven-tests
description: Why single-file coding challenges fail to predict real agent performance, and how multi-file, spec-driven evals with hybrid scoring surface the failures that matter.
primary_schema:
    - Article
    - FAQPage
tags:
    - agent-evaluation
    - agentic-workflows
    - testing
    - developer-tools
status: published
publish_date: "2025-09-10"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

Eight files changed. Thirty files changed. A new feature wired into an existing codebase.

That's what real agentic work looks like. Not a single-file coding challenge.

## The mismatch

Most public evals test a narrow slice: solve this algorithm, fix this function, generate this class. One file in, one file out. Pass or fail.

But when you hand an agent a real task - something like "add OAuth to this Rails app" or "refactor the billing module to support subscriptions" - the scope expands. The agent touches config files, migrations, controllers, tests, and documentation. The work spans the codebase, not a single file.

If your eval only tests single-file edits, you're measuring something, but not the thing that matters for production workflows.

> "A lot of the evals out there aren't doing - you know, a lot of mine will be from 8 to 30 files that are touched in that regard, or you know building something from zero to one, or editing an existing codebase, or adding a new feature with a very detailed spec."
>
> Adam, [Roo Cast S01E08](https://www.youtube.com/watch?v=uA7NLvGwHAE)

## The spec is the test

The prompts for these evals are not short. Some run 400 to 500 lines. They detail everything that needs to be there: the structure, the constraints, the edge cases. The spec is comprehensive enough that you could hand it to a senior engineer and expect a consistent result.

This is intentional. The prompt is the contract. If the spec is vague, you can't distinguish "the agent misunderstood" from "the agent failed." Clear specs make failures diagnosable.

The tradeoff: building these evals is labor-intensive. You construct the solution manually first. Then you design the prompt and evaluation criteria to match what a correct implementation looks like. There's no shortcut. The eval is only as good as the reference solution you built by hand.

## Scoring beyond pass/fail

A binary pass/fail metric collapses too much information. An agent that gets 90% of the way there and misses one edge case looks the same as an agent that produced garbage.

A hybrid scoring system provides more signal:

- **Unit tests:** Did the output actually work? Run the tests, count what passes.
- **Static code analysis:** Is the code structured correctly? Lint it, check for patterns.
- **LLM-as-judge:** Does the implementation match the intent? Use a model to evaluate adherence to the spec.

> "About 30% of my score is LLM as a judge. Then there's points allocated for unit tests. And then there's points allocated for static code analysis."
>
> Adam, [Roo Cast S01E08](https://www.youtube.com/watch?v=uA7NLvGwHAE)

The weights matter. If you rely entirely on unit tests, you miss style and structure issues. If you rely entirely on LLM-as-judge, you miss concrete correctness. The combination catches failures that any single method would miss.

## The autonomy requirement

These evals test autonomous execution. The agent receives the spec and runs. No human in the loop to course-correct. No "actually, I meant this other thing." The prompt contains everything.

This is closer to how teams actually deploy agents: set the task, let it run, review the result. An eval that requires human intervention during execution is testing a different workflow.

> "It's autonomous. So it's basically like it gives a - it's imagine like a really - like some of the prompts can be four or 500 lines like it is - it details out everything that needs to be there without like filling in the logic."
>
> Adam, [Roo Cast S01E08](https://www.youtube.com/watch?v=uA7NLvGwHAE)

## How Roo Code closes the loop on multi-file tasks

When an agent tackles a multi-file task, the critical capability is closing the loop: proposing changes, running tests, observing failures, and iterating until the implementation passes. Roo Code is an AI coding agent that executes this full cycle autonomously within your editor.

With BYOK (Bring Your Own Key), you route tasks to the model that fits your eval criteria - whether that's a model optimized for long-context reasoning across many files or one tuned for code generation accuracy. The agent runs commands, executes your test suite, and iterates based on real feedback from your codebase.

**For teams building evals or evaluating agents, the question isn't just "can it write code?" It's "can it coordinate changes across eight files, run the tests, and fix what breaks?"** Roo Code's loop-closing architecture directly addresses this by treating test execution and iteration as core to the workflow, not optional add-ons.

## Single-file vs multi-file evals compared

| Dimension         | Single-file evals             | Multi-file, spec-driven evals               |
| ----------------- | ----------------------------- | ------------------------------------------- |
| Scope             | One function or class         | 8-30 files across the codebase              |
| Spec length       | Brief prompt                  | 400-500 lines with constraints              |
| Failure diagnosis | Ambiguous                     | Clear - spec serves as contract             |
| Real-world signal | Low - tests algorithmic skill | High - tests coordination and coherence     |
| Build effort      | Low                           | High - requires reference solution          |
| Scoring           | Usually pass/fail             | Hybrid: tests + static analysis + LLM judge |

## Why this matters for your workflow

For an engineer evaluating which agent to use, or which model to route tasks to, the eval methodology determines the signal quality.

If you're testing with single-file challenges, you might pick a model that looks great on algorithmic puzzles but fails when the task requires coordinating changes across a codebase. You won't know until you're debugging production issues.

Multi-file, spec-driven evals surface the failure modes that matter: can the agent maintain coherence across files, follow a detailed spec without drifting, and produce something that actually runs?

The investment is upfront. Build the reference solution. Write the comprehensive spec. Design the scoring rubric. The payoff is evals that predict real-world performance, not just benchmark performance.

If your current evals don't touch multiple files, they're measuring the wrong thing. Start with a real task from your codebase and work backwards.

## Frequently asked questions

### Why do single-file evals fail to predict real agent performance?

Single-file evals test isolated coding skill - algorithm implementation, function writing, or class generation. Real agentic work requires coordinating changes across config files, migrations, controllers, tests, and documentation simultaneously. An agent that excels at single-file tasks may fail when required to maintain coherence across a codebase, and you won't discover this until production.

### How long should an eval spec be for multi-file tasks?

Comprehensive specs for multi-file evals often run 400 to 500 lines. The spec must detail the structure, constraints, edge cases, and expected outcomes clearly enough that a senior engineer would produce a consistent result. Vague specs make it impossible to distinguish agent misunderstanding from agent failure.

### What scoring approach works best for agent evals?

A hybrid approach combining unit tests (30-40%), static code analysis (30%), and LLM-as-judge (30%) provides the most signal. Unit tests alone miss style and structure issues. LLM-as-judge alone misses concrete correctness. The combination catches failure modes that any single method would miss.

### How does Roo Code handle multi-file agent tasks differently?

Roo Code closes the loop by running commands,executing tests, and iterating based on results - all autonomously within your editor. With BYOK, you choose the model that fits your task complexity. The agent doesn't just propose changes; it validates them against your actual test suite and fixes what breaks, matching how production agent deployments actually work.

### Should evals allow human intervention during execution?

For testing autonomous agent performance, no. Evals that require human course-correction during execution are testing a different workflow - one with a human in the loop. Production agent deployments typically follow the pattern of "set the task, let it run, review the result." Your evals should match this pattern to generate predictive signal.
