---
title: Score Agents Like Employees, Not Like Models
slug: score-agents-like-employees-not-like-models
description: Why code correctness benchmarks miss critical agent failure modes and how to evaluate AI coding agents using work style metrics like proactivity, context management, and communication.
primary_schema:
    - Article
    - FAQPage
tags:
    - ai-agents
    - developer-productivity
    - evaluation
    - coding-agents
status: published
publish_date: "2025-11-05"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

You're grading your AI agent on the wrong rubric.

Code correctness tells you if the output compiles. It tells you nothing about whether the agent will drift, ignore context, or go silent when it hits a wall.

## The benchmark trap

Your agent passes the coding benchmark. It writes syntactically correct code. It handles the toy problem in the eval suite.

Then you put it on a real task: refactor this authentication module, follow our patterns, don't break the existing tests.

It writes code that compiles. It also ignores half the context you gave it, doesn't tell you when it's stuck, and makes changes you didn't ask for while missing the ones you did.

The benchmark said it was capable. Production said otherwise.

## The rubric shift

OpenAI's applied team grades their coding agents differently. They treat the agent like an employee, not like a model.

> "If you design your coding evals like you would a software engineer performance review, then you can measure their ability in the same ways as you can measure somebody who's coding."
>
> Brian Fioca, [Roo Cast S01E16](https://www.youtube.com/watch?v=Nu5TeVQbOOE)

The rubric they use for GPT-5 development:

1. **Proactivity:** Does it go ahead and do all of it, or does it stop and wait when it could keep moving?
2. **Context management:** Can it keep all of the context it needs in memory without getting lost?
3. **Communication:** Does it tell you its plan before executing? Does it surface when it's stuck?
4. **Testing:** Does it validate its own work, or does it hand you untested code?

These aren't code quality metrics. They're work style metrics. The difference matters.

## Why correctness evals miss the failure modes

A code correctness eval asks: "Did the output match the expected output?"

A work style eval asks: "How did it get there, and what would happen if the task were harder?"

An agent that scores high on correctness but low on communication will confidently produce wrong code without flagging uncertainty. An agent that scores low on context management will lose track of requirements halfway through a multi-file change. An agent that scores low on proactivity will stop and wait for you to hold its hand on every sub-task.

These failure modes don't show up in benchmarks. They show up at 2am when you realize the agent silently ignored half your instructions.

## Benchmark approach vs. work style approach

| Dimension                   | Benchmark Approach                 | Work Style Approach                           |
| --------------------------- | ---------------------------------- | --------------------------------------------- |
| What it measures            | Code correctness on isolated tasks | Behavior patterns across complex workflows    |
| Failure modes caught        | Syntax errors, wrong outputs       | Drift, context loss, silent failures          |
| Task realism                | Toy problems, synthetic evals      | Multi-file changes, production patterns       |
| Feedback loop               | Pass/fail on expected output       | Grades on proactivity, communication, testing |
| Production readiness signal | "It can write code"                | "It can work reliably on your team"           |

## The prompt is the job description

The framing shift is simple: your prompt is a job description.

> "You're giving it a job description. That's your prompt."
>
> Brian Fioca, [Roo Cast S01E16](https://www.youtube.com/watch?v=Nu5TeVQbOOE)

If you hired an engineer and gave them vague instructions, you'd expect vague output. The same applies here. But beyond prompt quality, you need to know how the agent performs when the instructions are clear and the task is complex.

That's what work style evals measure.

## How to build the rubric

The approach: human-grade first, then tune an LLM-as-a-judge until it matches your scoring.

1. Run a set of realistic tasks (not toy problems)
2. Have humans grade the agent's work on proactivity, context management, communication, and testing
3. Build an LLM-as-a-judge that attempts to replicate the human grades
4. Iterate until the automated judge correlates with human judgment
5. Use the automated judge for scale; spot-check with humans

The tradeoff: this takes more upfront work than a correctness benchmark. The payoff is catching failure modes before they hit production.

## How Roo Code closes the loop on agent reliability

Roo Code is an AI coding agent designed around work style principles, not just code correctness. It closes the loop by proposing diffs, running commands and tests, and iterating based on the results. This maps directly to the rubric:

- **Proactivity:** Roo Code continues working through sub-tasks without waiting for hand-holding on each step
- **Context management:** The agent maintains context across multi-file changes within your VS Code workspace
- **Communication:** You see the plan before execution through the diff-and-approve workflow
- **Testing:** Roo Code can run your test suite and iterate on failures automatically

With BYOK (bring your own key), you control which model powers the agent while Roo Code handles the work style layer that makes agents production-ready.

## Why this matters for your team

For a Series A team with five engineers, agent reliability is a force multiplier. If your agent drifts or goes silent on complex tasks, someone has to babysit it. That someone is an engineer who could be shipping.

Work style evals surface these problems before you've built workflows around an agent that can't handle the job. You find out in the eval, not in the incident postmortem.

The rubric: proactivity, context management, communication, testing. Grade your agent like you'd grade a junior engineer on a trial period.

If it can't tell you its plan, it's not ready for production.

## Frequently asked questions

### Why do code correctness benchmarks fail to predict production reliability?

Code correctness benchmarks measure whether the output matches an expected result on isolated tasks. They don't capture how an agent behaves when context is complex, when it gets stuck, or when requirements span multiple files. An agent can score perfectly on benchmarks while drifting silently on real work.

### What are the four work style metrics for evaluating coding agents?

The four metrics are proactivity (does it keep moving or stop unnecessarily), context management (can it track requirements across a complex task), communication (does it share its plan and surface blockers), and testing (does it validate its own work). These predict production reliability better than correctness scores.

### How does Roo Code handle the communication and testing dimensions?

Roo Code closes the loop by showing you proposed diffs before applying them, giving you visibility into the plan. It can run tests automatically and iterate based on failures, which means you see validation built into the workflow rather than handed off as untested code.

### Can I use LLM-as-a-judge for automated work style evaluation?

Yes. The recommended approach is to have humans grade agent work on the four dimensions first, then train an LLM-as-a-judge to replicate those grades. Once the automated judge correlates with human judgment, use it for scale while spot-checking with humans periodically.

### What failure modes should I watch for in agents that pass benchmarks?

Watch for context loss on multi-file changes, silent deviation from instructions, stopping to ask unnecessary questions instead of continuing, and handing off code without running tests. These patterns indicate low scores on work style metrics even when correctness looks fine.
