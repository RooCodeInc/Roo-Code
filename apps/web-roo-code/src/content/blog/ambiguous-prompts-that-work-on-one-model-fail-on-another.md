---
title: Ambiguous Prompts That Work on One Model Fail on Another
slug: ambiguous-prompts-that-work-on-one-model-fail-on-another
description: Why prompts that achieve 90% success on one LLM can crater to 50% on another - and how explicit prompt writing unlocks model-agnostic reliability
primary_schema:
    - Article
    - FAQPage
tags:
    - prompt-engineering
    - model-switching
    - ai-workflows
    - reliability
status: published
publish_date: "2025-09-25"
publish_time_pt: "9:00am"
---

90% success. Then 50%.

Same prompts. Different model.

The prompts were the problem the whole time.

## The switch that broke everything

You've been shipping with Opus for months. The workflow feels smooth. You write prompts that are "good enough," and the model fills in the gaps. It reads between the lines. It gets what you mean.

Then you switch to GPT5. Same prompts. Same repo. Same task.

Suddenly half your tasks go sideways. The model isn't broken. It just isn't guessing the same way Opus did.

The Roo Code team hit this exact wall. They switched to GPT5 and watched their success rate crater.

> "We switched to GPT5 and we're like, 'Well, this isn't that good. It's like 50/50 or like 40/60 or 60/40.' Not nearly as good. And then when we dig into it deeper, we discover that the issue was that we had ambiguous wording. We were asking the model to read between the lines without realizing it."
>
> Hannes Rudolph, [Roo Cast S01E10](https://www.youtube.com/watch?v=BWxsa_JxGZI)

The problem was not that GPT5 was less capable. The problem was that prompts contained implicit instructions that Opus inferred but GPT5 did not.

## The fix: remove the ambiguity

The team rewrote their prompts. They removed extra language. They stated intent explicitly instead of hoping the model would figure it out.

The result: GPT5 hit 99% success. Not 90%. Not 95%. Ninety-nine percent. Higher than Opus ever achieved with the original prompts.

> "When you cleared that language up, often removing some of the extra language, suddenly that model would do like 99% of the time. It would go the direction. Better than Opus ever did. So now it's not guessing."
>
> Hannes Rudolph, [Roo Cast S01E10](https://www.youtube.com/watch?v=BWxsa_JxGZI)

The insight here is uncomfortable: Opus's "reading between the lines" was masking prompt quality problems. The model was papering over ambiguity with good guesses. Good enough to feel like it was working. Not good enough to survive a model switch.

## The tradeoff

Explicit prompts require more upfront work. You lose vibe-coding convenience. You can't just throw a loose description at the model and trust it to figure out the rest.

But you gain something more valuable: reliability that survives model switches.

If your prompts only work on one model, you're not building a workflow. You're building around a quirk of that specific model's training. When models update, when you switch providers, when you need to use a different context window, your workflow breaks.

> "That intentionality unlocks a superpower. That 90% isn't good enough. We want a workflow that works the vast majority of the time."
>
> Hannes Rudolph, [Roo Cast S01E10](https://www.youtube.com/watch?v=BWxsa_JxGZI)

The 90% success rate feels fine until you're the one debugging the 10%. On a team shipping 10 PRs a week, 10% failure means one task per week goes sideways. Someone has to untangle what the model did wrong, rewrite the prompt, and try again. That adds up.

## Why this matters for your team

For a five-person engineering team, prompt ambiguity shows up as inconsistent results across developers. One person gets it working; another uses the same approach and hits a wall. The difference is often subtle phrasing that one model interprets generously and another does not.

The compounding cost is worse than the individual failures. If your prompts are model-specific, you can't share them across the team reliably. You can't document them. You can't build on them. Every model update becomes a debugging exercise.

Explicit prompts are documentation. They transfer knowledge. They survive model changes. They let you build workflows that scale beyond "it worked for me once."

## How Roo Code handles model-agnostic prompting

Roo Code's BYOK (bring your own key) architecture means teams frequently switch between models based on cost, capability, or context window requirements. This flexibility only works when prompts are explicit enough to produce consistent results across providers.

The close-the-loop workflow in Roo Code - where the agent proposes changes, runs tests, and iterates based on results - depends on predictable model behavior. When a prompt is ambiguous, the iteration cycle breaks down: the agent might interpret "fix this test" differently on each attempt, leading to wasted tokens and inconsistent outcomes.

**Model-agnostic prompts are the foundation of reliable agentic workflows.** Teams that invest in explicit prompt writing can switch models without retraining their entire approach, letting them optimize for speed on simple tasks and capability on complex ones.

## Ambiguous prompts vs. explicit prompts

| Dimension             | Ambiguous prompts                       | Explicit prompts                             |
| --------------------- | --------------------------------------- | -------------------------------------------- |
| Initial effort        | Low - relies on model inference         | Higher - requires stating intent clearly     |
| Model portability     | Breaks on model switch                  | Works across providers                       |
| Team shareability     | Inconsistent results between developers | Reproducible outcomes                        |
| Debugging difficulty  | Hard to identify why failures occur     | Clear expectations make failures diagnosable |
| Long-term maintenance | Every model update risks breakage       | Survives updates and provider changes        |

## The audit

If your current prompts work 90% of the time, ask: is that because the prompts are clear, or because the model is generous?

Try switching models on your most-used prompts. If success drops significantly, the prompts have implicit instructions baked in.

The fix is tedious but straightforward: state intent explicitly, remove hedging language, and test on multiple models before calling a prompt "done."

Reliability that survives model switches is worth the upfront investment.

## Frequently asked questions

### Why do prompts that work on one model fail on another?

Different models have different training data and inference patterns. A prompt that relies on the model "reading between the lines" depends on that specific model's tendency to fill gaps in a particular way. When you switch models, those gap-filling patterns change, and implicit instructions no longer produce the expected results.

### How do I know if my prompts are too ambiguous?

Test them on a different model than the one you developed them on. If success rates drop significantly, the prompts contain implicit instructions that only your original model inferred correctly. A 90% success rate that drops to 50% on a model switch indicates ambiguity problems.

### Does Roo Code work with multiple AI models?

Yes. Roo Code uses a BYOK (bring your own key) model where you connect your own API keys from providers like Anthropic, OpenAI, or others. This means you can switch models based on task requirements, but it also means your prompts and mode configurations need to be explicit enough to work reliably across different providers.

### What's the tradeoff between vibe-coding and explicit prompts?

Vibe-coding - writing loose prompts and trusting the model to figure out intent - is faster upfront but creates technical debt. Explicit prompts require more initial effort but produce reproducible results that survive model updates, transfer across team members, and scale beyond individual use cases.

### How much improvement can explicit prompting deliver?

The Roo Code team saw success rates jump from 50-60% to 99% after rewriting ambiguous prompts to be explicit. The improvement came not from changing models but from removing language that forced the model to guess at intent.
