---
title: Two Words in Your System Prompt Can Double Your Eval Pass Rate
slug: two-words-in-your-system-prompt-can-double-your-eval-pass-rate
description: How changing "diff" to "apply diff tool" in a system prompt increased Gemini 2.0 Flash's eval pass rate from 26% to 56% - a practical guide to prompt precision for AI coding agents.
primary_schema:
    - Article
    - FAQPage
tags:
    - prompt-engineering
    - evals
    - system-prompts
    - ai-coding-agents
status: draft
publish_date: "2025-04-09"
publish_time_pt: "9:00am"
source: "Office Hours"
---

26% to 56%.

Two words.

That's not a model upgrade. That's a system prompt edit.

## The literal machine

The Roo Code team ran Gemini 2.0 Flash through their eval suite. It completed 26% of tasks. Not great, but a starting point.

Then they changed two things in the system prompt:

1. Replaced "diff" with "apply diff tool"
2. Added explicit file content boundaries

The pass rate jumped to 56%.

No model change. No architecture change. No fine-tuning. Just clearer instructions.

The original prompt said something like: "use the read file tool to get the latest content of the file before attempting the diff again."

The fix: "use the read file tool to get the latest content of the file before attempting to use the apply diff tool."

> "The wording in the system prompt referred to the apply diff tool as diff. So it said use the read file tool to get the latest content of the file before attempting the diff again. So we changed it to use the read file tool to get the latest content of the file before attempting to use the apply diff tool."
>
> Hannes Rudolph, [Office Hours S01E01](https://www.youtube.com/watch?v=DZIkxSMPKOY&t=2901)

The model was interpreting "diff" as a concept, not as a tool name. It knew what a diff was. It didn't know you meant the specific tool called "apply diff tool."

## Why this happens

LLMs parse instructions literally. More literally than most developers assume.

When you write a prompt, you're not writing for a colleague who will infer your intent from context. You're writing for a system that will follow the exact words you used, including the ambiguities you didn't notice.

> "Indefinite articles make a difference in prompt engineering. Be very very it's like telling your six-year-old what to do."
>
> Matt, [Office Hours S01E01](https://www.youtube.com/watch?v=DZIkxSMPKOY&t=2950)

"Use the diff" and "use the apply diff tool" feel synonymous when you read them. They're not synonymous to the model. One is a vague reference; the other is an exact tool invocation.

The same applies to file content boundaries. If your prompt doesn't clearly mark where file content starts and ends, the model may parse your instructions as part of the file, or vice versa. Explicit delimiters remove ambiguity.

## The tradeoff

Precise prompts are longer prompts. You're trading brevity for clarity.

If your system prompt is already pushing context limits, adding explicit tool names and boundary markers costs tokens. For most workflows, the tradeoff is worth it: a 30-point improvement in task completion outweighs a few hundred extra tokens per request.

The harder tradeoff is maintenance. Precise prompts are more brittle. If you rename a tool, you need to update every reference. If you change your file format, you need to update your boundary markers. The cost of precision is vigilance.

## Prompt precision: vague vs. explicit

| Dimension          | Vague prompt        | Explicit prompt                       |
| ------------------ | ------------------- | ------------------------------------- |
| Tool reference     | "use the diff"      | "use the apply diff tool"             |
| File boundaries    | Implicit or missing | Explicit delimiters marking start/end |
| Token cost         | Lower               | Slightly higher                       |
| Maintenance burden | Lower               | Higher (must update on tool renames)  |
| Eval pass rate     | Baseline            | 30+ point improvement possible        |

## How Roo Code closes the loop on prompt precision

Roo Code's system prompts are designed with explicit tool names and clear content boundaries so the agent can propose diffs, run commands and tests, and iterate based on the results without ambiguity. When you use Roo Code with your own API keys (BYOK), every token spent goes toward precise instructions that maximize task completion rather than vague references that waste cycles on retries.

The 26% to 56% improvement measured in Roo Code's eval suite demonstrates that prompt precision is not optional for agentic workflows. It is the difference between an agent that closes the loop and one that spins on the same failure.

## Why this matters for your workflow

If you're debugging why a model keeps failing at a specific step, the prompt wording is the first place to look.

The symptoms:

- The model knows the concept but doesn't invoke the right tool
- The model parses file content as instructions, or vice versa
- The model retries the same wrong approach with slight variations

The fix:

- Audit every tool reference. Is it the exact name the model expects?
- Add explicit boundaries. Mark where instructions end and content begins.
- Test the change against your evals. Measure the delta.

A 30-point swing from two words is extreme, but double-digit improvements from prompt precision are common. The model isn't broken; it's doing exactly what you told it to do.

## The literal test

Read your system prompt out loud. Would a six-year-old know exactly which tool you mean? Would they know where the instructions stop and the file content starts?

If not, the model doesn't know either.

Start with tool names. Make them exact. The pass rate will follow.

## Frequently asked questions

### Why do small wording changes have such a large impact on model performance?

LLMs parse instructions literally rather than inferring intent from context. When a prompt uses "diff" instead of "apply diff tool," the model interprets it as a concept rather than a specific tool invocation. This ambiguity causes the model to attempt operations that don't map to available tools, resulting in failures that compound across multi-step tasks.

### How do I know if my prompt has ambiguous tool references?

Look for symptoms: the model knows the concept but doesn't invoke the right tool, it parses file content as instructions, or it retries the same wrong approach repeatedly. Audit your prompt for any tool reference that uses shorthand or informal names instead of the exact tool name your system expects.

### Does Roo Code handle prompt precision automatically?

Roo Code's system prompts are engineered with explicit tool names and file content boundaries built in. When you start a task, the agent receives instructions that map directly to available tools, reducing ambiguity and improving task completion rates. This precision is part of how Roo Code closes the loop on complex coding tasks.

### What is the tradeoff between prompt precision and token cost?

Precise prompts are longer, which costs more tokens per request. However, a 30-point improvement in task completion typically outweighs a few hundred extra tokens. The real tradeoff is maintenance: precise prompts require updates whenever you rename tools or change file formats.

### How can I test whether prompt changes improve my eval scores?

Run your eval suite before and after the prompt change, keeping all other variables constant. Measure the delta in pass rate. Even if you don't see a 30-point swing, double-digit improvements from prompt precision are common when you systematically replace vague references with exact tool names.
