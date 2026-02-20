---
title: Manage AI Spend by Measuring Return, Not Cost
slug: manage-ai-spend-by-measuring-return-not-cost
description: Learn why centralizing AI tool spend and measuring output instead of cost unlocks productivity gains - insights from Smartsheet's engineering leadership approach.
primary_schema:
    - Article
    - FAQPage
tags:
    - ai-spend
    - engineering-leadership
    - productivity
    - developer-tools
status: published
featured: true
publish_date: "2025-11-14"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

"I own it just so that I can tell them I want you to focus on your return, not your cost."

That's JB Brown from Smartsheet, explaining why he consolidated all AI tool spend into a single account under his control.

## The budget trap

When AI token costs sit in team budgets, engineers optimize for the wrong metric. They watch the spend. They pick smaller models. They skip the task that might cost fifteen dollars even when it would save three hours.

The incentive structure is backwards. You're measuring input (tokens consumed) instead of output (work completed). Every team manages their own line item, and every team gets cautious.

This is the predictable outcome of distributed AI budgets: usage goes down, taking the productivity gain with it.

## Why not track per-person?

The technical capability to track individual spend exists. You authenticate to use tokens. The data is there. Smartsheet deliberately stays away from it.

> "I could actually get down to it because you have to authenticate to use tokens and so then there's a tracking to amount of tokens per person but I don't. I'm kind of staying away from that. I think it will lead to bad mindset and bad behavior."
>
> JB Brown, [Roo Cast S01E17](https://www.youtube.com/watch?v=R4U89z9eGPg&t=824)

The tracking is possible. The question is whether you should. Per-person dashboards create the exact cost anxiety that undermines the productivity gain you're paying for.

## The Smartsheet approach

Smartsheet took the opposite path. They moved all AI tool spend into a single account owned by engineering leadership. Not to track costs more closely, but to remove cost from the team-level conversation entirely.

> "Here we're trying to drive return, not trying to reduce cost. And so to get that mindset shift and behavior and practice shift, I'm sort of precluding people from thinking about the cost too much."
>
> JB Brown, [Roo Cast S01E17](https://www.youtube.com/watch?v=R4U89z9eGPg&t=748)

The goal is explicit: shift the mental model from "how do I spend less?" to "how do I ship more?"

## The metric that matters

If you're not measuring cost, what are you measuring?

Their answer: MR throughput. Merge requests completed. Commits merged. Work shipped.

> "We would measure it by MR throughput. And that's what we're trying to drive towards as that outcome."
>
> JB Brown, [Roo Cast S01E17](https://www.youtube.com/watch?v=R4U89z9eGPg&t=668)

This is the difference between treating AI as an expense line and treating it as a productivity lever. Expenses get minimized. Levers get pulled. A frontier model costs a fraction of an intern's hourly rate but can iterate on code continuously. The return-on-cost math favors spending more, not less.

## The tradeoff

Centralizing spend requires leadership to take ownership of a growing line item. That's a real commitment. You're betting that the productivity gains justify the cost, and you're removing the natural friction that distributed budgets create.

This works when you have the instrumentation to measure output. If you can't track MR throughput (or your equivalent of work completed), you're flying blind. The model only makes sense if you have visibility into what you're getting for the spend.

The other risk: engineers might overconsume without constraints. Smartsheet's approach relies on trust and a focus on outcomes. If your teams aren't outcome-oriented, centralizing spend without guardrails could backfire.

## Why this matters for your organization

If you're evaluating AI coding tools at the org level, the budget question comes early. Finance wants to know where the costs sit. Engineering wants to experiment. Someone has to decide who owns the number.

For a fast-moving team, the difference between cautious usage and full adoption compounds. If engineers second-guess every expensive task, you're leaving the productivity gain on the table. If they're told "focus on output, I'll handle the spend," you unlock a different behavior entirely.

## How Roo Code fits this model

Roo Code's BYOK model lets you connect a single organizational API account. Engineers use full-capability models without watching their own spend.

Because the agent iterates until tests pass, token spend maps to merged code rather than manual copy-paste cycles. The iteration loop that would take an engineer 30 minutes of context-switching runs autonomously.

Track MRs against token consumption. That's the cost-per-outcome math.

## Cost anxiety vs. outcome focus: a comparison

| Dimension             | Distributed budgets (cost focus)            | Centralized spend (return focus)        |
| --------------------- | ------------------------------------------- | --------------------------------------- |
| Engineer behavior     | Avoids expensive tasks even when high-value | Uses the right model for the job        |
| Optimization target   | Minimize token consumption                  | Maximize merge request throughput       |
| Model selection       | Defaults to cheaper, smaller models         | Selects based on task complexity        |
| Leadership visibility | Fragmented across team ledgers              | Single account with outcome correlation |
| Risk profile          | Under-utilization of AI capability          | Requires output instrumentation         |

## The decision

Audit where your AI spend currently sits. If it's distributed across team budgets, ask: are engineers optimizing for cost or for output?

If the answer is cost, consider consolidating. Own the spend at a level where someone can credibly say: "I want you to focus on your return, not your cost."

Then measure MR throughput.

## Frequently asked questions

### How do I convince finance to centralize AI tool spend?

Frame the conversation around measurable output, not cost containment. Present a pilot where you track merge request throughput before and after removing per-team budget constraints. Finance responds to productivity metrics with ROI attached. Show them the cost-per-merged-PR math, not just the monthly token bill.

### What output metrics work best for measuring AI tool ROI?

Merge request throughput is the most direct proxy because it measures completed work. Other valid metrics include commits merged, story points delivered, or time-to-first-commit on new tasks. The key is choosing a metric that captures finished work rather than activity. Avoid measuring tokens consumed or hours using the tool - these are inputs, not outputs.

### Does Roo Code support centralized API key management for teams?

Yes. Roo Code's BYOK model lets you connect a single organizational API account that all team members use. This consolidates token spend into one billing relationship while giving engineers full access to capable models. The transparent pricing - no token markup - makes it easier to correlate spend with output when you measure at the organizational level.

### What's the risk of removing cost constraints from engineers?

Without output instrumentation, you lose visibility into what you're getting for the spend. The mitigation is measurement: if you track merge request throughput alongside token consumption, you can identify both inefficient usage patterns and high-value workflows. The risk of over-consumption is lower than the risk of under-utilization when engineers self-censor to avoid costs.

### How do I start measuring MR throughput against AI spend?

Begin by consolidating AI tool spend into a single account with clear billing visibility. Then establish a baseline: track merge requests per engineer per week before and after centralizing spend. Correlate changes in throughput with changes in token consumption. Most teams see throughput increase faster than cost, which is the return you're measuring.
