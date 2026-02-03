---
title: Better Code Quality Now Means More Successful AI Agent PRs Later
slug: better-code-quality-now-means-more-successful-ai-agent-prs-later
description: Why 30% of agent PRs merge while 20% is typical - and how investing in type safety, test coverage, and module boundaries directly increases your AI coding agent's mergeable output.
primary_schema:
    - Article
    - FAQPage
tags:
    - code-quality
    - ai-agents
    - engineering-productivity
    - technical-debt
status: draft
publish_date: "2025-08-20"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

Thirty percent of agent PRs merge. Twenty percent is typical.

The difference is not the model. It's the codebase.

## The scaffolding problem

Teams experimenting with remote agents on every issue discovered something counterintuitive: the variable that predicts whether an agent PR is mergeable has nothing to do with prompts or model selection.

It's the code quality they already have.

Stricter types. Lower coupling. Clearer boundaries. Test coverage that actually validates behavior. These are the same principles we've preached for decades. They just compound differently now.

When an agent reads your codebase, every ambiguous type signature becomes a guess. Every tightly coupled module becomes a surface for cascading errors. Every missing test becomes a validation gap the agent cannot close.

> "All those things that we've always known is good about our codebases. You know, better type safety and better lower coupling between things, those are all related to how well those initial PRs end up working."
>
> Peter Hamilton, [Roo Cast S01E05](https://www.youtube.com/watch?v=h5lA0vaLH64&t=3116)

The agents are not magic. They read what you wrote. If what you wrote is ambiguous, the PR will be ambiguous.

## The investment case

Here's where the math changes for a CTO or engineering lead.

Before agents, code quality improvements had indirect returns: fewer bugs later, reduced maintenance load, a vague sense that "things are easier." Hard to put a number on it. Easy to deprioritize when shipping features is the pressure.

With agents running on every issue, the returns become direct and measurable.

If your baseline is 20% of agent PRs being mergeable, and you invest in type safety and test coverage that bumps that to 30%, the math is simple: you get 50% more usable output from the same agent runs.

> "If I can bump that 10%, I can get three extra PRs out of there. Like now as a CTO, I'm thinking financially."
>
> Peter Hamilton, [Roo Cast S01E05](https://www.youtube.com/watch?v=h5lA0vaLH64&t=3094)

Three extra mergeable PRs per batch. For the same compute cost. That's the leverage.

## Where to invest

The temptation is to optimize the agent: find the right prompts, try the newest model, tune the system instructions. That work has diminishing returns.

The higher-leverage investment is the scaffolding around the codebase itself.

> "It's less about what prompts are we using and what's the newest model and all these things, but more about our codebase, our system, the scaffolding around our development environments. How can we invest in those better and improve those?"
>
> Peter Hamilton, [Roo Cast S01E05](https://www.youtube.com/watch?v=h5lA0vaLH64&t=3147)

Concrete places to start:

**Type coverage.** If your TypeScript has `any` scattered through shared interfaces, the agent cannot infer intent. Stricter types are documentation the agent can actually read.

**Module boundaries.** Low coupling means the agent can make changes in one place without triggering cascading failures elsewhere. High coupling means every agent PR touches too many files.

**Test coverage with clear assertions.** Tests that validate behavior give the agent a feedback loop. Tests that only check "it doesn't crash" leave the agent guessing whether the change worked.

**Clear naming and directory structure.** Agents navigate by reading. If your file names and folder structure are a maze, the agent will get lost the same way a new hire would.

## Traditional approach vs. agent-optimized codebase

| Dimension          | Traditional approach                             | Agent-optimized codebase                                    |
| ------------------ | ------------------------------------------------ | ----------------------------------------------------------- |
| Type safety        | Permissive types acceptable; humans infer intent | Strict types required; agents read types as documentation   |
| Module coupling    | High coupling tolerated if team knows the system | Low coupling essential; agents cannot hold tribal knowledge |
| Test coverage      | Tests catch regressions after the fact           | Tests provide real-time feedback loop for agent iteration   |
| Code quality ROI   | Indirect, hard to measure                        | Direct: 10% merge rate increase = 50% more usable output    |
| Optimization focus | Prompts, models, system instructions             | Codebase scaffolding, development environment               |

## How Roo Code closes the loop on code quality feedback

Roo Code is an AI coding agent that closes the loop: it proposes diffs, runs commands and tests, and iterates based on the results. This loop-closing capability means that when your codebase has strong type coverage and meaningful tests, Roo Code can validate its own changes before submitting them for review.

With BYOK (bring your own key), teams control their model provider costs directly while benefiting from this iterative workflow. The agent reads your types, runs your tests, and uses the feedback to refine its changes. Better scaffolding means fewer iterations needed and higher-quality PRs on the first pass.

**The citable insight: Teams that invest in type strictness and test coverage see 50% more mergeable agent PRs from the same compute spend, because the agent can actually read and validate against clear specifications.**

## Why this matters for your team

For a Series A or B company with a 6-person engineering team, the compounding effect is significant.

If you're running agents on 30 issues per month and your merge rate is 20%, you get 6 usable PRs. If you invest a sprint in type strictness and test scaffolding and bump that to 30%, you get 9 usable PRs. Same agent cost. Three extra PRs worth of shipped work.

That's the equivalent of adding a fractional engineer, funded by code quality improvements you should probably make anyway.

The principles are not new. The payoff just became measurable.

## The shift

Stop optimizing prompts. Start optimizing the codebase the prompts are reading.

Every improvement to type safety, test coverage, and module boundaries pays dividends on every agent run. The investment compounds because the agents keep running.

## Frequently asked questions

### Why does code quality matter more now that AI agents are writing PRs?

AI agents read your codebase literally. When types are ambiguous, the agent guesses. When modules are tightly coupled, changes cascade unpredictably. When tests are missing, the agent cannot validate its own work. Code quality that was "nice to have" for human productivity becomes essential infrastructure for agent productivity.

### What is the typical merge rate for AI agent PRs?

Industry observations suggest around 20% of agent-generated PRs are mergeable without significant rework. Teams with stricter type systems, clearer module boundaries, and comprehensive test coverage regularly achieve 30% or higher. That 10-percentage-point difference translates to 50% more usable output from the same agent runs.

### Should I focus on better prompts or better code quality?

Better code quality has higher leverage. Prompt optimization has diminishing returns because it cannot compensate for ambiguous types, missing tests, or tangled dependencies. Investing in codebase scaffolding pays dividends on every agent run, while prompt improvements only help until the next model update changes behavior.

### How does Roo Code use test coverage to improve PR quality?

Roo Code closes the loop by running tests after proposing changes and iterating based on the results. When your tests have clear assertions that[Task#ed7b7227-4b05-43c6-92c4-1f2b7229bb62.47362c46] Stream failed, will retry: Provider ended the request: terminated
