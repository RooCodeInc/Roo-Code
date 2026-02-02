---
title: Tool Call Reliability Is the Real Model Differentiator
slug: tool-call-reliability-is-the-real-model-differentiator
description: Why consistent tool call formatting under growing context matters more than benchmark scores for agentic coding workflows
primary_schema:
    - Article
    - FAQPage
tags:
    - ai-models
    - agentic-coding
    - tool-use
    - evaluation
status: published
publish_date: "2025-04-09"
publish_time_pt: "9:00am"
source: "Office Hours"
---

```xml

That's a broken tool call. The model wrapped `read_file` inside generic XML tags instead of using `read_file` as the tag name.

The file never gets read. The agent stalls. You're debugging the model instead of your code.

## The wrong benchmark

Model comparisons focus on one-shot coding puzzles. Can it solve LeetCode? Can it refactor a function? Those benchmarks matter for autocomplete. They don't predict whether an agent can work reliably across a 50-message session.

Agentic coding isn't about generating one correct answer. It's about making dozens of tool calls in sequence: read this file, run this command, propose this edit, check the output, iterate. Each tool call has to follow the exact format the system expects. One malformed call, and the loop breaks.

The model that wins isn't the one that writes the prettiest code. It's the one that follows tool calling instructions consistently as context grows.

> "The reason why people have been so gaga for Sonnet 3.5 and now 3.7 for so long is because when it comes to tool use it just pretty much works most of the time."
>
> Hannes Rudolph, [Office Hours S01E01](https://www.youtube.com/watch?v=DZIkxSMPKOY&t=181)

That's the bar: "just pretty much works most of the time." Not "best at coding." Not "highest benchmark score." Just consistent enough that you're not constantly restarting sessions because the agent forgot how to call a tool.

## Where it breaks

The failure mode is subtle. Early in a conversation, most models handle tool calls correctly. The system prompt is fresh, the instructions are clear, and the model complies.

Then context grows. You're 30 messages in. The model has seen hundreds of tool call examples in its own output. And somewhere around message 40, it starts improvising.

> "What will happen sometimes is Gemini will go to read a file and it'll wrap it in XML you know it'll say something like tool use and it will put the read file in the XML tags instead of XML tags titled read file."
>
> Hannes Rudolph, [Office Hours S01E01](https://www.youtube.com/watch?v=DZIkxSMPKOY&t=134)

Gemini 2.5 is a capable model. Strong raw coding ability. But if it can't maintain tool call formatting as context accumulates, you can't trust it for long-running agent sessions.

The trap is that these failures look intermittent. The model works fine for 20 minutes, then breaks in a way that seems random. You restart, it works again, you trust it again. Then it breaks at minute 25 on a different task.

## The evaluation that matters

For teams evaluating models, the test isn't "can it solve this problem once." The test is: can it maintain tool call reliability across a growing context window?

> "Getting it to abide by your tool calls continually as your context grows up to the max on a consistent basis. That is where Sonnet comes into play. And it is just it just works."
>
> Hannes Rudolph, [Office Hours S01E01](https://www.youtube.com/watch?v=DZIkxSMPKOY&t=216)

Run a session to 80% of the model's context limit. Count how many tool calls succeeded versus malformed. If you're seeing failures above 1-2%, that model isn't ready for agentic workflows in production.

One-shot benchmarks won't surface this. You need to simulate the conditions your agents actually run in: long sessions, accumulated context, repeated tool patterns.

## Why this matters for your team

For a team running PR reviews or code generation agents daily, tool call reliability determines whether the workflow is trustworthy or a constant source of interrupts.

If your agent fails one tool call out of twenty, and your typical session involves thirty tool calls, you're debugging the agent on half your tasks. That's not a productivity gain. That's a new category of toil.

The model choice isn't about which one writes the cleverest code. It's about which one you can trust to complete a session without intervention.

Test tool use reliability under growing context. That's where the real model differentiator shows up.

## How Roo Code handles model reliability

Roo Code is designed to close the loop: propose changes, run commands and tests, then iterate based on results. This agentic workflow depends entirely on reliable tool calling. A single malformed tool call breaks the iteration cycle and forces manual intervention.

With BYOK (bring your own key), teams choose which model powers their agent sessions. This matters because tool call reliability varies significantly between providers and model versions. Teams can test different models in their actual workflows and switch without vendor lock-in when a model's reliability degrades or a better option emerges.

Roo Code's approval system also provides a safety net. When tool calls do fail, you see exactly what the agent attempted before the failure. This visibility helps teams identify which models maintain reliability under their specific context patterns and workloads.

## Traditional benchmarks vs. agentic reliability

| Dimension | Traditional benchmarks | Agentic reliability testing |
|-----------|----------------------|---------------------------|
| Test duration | Single prompt, single response | 50+ message sessions |
| Context conditions | Fresh context only | Growing context to 80% of limit |
| Success metric | Correct code output | Tool call format compliance rate |
| Failure visibility | Wrong answer | Stalled agent, broken loop |
| Real-world prediction | Autocomplete quality | Production workflow reliability |

## Frequently asked questions

### Why do tool calls fail as context grows?

Models are trained on patterns. Early in a conversation, the system prompt's tool call format is the dominant pattern. As context accumulates with dozens of tool call examples, some models start generating variations they've seen in training data rather than following the specific format required. This drift is gradual and often appears random, making it difficult to reproduce consistently.

### How do I test a model's tool call reliability before committing to it?

Run sessions that reach 80% of the model's context limit with repeated tool call patterns. Count successful versus malformed calls. Any failure rate above 1-2% indicates the model will cause interrupts in real workflows. Simulate your actual use case: if you run PR reviews, test with PR review sessions, not generic coding tasks.

### Does Roo Code lock me into a specific model provider?

No. Roo Code uses BYOK (bring your own key), meaning you connect your own API keys from providers like Anthropic, OpenAI, or Google. You can switch models between sessions or test different providers without changing your workflow. This flexibility lets you respond quickly when model reliability changes between versions.

### What happens when a tool call fails in an agentic workflow?

The agent stalls. It may retry with another malformed call, or it may produce output that assumes the tool call succeeded when it didn't. Either way, the iteration loop breaks. You end up debugging the agent's tool calling behavior instead of making progress on your actual task. In production workflows, this translates directly to developer interrupts and lost time.

### Which models currently have the best tool call reliability?

As of early 2025, Claude Sonnet models (3.5 and 3.7) are known for consistent tool call compliance under growing context. Other models like Gemini 2.5 have strong coding capabilities but show more tool call format drift in long sessions. Model behavior changes with each release, so teams should retest whenever providers ship updates.

```
