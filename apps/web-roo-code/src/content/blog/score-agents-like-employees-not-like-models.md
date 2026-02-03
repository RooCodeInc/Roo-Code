---
title: Score Agents Like Employees, Not Like Models
slug: score-agents-like-employees-not-like-models
description: "Code correctness benchmarks miss critical agent failure modes. Score agents like employees: proactivity, context management, communication, and testing."
primary_schema:
    - Article
    - FAQPage
tags:
    - ai-agents
    - developer-productivity
    - evaluation
    - coding-agents
status: published
featured: true
publish_date: "2025-11-05"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

You're grading your AI agent on the wrong rubric.

Code correctness tells you if the output compiles. It tells you nothing about whether the agent will drift, ignore context, or go silent when it hits a wall.

## The benchmark trap

Your agent passes the coding benchmark. It writes syntactically correct code. It handles toy problems in an eval suite.

Then you put it on a real task: refactor this authentication module, follow our patterns, don't break the existing tests.

It writes code that compiles. It also ignores half the context you gave it, doesn't tell you when it's stuck, and "helpfully" changes things you didn't ask for.

The benchmark said it was capable. Production said otherwise.

## The rubric shift

Some of the teams building these agents grade them differently. They treat the agent like an employee, not like a model.

> "If you design your coding evals like you would a software engineer performance review, then you can measure their ability in the same ways as you can measure somebody who's coding."
>
> Brian Fioca, [Roo Cast S01E16](https://www.youtube.com/watch?v=Nu5TeVQbOOE&t=1225)

The rubric he described:

1. **Proactivity:** Does it go ahead and do all of it, or does it stop and wait when it could keep moving?
2. **Context management:** Can it keep all of the context it needs in memory without getting lost?
3. **Communication:** Does it tell you its plan before executing? Does it surface when it's stuck?
4. **Testing:** Does it validate its own work, or does it hand you untested code?

These aren't code quality metrics. They're work style metrics. The difference matters.

## Why correctness evals miss the failure modes

A code correctness eval asks: "Did the output match the expected output?"

A work style eval asks: "How did it get there, and what happens when the task gets harder?"

An agent that scores high on correctness but low on communication will confidently produce wrong code without flagging uncertainty. An agent that scores low on context management will lose track of requirements halfway through a multi-file change. An agent that scores low on proactivity will stop and wait for you to hold its hand on every sub-task.

These failure modes don't show up in benchmarks. They show up in real work.

## Benchmark approach vs. work style approach

| Dimension                   | Benchmark Approach                 | Work Style Approach                           |
| --------------------------- | ---------------------------------- | --------------------------------------------- |
| What it measures            | Code correctness on isolated tasks | Behavior patterns across complex workflows    |
| Failure modes caught        | Syntax errors, wrong outputs       | Drift, context loss, silent failures          |
| Task realism                | Toy problems, synthetic evals      | Multi-file changes, production patterns       |
| Feedback loop               | Pass/fail on expected output       | Grades on proactivity, communication, testing |
| Production readiness signal | "It can write code"                | "It can work reliably on your team"           |

## How to build the rubric

The approach: human-grade first, then tune an LLM-as-a-judge until it matches your scoring.

1. Run realistic tasks (not toy problems)
2. Have humans grade on proactivity, context management, communication, and testing
3. Build an LLM-as-a-judge to replicate the grades
4. Iterate until it correlates; use it for scale, spot-check with humans

The tradeoff: this takes more upfront work than a correctness benchmark. The payoff is catching failure modes before they hit production.

## How Roo Code makes agents reviewable

Closing the loop is necessary, but it's not the whole job. What matters in production is whether an agent can iterate in a real environment **before the PR** and hand you something you can actually review: a diff, evidence, and a clear trail of what happened.

That's the direction Roo Code is built for, and it maps directly to the rubric:

- **Proactivity:** It can keep moving through sub-tasks and iterate until it has something reviewable
- **Context management:** It can maintain context across multi-file changes without losing requirements halfway through
- **Communication:** It can surface a plan and blockers as it goes, with artifacts you can inspect
- **Testing:** It can run commands/tests and iterate on failures instead of handing you unverified code

## Why this matters for your team

For a Series A–C team with five to twenty engineers, agent reliability is a force multiplier. If your agent drifts or goes silent on complex tasks, someone has to babysit it. That someone is an engineer who could be shipping.

Work style evals surface these problems before you've built workflows around an agent that can't handle the job. You find out in the eval, not in the incident postmortem.

The rubric: proactivity, context management, communication, testing. Grade your agent like you'd grade a junior engineer on a trial period.

If it can't tell you its plan, it's not ready for production.

## Frequently asked questions

### Why do code correctness benchmarks fail to predict production reliability?

Code correctness benchmarks measure whether the output matches an expected result on isolated tasks. They don't capture how an agent behaves when context is complex, when it gets stuck, or when requirements span multiple files. An agent can score perfectly on benchmarks while drifting silently on real work.

### What are the four work style metrics for evaluating coding agents?

The four metrics are proactivity (does it keep moving or stop unnecessarily), context management (can it track requirements across a complex task), communication (does it share its plan and surface blockers), and testing (does it validate its own work). These predict production reliability better than correctness scores.

### Can I use LLM-as-a-judge for automated work style evaluation?

Yes. The recommended approach is to have humans grade agent work on the four dimensions first, then train an LLM-as-a-judge to replicate those grades. Once the automated judge correlates with human judgment, use it for scale while spot-checking with humans periodically.
