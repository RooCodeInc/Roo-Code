---
title: Provider Choice Matters as Much as Model Choice on OpenRouter
slug: provider-choice-matters-as-much-as-model-choice-on-openrouter
description: Why the same LLM model produces different results depending on OpenRouter provider, and how to debug model evals by testing provider and temperature combinations.
primary_schema:
    - Article
    - FAQPage
tags:
    - openrouter
    - model-evaluation
    - llm-configuration
    - byok
status: draft
publish_date: "2025-10-03"
publish_time_pt: "9:00am"
source: "After Hours"
---

Same model. Different provider. Completely different results.

You ran the evals. The model scored poorly. You moved on.

But the model was never the problem. The provider was.

## The hidden variable

You're evaluating models on OpenRouter. You pick one that looks promising, run it through your test suite, and get mediocre results. You check the box: tried it, didn't work, next.

A week later, someone on your team mentions they're getting great results with the same model. You compare notes. Different provider. Different temperature setting.

The model you dismissed was capable. The configuration you tested was not.

OpenRouter aggregates multiple providers serving the same model. The assumption is that "Llama 3.1 70B" means the same thing regardless of who serves it. The reality: inference quality varies by provider. Quantization differences, context handling, and serving infrastructure all affect output.

## The debugging checklist

Before abandoning a model, ask two questions:

1. Which provider did you use?
2. What temperature did you set?

Both parameters materially affect output quality. A model served by a random provider at default temperature may produce unusable output. The same model from a specific provider at a tuned temperature may score in the 90s on your evals.

> "A lot of people will be like, 'Oh, I tried that model and it sucked.' I'm like, 'Well, what provider did you try? What temperature did you try?' And it's such a complicated space."
>
> GosuCoder, [After Hours S01E01](https://www.youtube.com/watch?v=bmZ2Cl8ohlU&t=1487)

The complexity is the point. Model selection is not a single variable. It's a configuration space with at least three dimensions: model, provider, and temperature. Evaluating one combination tells you nothing about the other combinations.

## The GLM 4.6 case

The Roo Code team ran evals on GLM 4.6 and got disappointing results. Standard reaction: mark the model as underperforming and move on.

Instead, they adjusted provider and temperature. The results shifted dramatically.

> "We ran the evals on it and they didn't do as well as we hoped. But then when I actually bumped the temperature and the provider, it really really changed how things worked. I think it got somewhere in the 90s."
>
> Dan, [After Hours S01E01](https://www.youtube.com/watch?v=bmZ2Cl8ohlU&t=54)

From "didn't do as well as we hoped" to "somewhere in the 90s." Same model. Different configuration.

## The tradeoff

This adds complexity to model evaluation. You can't just run one test and call it done. Each model potentially requires a configuration sweep: which providers are available, what temperature ranges work for your use case.

The upside: you may find capable models that others have dismissed. The models everyone else gave up on after one bad run become your edge.

The cost: your eval pipeline needs to account for provider and temperature as variables, not just model name. If you're logging model performance, log the full configuration. Otherwise you're comparing apples to oranges and drawing conclusions from noise.

## Why this matters for your workflow

If you're evaluating models for a production workflow, one bad eval run with a random provider tells you almost nothing. You've tested a single point in a multi-dimensional space.

The debugging habit: when a model underperforms, check provider and temperature before writing it off. If you're using OpenRouter, the provider dropdown is not a cosmetic choice. It's a material parameter.

For teams running systematic evals, this means expanding the test matrix. Model × provider × temperature. More runs, but fewer false negatives. You stop dismissing capable models based on misconfigured tests.

> "You do have to be careful with providers on OpenRouter. So if you try it and you select just whatever random provider and it's not good, don't give up because some of them are unfortunately worse quality than others."
>
> GosuCoder, [After Hours S01E01](https://www.youtube.com/watch?v=bmZ2Cl8ohlU&t=1474)

## The first step

Log the full configuration for every eval run: model name, provider, temperature, and any other inference parameters that might vary.

When a model disappoints, check the configuration before the conclusion. The model you're about to dismiss might be the one that scores in the 90s with a different provider.

## How Roo Code handles model configuration with BYOK

Roo Code's BYOK (Bring Your Own Key) approach gives you direct control over provider selection and model configuration. When you connect your OpenRouter API key, you choose which provider serves each model and set temperature values that match your coding tasks.

This matters because Roo Code closes the loop: it proposes diffs, runs commands and tests, and iterates based on results. Each iteration sends prompts to your configured model. **If your model configuration is suboptimal, every loop iteration compounds the quality loss.** Getting provider and temperature right at the start means better diffs, fewer failed test runs, and faster task completion.

With BYOK, you pay the provider directly at their rates with no token markup. You also control the full configuration space, so you can tune provider and temperature for coding-specific tasks rather than accepting defaults optimized for general chat.

## Model evaluation approaches compared

| Dimension             | Single-point testing              | Configuration sweep testing                 |
| --------------------- | --------------------------------- | ------------------------------------------- |
| Test scope            | One provider, default temperature | Multiple providers × temperature ranges     |
| False negative rate   | High - dismisses capable models   | Low - surfaces hidden performance           |
| Time investment       | Minutes per model                 | Hours per model                             |
| Configuration logging | Model name only                   | Model + provider + temperature + parameters |
| Result reliability    | Noisy, non-reproducible           | Reproducible, comparable                    |

## Frequently asked questions

### Why do different OpenRouter providers give different results for the same model?

Providers differ in how they serve models. Quantization levels affect precision, context window handling varies by infrastructure, and serving optimizations introduce subtle differences. A model quantized to 4-bit for cost savings produces different output than the same model at full precision. These differences compound across multi-turn conversations and complex reasoning tasks.

### What temperature should I use for coding tasks?

Lower temperatures (0.0 to 0.3) generally produce more deterministic, focused code output. Higher temperatures (0.7 to 1.0) increase creativity but also increase the likelihood of syntax errors and hallucinations. Start low for implementation tasks and test higher values for brainstorming or alternative solution generation.

### How does Roo Code let me control provider and temperature settings?

Roo Code uses BYOK, meaning you connect your own API key from OpenRouter or another provider. You configure the model, provider, and temperature in your settings. Roo Code then uses your exact configuration for every task, so you maintain full control over inference quality and cost.

### Should I re-evaluate models I previously dismissed?

Yes, if you tested them with a single provider and default settings. A model that scored poorly with one configuration may score in the 90s with a different provider or adjusted temperature. Log your original test configuration, then run the same evals with alternative providers before making a final decision.

### How do I track which configuration produced which results?

Log the complete configuration for every eval run: model name, provider ID, temperature, top-p, max tokens, and any other parameters you set. Store results alongside this configuration data. When comparing models, filter by identical configurations to ensure valid comparisons.
