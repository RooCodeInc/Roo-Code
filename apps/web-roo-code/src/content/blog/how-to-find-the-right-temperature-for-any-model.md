---
title: How to Find the Right Temperature for Any Model
slug: how-to-find-the-right-temperature-for-any-model
description: Learn the systematic methodology for finding optimal LLM temperature settings through rigorous testing rather than guessing - including surprising findings like Gemini 2.5 Pro at 0.72 and ByteDance Seed at 1.1.
primary_schema:
    - Article
    - FAQPage
tags:
    - llm-configuration
    - model-tuning
    - ai-coding
    - developer-workflow
status: published
publish_date: "2025-09-03"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

0.72.

That's the optimal temperature for Gemini 2.5 Pro. Not 0.7. Not 0.8. Exactly 0.72.

And for ByteDance's Seed OSS? Around 1.0 or 1.1.

Default temperatures work until they don't. Then you're guessing.

## The guessing problem

You've read the documentation. It says "temperature 0.7 is recommended for coding tasks." You use 0.7. Sometimes outputs are great. Sometimes they're repetitive. Sometimes they hallucinate wildly.

You nudge it to 0.5. Things get stiff. You bump it to 0.9. Things get weird. You go back to 0.7 and tell yourself it's fine.

The problem: you're tuning by vibes. Each model has different internals, different training distributions, different sweet spots. The number that works for one model actively hurts another.

## The methodology

The systematic approach: run hundreds of tests at each temperature increment, grade each output, and narrow in on the optimal setting.

> "I then ran through a series of hundreds of tests at each temp, each temperature, then grading each one and it zoned in at it was literally like 0.72 or something was the best."
>
> Adam, [Roo Cast S01E07](https://www.youtube.com/watch?v=ECO4kNueKL0)

The test setup matters. Not toy prompts. Real specs across multiple files.

> "Imagine like a big spec where I'm asking it to build a specific thing across a bunch of different files and then being able to measure the output of that is really what I'm doing. And I do that across I have multiple of those things that are running."
>
> Adam, [Roo Cast S01E07](https://www.youtube.com/watch?v=ECO4kNueKL0)

The grading criteria: tool call failures, output completeness, whether the generated code actually satisfies the spec. Binary where possible. Did it complete the task or not?

## The counterintuitive findings

Some models want temperatures that seem wrong.

> "Some of them actually I found recommend even higher, like one, like the new ByteDance Seed OSS model has a like ideal temperature of like one or 1.1, which is insane."
>
> Adam, [Roo Cast S01E07](https://www.youtube.com/watch?v=ECO4kNueKL0)

Temperature 1.1 for a coding model sounds like you're asking for chaos. But if the model was trained with that distribution in mind, that's where it performs.

The point: your intuition about "reasonable" temperatures is probably wrong for at least some of the models you're using.

## The tradeoff

Running hundreds of tests per temperature increment takes time. You need a consistent spec, a grading rubric, and the patience to run the full sweep before drawing conclusions.

For most teams, this isn't worth doing for every model. But for your primary workhorse model - the one you route 80% of tasks to - the investment pays off. A 5% improvement in task completion rate across thousands of requests is real time saved.

The cheaper alternative: start with the model provider's recommended default, but track your failure modes. If you see a pattern (repetitive outputs, incomplete tool calls, hallucinated file paths), try a temperature sweep on that specific failure case.

## Why this matters for your workflow

If you're running an agent that generates code across multiple files, temperature affects whether the output hangs together or drifts into incoherence. At the wrong temperature, you get outputs that technically parse but miss the spec. At the right temperature, tool calls complete and files reference each other correctly.

The difference shows up in your iteration count. How many times do you re-run the same task because the output was almost right but not quite? That's the cost of guessing.

## How Roo Code closes the loop on temperature tuning

Roo Code supports BYOK (bring your own key), which means you connect directly to model providers and control your own configuration - including temperature settings. When Roo Code closes the loop by running commands, executing tests, and iterating based on results, temperature affects every step of that cycle.

With the wrong temperature, an agent might generate code that compiles but fails tests, or produces tool calls that don't complete. With the right temperature, the agent completes multi-file tasks with fewer iterations. Roo Code's approval-based workflow lets you observe these patterns across real tasks, building the data you need to tune systematically rather than guess.

| Approach              | Temperature selection                | Iteration cost                      | Failure visibility                  |
| --------------------- | ------------------------------------ | ----------------------------------- | ----------------------------------- |
| Default settings      | Use 0.7 for everything               | High - frequent re-runs             | Low - symptoms unclear              |
| Vibes-based tuning    | Adjust when things feel wrong        | Medium - reactive changes           | Medium - pattern recognition        |
| Systematic testing    | Run controlled sweeps per model      | Low upfront, high long-term savings | High - measured by rubric           |
| Agent-observed tuning | Track failures across real workflows | Medium - real usage data            | High - actual task completion rates |

## The first step

Pick one model. Pick one representative task (something that spans multiple files or requires tool calls). Run it at 0.5, 0.7, 0.9, 1.0. Grade each output on the same rubric.

If you see a clear pattern, narrow in. If you don't, the model is probably stable enough that default is fine.

The number matters less than the method. Build a test, run the sweep, measure what breaks.

## Frequently asked questions

### What temperature should I use for coding tasks?

There is no universal answer. Gemini 2.5 Pro performs best around 0.72, while ByteDance Seed OSS needs 1.0-1.1. Start with the model provider's recommended default, then run a systematic sweep if you observe consistent failure patterns like incomplete tool calls or repetitive outputs.

### Why do different models need different temperatures?

Each model has different training distributions and internal architectures. A temperature setting normalizes the probability distribution over tokens, but "normalized" means different things depending on how the model was trained. What feels like a "safe" temperature for one model might constrain or destabilize another.

### How do I test temperature settings systematically?

Create a representative task that spans multiple files or requires tool calls. Run the same task at several temperature increments (0.5, 0.7, 0.9, 1.0). Grade each output using a consistent rubric: did tool calls complete, did the code satisfy the spec, were file references correct? Look for patterns before narrowing in.

### How does Roo Code handle temperature configuration?

Roo Code uses BYOK (bring your own key) architecture, so you configure temperature directly with your model provider. This gives you full control over model parameters. As Roo Code closes the loop by running tests and iterating on failures, you can observe which temperature settings lead to higher task completion rates in your actual workflow.

### Is temperature tuning worth the investment?

For your primary model - the one handling 80% of your tasks - yes. A 5% improvement in task completion rate across thousands of requests translates to real time saved. For secondary models you use occasionally, the default is usually fine unless you notice consistent failure patterns.
