---
title: "Async Agents Change the Speed vs Quality Calculus"
slug: "async-agents-change-the-speed-vs-quality-calculus"
description: "In many workflows, quality at scale beats speed in series. That sentence sounds wrong until you stop running one agent at a time."
primary_schema:
    - Article
    - FAQPage
tags:
    - AI Development
    - Workflow
    - Performance
status: "published"
publish_date: "2025-10-16"
publish_time_pt: "9:00am"
---

In many workflows, quality at scale beats speed in series.

That sentence sounds wrong until you stop running one agent at a time.

## The serial tax

You're staring at a failing test. You could use Gemini 2.5 Flash: it's cheaper and faster. Or you could use Gemini 2.5 Pro: slower and pricier, but more likely to get it right on the first pass.

This is the choice you've been trained to make. Fast vs smart. Cost vs accuracy. Pick one.

The problem: you're only making this choice because you're running one task at a time. You prompt, you wait, you review, you re-prompt. The model's speed matters because you're blocking on it.

But what if you weren't?

## The async flip

Async agents change the math. You don't wait for one task to finish before starting the next. You spawn a batch of tasks, walk away, and check results when you're back.

> "You can set off like 10 different browser tabs worth of Jules tasks and go and get coffee and then come back and see how things are going."
>
> Paige Bailey, Roo Cast S01E14

When you're running a batch of tasks in parallel, latency differences matter less because you're not blocking on a single response. You're not sitting there watching a spinner. You're doing something else.

The calculus shifts: higher-quality results in parallel can beat lower-quality results in series. The first approach can give you more usable results when you come back from coffee. The second gives you results faster, but tends to require more frequent attention.

## The heuristic that still matters

Async doesn't mean "always use the expensive model." The task complexity heuristic still applies.

> "For tasks that I know I could kind of punt to an L3 or an L4 engineer, I'm fine with using Gemini 2.5 Flash, especially if I'm in thinking mode because thinking mode will kind of build out a plan for me and then it will kind of compose that into individual chunks or functions."
>
> Paige Bailey, Roo Cast S01E14

The split:

- **Punt-to-junior tasks:** Use the faster, cheaper model. Straightforward refactors, boilerplate generation, test scaffolding.
- **Senior-judgment tasks:** Use the quality model. Architecture decisions, performance debugging, security reviews.

But here's the key: neither should run synchronously if the work can be batched. In many workflows, throughput matters more than response time.

## The invisible model future

The long-term direction is that this choice disappears entirely.

> "The ideal state long term is that they just say like hey I have these requirements and then their requirements get met as opposed to them needing to figure out how to like oh which one should I pick."
>
> Paige Bailey, Roo Cast S01E14

Model selection becomes infrastructure. You specify the outcome, and the system handles routing, parallelism, and retry logic. The "which model" question becomes as invisible as "which server in the cluster handles this request."

We're not there yet. But the direction is clear.

## Why this matters for your workflow

If you're still running one agent at a time, waiting for results, then re-prompting, you're paying the serial tax. Every minute you spend watching a spinner is a minute you're not spawning the next task.

The shift isn't "use a better model." It's "stop blocking on the model."

This compounds. The model quality difference is often marginal compared to the workflow throughput difference.

## The practical change

Audit your workflow. How many tasks are you running concurrently? If the answer is "one," you're solving the wrong problem with model selection.

Start a batch (e.g., 5–10). Check results. Fix the ones that failed. Repeat.

The model you pick matters less than whether you're waiting for it.
