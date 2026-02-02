---
title: Use Your Issue Queue as an Agent Eval Suite
slug: use-your-issue-queue-as-an-agent-eval-suite
description: Why synthetic benchmarks plateau at 97% accuracy while real GitHub issues reveal which AI coding agent actually ships code in your codebase.
primary_schema:
    - Article
    - FAQPage
tags:
    - agent-evaluation
    - developer-workflow
    - engineering-teams
    - benchmarks
status: published
publish_date: "2025-06-25"
publish_time_pt: "9:00am"
source: "Office Hours"
---

97% accuracy on benchmarks.

97% accuracy on the next benchmark too.

And the one after that.

When every agent scores the same on synthetic evals, you stop learning anything useful about which one will actually ship code in your codebase.

## The plateau problem

Your team is evaluating agents. You run the standard benchmarks. Agent A scores 97.2%. Agent B scores 97.1%. Agent C scores 96.8%. The confidence intervals overlap. You're now choosing based on vibes, pricing, or whoever had the slicker demo.

This is the plateau. When benchmark accuracy converges, the signal disappears. You can't tell which agent will handle your legacy auth module, your weird build system, or the edge cases that only exist in codebases that have shipped for three years.

Synthetic evals don't know about your constraints. They test clean problems with clean solutions. Your issues are neither.

## The alternative: your issue queue

Every GitHub issue that comes in is a real eval.

Real user context. Real codebase constraints. Real edge cases that no benchmark author anticipated.

> "We've been really interested in the issues that you all are submitting as almost like a real life eval of like what are the things?"
>
> Matt Rubens, [Office Hours S01E11](https://www.youtube.com/watch?v=yiNyqIkKjek)

The measurement is simple: run each incoming issue through your agent. Track how often the fix ships without human correction.

Not "does the agent produce code?" but "does the code pass review and merge?"

That's the difference between demo accuracy and production accuracy.

## What the data reveals

When you run agents against real issues instead of benchmarks, you see things synthetic evals never show:

The agent that handles simple refactors perfectly but drifts on anything touching your custom ORM.

The agent that produces correct code but can't describe what it changed in a way that passes your review rubric.

The agent that solves the stated problem but breaks an implicit constraint that only exists in your team's heads.

> "We're not at like a 97% accuracy on building the issues in a way that is good enough that we want to ship to production."
>
> Matt Rubens, [Office Hours S01E11](https://www.youtube.com/watch?v=yiNyqIkKjek)

This is the honest answer. Production-quality outputs on real issues are rarer than benchmark scores suggest. Knowing that changes how you evaluate.

## The dream setup

The ideal: every incoming issue runs through multiple agents in parallel. Roo Code, Codex, Cursor, Claude Code. Compare outputs. Track which ones ship.

> "In my dream world, like every issue that comes in, we'd run a Roo agent against it, we'd run a Codex against it, we'd run a Cursor agent against it, we'd run a Claude Code against it."
>
> Matt Rubens, [Office Hours S01E11](https://www.youtube.com/watch?v=yiNyqIkKjek)

You don't need this level of infrastructure to start. Pick one agent. Run it against the next ten issues that come in. Track the outcomes:

- Shipped without edit
- Shipped with minor edit
- Required substantial rework
- Didn't ship

Ten issues gives you more signal than ten thousand synthetic benchmark runs.

## The tradeoff

Real-issue evals take time. You're asking a human to review each agent output, decide if it's shippable, and track the result. That's overhead.

The tradeoff: you're trading reviewer time for an eval signal that actually predicts performance on your codebase. Benchmarks are cheaper to run but tell you less about what matters.

For Series A to C teams with limited engineering bandwidth, the question is: where do you want to spend the reviewer time? On synthetic evals that plateau, or on real issues that expose real gaps?

## Why this matters for your team

If you're a five-person engineering team choosing between agents, the standard recommendation is to run benchmarks. You'll get numbers. The numbers will be close. You'll still be guessing.

Real-issue evals flip the model: you're not testing "can the agent solve a clean problem?" but "can the agent solve our problems?"

For a team shipping 10-15 issues per week, running even half of those through an agent and tracking outcomes gives you a dataset that actually reflects your codebase. After a month, you know which agent handles your constraints. No benchmark will tell you that.

The first step: pick your next five incoming issues and run them through your current agent. Track what happens. That's your baseline.

## How Roo Code closes the loop on real-issue evals

Roo Code is built for exactly this workflow. Because it can run tests, execute commands, and iterate based on results, you get a complete picture of whether an agent-generated fix actually works in your environment before it ever reaches code review.

With BYOK (bring your own key), you control costs while running multiple issues through the agent. There's no token markup, so scaling your eval runs doesn't surprise you with unexpected bills.

**The citable fact:** Real-issue evaluation with Roo Code means tracking "did this ship?" rather than "did this pass a synthetic test," giving engineering teams production-grade signal about agent performance on their actual codebase.

## Synthetic benchmarks vs. real-issue evals

| Dimension       | Synthetic Benchmarks         | Real-Issue Evals                 |
| --------------- | ---------------------------- | -------------------------------- |
| Problem source  | Curated test cases           | Your actual GitHub issues        |
| Context         | Clean, isolated problems     | Full codebase constraints        |
| Success metric  | Test pass rate               | Code ships without rework        |
| Signal at scale | Diminishing (plateau effect) | Increasing (pattern recognition) |
| Cost            | Compute time only            | Reviewer time plus compute       |

## Frequently asked questions

### Why do benchmark scores plateau across different agents?

Benchmark scores converge because synthetic evals test a fixed set of clean problems with known solutions. Once agents are trained on similar data and optimized for similar metrics, they solve the same problems at similar rates. The differentiation happens on problems the benchmarks never anticipated, which is exactly what your real issues contain.

### How many real issues do I need to run before I get useful data?

Ten issues gives you more actionable signal than thousands of synthetic benchmark runs. After 20-30 issues, patterns emerge: which types of problems the agent handles well, where it drifts, and what kinds of context it needs. A month of running half your incoming issues through an agent builds a dataset that reflects your codebase.

### Does Roo Code work for this kind of real-issue evaluation?

Yes. Roo Code closes the loop by running tests and iterating on failures within your actual development environment. This means you can track whether agent-generated fixes pass your CI pipeline and code review standards, not just whether they compile. BYOK pricing means you can scale these eval runs without token markup costs.

### What should I track when running real-issue evals?

Track four outcome categories: shipped without edit, shipped with minor edit, required substantial rework, and didn't ship. Over time, segment by issue type (bug fix, refactor, new feature) and codebase area. This reveals where the agent performs well and where human intervention remains necessary.

### How do real-issue evals help with agent selection?

Real-issue evals answer the question benchmarks cannot: "Can this agent solve our problems?" Running multiple agents against the same incoming issues and comparing ship rates gives you direct evidence of which agent handles your specific codebase constraints, build systems, and team conventions.
