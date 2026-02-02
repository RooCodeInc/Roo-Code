---
title: GPT-5 Codex Works Best When You Strip Your Harness Down
slug: gpt5-codex-works-best-when-you-strip-your-harness-down
description: Learn why GPT-5 Codex underperforms in custom tool harnesses and how stripping down to native tooling like apply patch and ripgrep eliminates the attention tax for better coding agent results.
primary_schema:
    - Article
    - FAQPage
tags:
    - codex
    - ai-agents
    - developer-tools
    - model-integration
status: published
publish_date: "2025-11-05"
publish_time_pt: "9:00am"
---

Strip your tools. Get better results.

That's the counterintuitive lesson from teams integrating GPT-5 Codex into their own harnesses.

## The attention tax

You've built a sophisticated tool harness. Custom diff formats, specialized search commands, a carefully designed output schema. You drop Codex into it and watch it stumble.

The model is capable. Your harness is thoughtful. But the combination underperforms.

Here's why: Codex was hyper-trained on one specific setup. Apply patch. Ripgrep search. That's the loop it knows cold. When you hand it a different set of tools, it has to spend cognitive budget figuring out your format instead of solving the actual coding problem.

> "If you're sort of like giving somebody a whole bunch of stuff to do and they're like trying really hard to do a really good job and they have this like slightly different way of like having to give you the answer... then they're going to like have to think harder about that part of it and they might screw something else up along the way."
>
> Brian Fioca, [Roo Cast S01E16](https://www.youtube.com/watch?v=Nu5TeVQbOOE)

This isn't a bug. It's a tradeoff OpenAI made deliberately. Codex is optimized for the Codex product cycle: heads-down execution, minimal back-and-forth, tight integration with their specific tooling.

## The fix is subtraction

Teams that get good results with Codex in third-party harnesses share one pattern: they strip out most of their custom tooling.

> "When people implement Codex in their harness, it works better for them to just cut out almost all of their tools and just have it use our apply patch, which is open-sourced, and basically ripgrep to search around code."
>
> Brian Fioca, [Roo Cast S01E16](https://www.youtube.com/watch?v=Nu5TeVQbOOE)

OpenAI's apply patch format is available. Ripgrep is the search primitive it expects. When you align your harness to what Codex was trained on, you stop paying the attention tax.

The instinct is to add capabilities. The reality is that adding unfamiliar tools dilutes the model's focus on the actual task.

## GPT-5 is different

GPT-5 was trained to generalize across harnesses. It handles varied tool formats without the same performance hit. If you need flexibility in your integration, GPT-5 gives you more room to customize.

But Codex wasn't built for that use case. It was built to execute autonomously within a known environment.

> "Codex is very tightly optimized to the Codex harness and the Codex basically kind of like product cycle... it's not going to do things like communicate as much with you along the way."
>
> Brian Fioca, [Roo Cast S01E16](https://www.youtube.com/watch?v=Nu5TeVQbOOE)

The tradeoff is explicit: Codex trades flexibility for execution depth. GPT-5 trades some of that depth for adaptability.

## The practical decision

If you're integrating Codex:

1. **Audit your tool surface.** How many custom tools are you exposing? Each one is potential overhead.
2. **Adopt the native format.** OpenAI's apply patch is open-sourced. Use it instead of your custom diff format.
3. **Stick to ripgrep for search.** Don't add fancy search abstractions unless you're willing to pay the attention cost.
4. **Reserve customization for GPT-5.** If your harness genuinely needs varied tooling, route those tasks to GPT-5.

## Harness complexity: old approach vs. optimized approach

| Dimension        | Custom harness approach     | Optimized Codex approach          |
| ---------------- | --------------------------- | --------------------------------- |
| Diff format      | Proprietary schema          | OpenAI apply patch (open-sourced) |
| Search tooling   | Custom abstractions         | Ripgrep native                    |
| Tool count       | Many specialized tools      | Minimal surface area              |
| Model attention  | Split across format parsing | Focused on coding task            |
| Integration cost | High debugging overhead     | Aligned to training distribution  |

## How Roo Code handles harness complexity automatically

Roo Code takes a different approach to the harness alignment problem. Rather than requiring you to manually strip down tooling or match specific formats, Roo Code lets you bring your own key (BYOK) and choose the model that fits your task. The agent closes the loop by proposing changes, running commands and tests, and iterating based on results - all within a harness designed for flexibility across model providers.

When using Codex through Roo Code, the harness automatically handles the translation layer, so you get the execution depth of Codex without manually restructuring your workflow around apply patch and ripgrep.

## Why this matters for your team

For a Series A to C engineering team, this is a resource allocation question. You don't have cycles to debug why the model keeps formatting diffs wrong. You need it to work.

The fix isn't deeper prompt engineering. The fix is alignment: match your harness to the model's training distribution, or pick a model trained to handle yours.

If Codex is struggling in your integration, the first question isn't "how do I prompt this better?" It's "how much of my custom tooling can I remove?"

Start with apply patch and ripgrep. Add complexity only when you've measured the cost.

## Frequently asked questions

### What is the attention tax when using Codex?

The attention tax refers to the cognitive budget Codex spends parsing unfamiliar tool formats instead of solving the actual coding problem. When you expose custom diff formats or specialized search commands that differ from Codex's training distribution, the model diverts processing capacity to understanding your tooling rather than executing the task effectively.

### Why does Codex struggle with custom tool harnesses?

Codex was hyper-trained on a specific setup: OpenAI's apply patch format and ripgrep for code search. This tight optimization means it excels within that environment but underperforms when asked to work with different diff formats or search abstractions. It's a deliberate tradeoff - execution depth over flexibility.

### Should I use GPT-5 or Codex for my integration?

Use Codex when you can align your harness to its native tooling (apply patch, ripgrep) and want deep autonomous execution with minimal back-and-forth. Use GPT-5 when your integration requires varied tool formats or custom abstractions, as it was trained to generalize across different harnesses.

### How does Roo Code help with model selection and harness alignment?

Roo Code provides a BYOK (bring your own key) approach that lets you choose the right model for each task without manually restructuring your harness. The agent handles translation between your workflow and model-specific requirements, so you can leverage Codex's execution depth or GPT-5's flexibility based on the task at hand.

### What's the fastest way to improve Codex performance in my harness?

Start by auditing your tool surface and removing custom tooling. Adopt OpenAI's open-sourced apply patch format instead of proprietary diff schemas. Use ripgrep directly rather than search abstractions. Only add complexity back when you've measured the actual attention cost and confirmed the tradeoff is worth it.
