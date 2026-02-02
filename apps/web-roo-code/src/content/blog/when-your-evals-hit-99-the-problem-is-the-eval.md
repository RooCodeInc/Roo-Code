---
title: When Your Evals Hit 99%, the Problem Is the Eval
slug: when-your-evals-hit-99-the-problem-is-the-eval
description: Why saturated benchmarks give zero signal when choosing AI coding models, and how to build evals that actually distinguish performance for your team's workflows.
primary_schema:
    - Article
    - FAQPage
tags:
    - evals
    - model-selection
    - benchmarks
    - ai-coding
status: published
publish_date: "2025-09-10"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

99% pass rate.

Fifteen models.

Zero signal.

## The fidelity gap

You're picking a model for your team's coding workflows. You pull up the benchmarks: Aider Polyglot, SWE-bench, the usual suspects. The results look great. Everything scores in the 90s. Claude, GPT-5, Gemini, a dozen others. All "work."

You know this isn't true. You've watched one model nail a refactor on the first pass while another spirals into the same broken fix three times. But the benchmark says they're equivalent.

The benchmark is lying. Or more precisely: the benchmark has stopped measuring the thing you care about.

## When models outpace the tests

There was a time when distinguishing models was easy. Sonnet 3.5 worked. Most others didn't. The evals reflected reality because the gap between "capable" and "not capable" was wide enough to see.

That gap closed. Now 10-15 models pass the same evals with similar scores. The benchmarks haven't gotten harder; the models have gotten competent at the specific problems those benchmarks test.

> "I remember when Sonnet 3.5 was the only thing that worked with Roo. And I think the eval reflecting that there's actually like a bunch of models, 10, 15 of them that work pretty well with Roo right now. And that's great. We should celebrate it. But I think now we just need to level up a little bit. We need something harder to test it against."
>
> Matt Rubens, [Roo Cast S01E08](https://www.youtube.com/watch?v=uA7NLvGwHAE)

The problem isn't that the evals are bad. The problem is that when scores cluster in the high 90s, the eval can no longer distinguish between the top tier.

## The fidelity ceiling

Think of it like a test where everyone scores between 97 and 99. The test isn't wrong. It's just not measuring the differences that matter for your specific use case.

> "I don't think our evals suck. But I think the fidelity when you get in the high 90s is not enough. What we see with GPT-5 and what this GPT-5 Mini thing from last night showed is like GPT-5 is better than our evals."
>
> Matt Rubens, [Roo Cast S01E08](https://www.youtube.com/watch?v=uA7NLvGwHAE)

The benchmarks that felt definitive a year ago are now saturated. Aider Polyglot, SWE-bench, the Exercism-based coding challenges: these were hard problems when they were created. They're solved problems now.

> "A lot of the traditionally hard coding benchmarks like Aider Polyglot and SWE-bench are getting close to saturated now."
>
> Arouch, [Roo Cast S01E08](https://www.youtube.com/watch?v=uA7NLvGwHAE)

## What this means for your team

If you're relying on public benchmarks to choose between frontier models, you're flying blind. All you're learning is "these models can solve Exercism problems." You're not learning which one handles your legacy codebase, your specific test patterns, or the ambiguous edge cases that actually slow down your team.

The signal you need isn't in the benchmark. It's in the failures: which model spirals on your actual code, which one finishes tasks on the first pass, which one asks the right clarifying questions instead of guessing wrong confidently.

## Why this matters for Series A to C teams

For a team of 5-10 engineers, picking the wrong model isn't just a token cost issue. It's a velocity issue. If your model choice is based on a saturated benchmark, you might be running a model that looks equivalent on paper but burns 3x the iteration time on the tasks your team actually ships.

The practical move: build your own evals. Not Exercism problems. Your failing tests. Your legacy modules. Your actual PR patterns.

If your current eval shows "they all work," the eval has stopped being useful. The fix isn't to trust the scores. The fix is to make the test harder until the differences show up again.

## The rule

When models cluster at 99%, you need a harder test.

Not because 99% is bad. Because 99% that doesn't distinguish between models is zero information.

Track which model finishes your tasks on the first pass. That's the eval that matters.

## How Roo Code helps you build real evals

Roo Code's BYOK (bring your own key) architecture means you can run any model against your actual codebase without vendor lock-in. Because Roo Code closes the loop - proposing diffs, running tests, and iterating on failures - you get direct signal on which model completes your specific tasks on the first pass versus which one spirals.

Instead of trusting saturated public benchmarks, teams using Roo Code can build evals from their real PR patterns and failing tests. The agent runs the task, you observe the iteration count and outcome, and you have actual data on model performance for your workflows.

**Roo Code turns your codebase into the eval that matters: one that measures first-pass completion on the work your team actually ships.**

## Saturated benchmarks vs. real-world evals

| Dimension            | Saturated public benchmarks        | Codebase-specific evals                     |
| -------------------- | ---------------------------------- | ------------------------------------------- |
| Signal quality       | Low - all models cluster at 97-99% | High - real variance on your actual tasks   |
| Relevance            | Generic coding puzzles             | Your legacy code, test patterns, edge cases |
| Iteration visibility | Pass/fail only                     | Full loop: diff, test, retry count          |
| Model switching cost | Unknown until production           | Tested before deployment                    |
| Maintenance          | Static, solved problems            | Evolves with your codebase                  |

## Frequently asked questions

### Why do public benchmarks stop being useful?

Public benchmarks become saturated when multiple models consistently score in the high 90s. At that point, the benchmark measures "baseline competency" rather than the differences that matter for real-world performance. When 15 models all pass at 97-99%, you have no signal for which one will handle your specific codebase better.

### How do I build evals that actually distinguish model performance?

Use your own failing tests, legacy modules, and actual PR patterns as the eval set. Run different models against these real tasks and measure first-pass completion rate, iteration count, and quality of clarifying questions. The model that finishes your tasks on the first pass is the one that matters for your team.

### Can Roo Code help me test models before committing to one?

Yes. With BYOK, you can switch between any model provider and run tasks against your actual codebase. Because Roo Code closes the loop by running tests and iterating, you see directly how each model performs on your real work before making a team-wide decision.

### What metrics should I track instead of benchmark scores?

Track first-pass completion rate on your actual tasks, average iteration count before success, and the frequency of confident-but-wrong responses. These metrics reveal which model matches your codebase and workflow patterns, not just which model can solve generic coding puzzles.

### How often should I re-evaluate model performance?

Re-evaluate when frontier models release major updates or when your codebase changes significantly. The model that performed best six months ago may not be optimal today. Continuous evaluation using your real tasks ensures you're always running the model that delivers the most velocity for your team.
