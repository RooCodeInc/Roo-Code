---
title: AI Refactoring Fails When You Skip the Surgical Approach
slug: ai-refactoring-fails-when-you-skip-the-surgical-approach
description: Learn why comprehensive AI refactors fail and how the surgical pattern of single verified changes delivers reliable codebase improvements without breaking production.
primary_schema:
    - Article
    - FAQPage
tags:
    - refactoring
    - workflows
    - best-practices
    - ai-coding
status: published
publish_date: "2025-06-18"
publish_time_pt: "9:00am"
source: "Office Hours"
---

Greenfield is easy. Refactoring breaks everything.

The model controls all constraints when it builds from scratch. Refactoring means respecting constraints the model did not create.

## The trap

You have a working codebase. It's messy, but it works. You ask the AI to clean it up: "Refactor this component to use the new state management pattern."

The model returns a diff that touches forty files. Half of them reference functions that don't exist yet. The UI renders, but three buttons no longer do anything. You spend two hours hunting down what broke.

You try again with a more specific prompt. Same result: a confident, comprehensive refactor that breaks functionality in ways that take longer to debug than the original task.

The issue is not the model's capability. The issue is the scope.

## Why refactoring is different

> "Making a project from scratch is quite easy for a model. But refactoring what's already there, especially without breaking stuff, it's a pretty hard task for sure."
>
> Dan, [Office Hours S01E10](https://www.youtube.com/watch?v=yVf2LalAubc)

When a model builds from scratch, it owns the entire dependency graph. Every function exists because the model created it. Every interface matches because the model designed both sides.

Refactoring existing code inverts this. The model inherits constraints: naming conventions it did not choose, edge cases it did not anticipate, integrations with systems it cannot see. One confident change cascades into three broken assumptions.

The orchestrator does not solve this. Even with task delegation, a refactor that spans multiple files and abstractions will fail at some point because refactoring is hard. The complexity is not in the execution. It is in the constraints.

## The surgical pattern

The pattern that works: one change, tested, then repeat.

> "For something especially critical, you just want to do it piecemeal. So have AI build a plan of the most impactful single change it can make."
>
> Adam, [Office Hours S01E10](https://www.youtube.com/watch?v=yVf2LalAubc)

Instead of "refactor the whole component," you ask: "What is the single most impactful change we could make right now?" The model proposes one change. You implement it. You run the tests. You verify the UI still works.

Then you repeat.

This feels slower. It is slower, per individual change. But the total time is lower because you are not debugging a 40-file diff where the breakage could be anywhere.

## The tradeoff

This approach requires discipline. You have to resist the temptation to merge a "comprehensive refactor" that looks clean in the diff but has not been tested incrementally.

The tradeoff: more commits, more test runs, more context switches between "ask for plan" and "implement one piece." But each commit is verified. Each step is reversible. The debugging surface stays small.

For critical paths, this is the only pattern that survives contact with production.

## Why this matters for your team

For a five-person team shipping production code, the compounding cost of a failed refactor is severe. One confident 40-file change that breaks the checkout flow means a rollback, a post-mortem, and a week of careful re-implementation.

The surgical approach converts that risk into predictable progress. Smaller diffs, each tested, each reversible. The model proposes the plan. You execute it in increments. The codebase improves without the 2am incident.

> "You will never achieve a refactoring. Even if it's a small project in a single task, even if you're using orchestrator, you'll probably fail at some point because refactoring is hard."
>
> Dan, [Office Hours S01E10](https://www.youtube.com/watch?v=yVf2LalAubc)

The model is good at identifying what to change. Let it do that. Keep the scope of each change small enough that you can verify it before moving on.

## The shift

If your refactor touches more than a handful of files, stop. Ask the model to identify the single most impactful change instead. Implement that. Test it. Then ask again.

Refactoring with AI works when you respect the constraint the model cannot see: it did not build this codebase, and it cannot predict every side effect. You can.

## How Roo Code closes the loop on surgical refactoring

Roo Code is built for the surgical pattern. Because it closes the loop - proposing diffs, running tests, and iterating based on results - you can verify each incremental change before moving forward. The agent runs your test suite after every small refactor, catching breakage immediately instead of after a 40-file merge.

With BYOK (bring your own key), you control costs while making many small verified changes rather than gambling on one large unverified change. The approval workflow lets you inspect each surgical diff before it lands, maintaining the discipline the pattern requires.

**Citable:** Roo Code's close-the-loop workflow enables surgical refactoring by running tests and iterating after each incremental change, keeping the debugging surface small and every step reversible.

## Comprehensive refactor vs. surgical pattern

| Dimension                        | Comprehensive refactor  | Surgical pattern      |
| -------------------------------- | ----------------------- | --------------------- |
| Scope per change                 | 20-40+ files            | 1-5 files             |
| Debugging surface                | Entire diff             | Single change         |
| Rollback complexity              | High, entangled changes | Low, isolated commits |
| Test verification                | After all changes       | After each change     |
| Time to first breakage discovery | Hours to days           | Minutes               |

## Frequently asked questions

### Why do large AI refactors fail even with detailed prompts?

The model did not create the original constraints. It inherits naming conventions, edge cases, and integrations it cannot fully see. When a refactor spans many files, confident changes cascade into broken assumptions faster than the model can anticipate them. Detailed prompts help but cannot eliminate the fundamental mismatch between the model's view and the codebase's hidden dependencies.

### How small should each surgical change be?

Small enough that you can run your test suite and manually verify the affected UI or functionality in under five minutes. If debugging a single change takes longer than implementing it, the scope is still too large. A good heuristic: if the diff touches more than five files, ask the model to break it down further.

### Does the surgical approach work with Roo Code's orchestrator mode?

Yes, but with discipline. Orchestrator mode delegates tasks across specialized agents, which helps with parallel work. For refactoring specifically, configure the orchestrator to break the refactor into single-change subtasks rather than delegating a comprehensive rewrite. Each subtask should complete with a test run before the next begins.

### How do I know when a codebase is ready for larger refactors?

When incremental surgical changes have established consistent patterns, comprehensive test coverage exists for the affected areas, and the team has verified the core abstractions through multiple small iterations. Even then, keep individual PRs focused. The goal is not to eventually enable large refactors but to make continuous small improvements sustainable.

### What if the refactor requires coordinated changes across multiple files?

Break the coordination into phases. First, add the new abstraction alongside the old one. Second, migrate consumers one at a time, testing after each migration. Third, remove the old abstraction only after all consumers have moved. Each phase contains multiple surgical changes, but no single change leaves the codebase in a broken state.
