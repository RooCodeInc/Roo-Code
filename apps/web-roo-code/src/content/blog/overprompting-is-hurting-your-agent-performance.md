---
title: Over-Prompting Is Hurting Your Agent Performance
slug: overprompting-is-hurting-your-agent-performance
description: Learn why detailed specifications can make AI coding agents worse and how mandate-based prompting delivers better results with less token overhead.
primary_schema:
    - Article
    - FAQPage
tags:
    - ai-agents
    - prompting
    - developer-workflow
    - productivity
status: published
publish_date: "2025-07-09"
publish_time_pt: "9:00am"
source: "Office Hours"
---

Your detailed specification is making the agent worse.

You wrote the context doc. You listed every edge case. You specified the exact file structure, the naming conventions, the error handling patterns. You gave the agent everything it needed to succeed.

And now it's generating a 47-item to-do list instead of writing code.

## The overhead trap

You've seen the advice: give the model more context. Write detailed system prompts. Document your codebase. The more information the agent has, the better it performs.

Except when it doesn't.

The problem shows up when the agent starts treating your documentation as a constraint instead of a guide. You wanted it to write a utility function. Instead, it's parsing your specification line by line, building an elaborate plan, and generating scaffolding for edge cases you mentioned once in passing.

The overhead compounds. More context means more tokens spent reading. More reading means more opportunities for the model to latch onto irrelevant details. And when your specification conflicts with what the model already knows about writing code, you get output that follows your rules but ignores best practices.

> "Sometimes that can go on a downside because I feel like overprompting is actually a thing. When you try to give way too much details, all these documents, and then it tries to read and create a super-detailed to-do list. I think it adds too much overhead into the process."
>
> Melo, [Office Hours S01E13](https://www.youtube.com/watch?v=gI0FImx5Qjs)

## The mandate pattern

The alternative sounds too simple to work: give the agent a mandate instead of a manual.

A mandate is a clear outcome with minimal prescription. "Add retry logic to the API client" instead of "Add retry logic using exponential backoff with base delay of 100ms, max delay of 5000ms, jitter of ±10%, max attempts of 3, and custom error classification for 429 and 503 status codes."

The model already knows what retry logic looks like. It's seen thousands of implementations. When you over-specify, you're not giving it information; you're overriding information it already has with your particular preferences.

Sometimes that's what you want. If your codebase has unusual conventions, you need to specify them. But if you're just restating standard patterns, you're adding noise.

> "Sometimes we actually get better results by using a simpler prompt and just letting the model do its thing. Giving it a mandate instead of micromanaging it."
>
> Roo Code Team, [Office Hours S01E13](https://www.youtube.com/watch?v=gI0FImx5Qjs)

## When models know more than your spec

The models keep getting better at code. The training data includes years of open source, documentation, and real implementations. When you write a detailed specification for a standard pattern, you're competing with that knowledge.

If your spec matches what the model knows, the extra context is redundant. If your spec diverges from what the model knows, the model has to reconcile the conflict. Neither outcome justifies the token cost.

> "The models are getting so good at doing everything code related. So sometimes by using a prompt that's too specific, it might go against what they know already about code."
>
> Melo, [Office Hours S01E13](https://www.youtube.com/watch?v=gI0FImx5Qjs)

The tradeoff: simpler prompts require more trust. You're betting that the model's default behavior is close enough to what you want. If it isn't, you'll need to iterate. But iteration on a short prompt is cheaper than debugging output from a conflicted long prompt.

## Why this matters for your workflow

For an engineer running 10-15 agent tasks per day, prompt overhead adds up. Each extra paragraph in your system prompt is tokens spent on reading instead of generating. Each detailed specification is a potential conflict with the model's training.

The compounding effect is subtle. You don't notice the overhead on any single task. But across a week, you're spending hours watching the agent build elaborate plans for work that should take minutes.

## The calibration

Start with a mandate. Watch what the agent does. If it misses something important, add that specific constraint. If it follows a pattern you don't like, override that pattern.

Build your context incrementally based on what actually fails, not what might fail.

The prompt that works is often shorter than the one you started with.

## How Roo Code closes the loop on prompt calibration

Roo Code lets you iterate on prompts without leaving your editor. Because Roo Code closes the loop - running commands, executing tests, and iterating based on results - you see immediately whether your mandate worked or needs refinement.

With BYOK (bring your own key), you control your token spend directly. There's no markup obscuring the cost of over-prompting. When a bloated specification burns through tokens on planning instead of coding, you see it in real time.

**Roo Code's approval system lets you catch over-specification before it compounds.** When the agent generates an elaborate 47-item plan for a simple task, you can reject it, simplify your prompt, and try again - all within the same workflow.

## Over-prompting vs. mandate-based prompting

| Dimension       | Over-prompting                                            | Mandate-based prompting                     |
| --------------- | --------------------------------------------------------- | ------------------------------------------- |
| Token cost      | High - context parsing adds overhead on every task        | Low - minimal input, maximum output         |
| Conflict risk   | High - spec may contradict model's training               | Low - leverages model's existing knowledge  |
| Iteration speed | Slow - debugging long prompts is tedious                  | Fast - short prompts are easy to refine     |
| Output quality  | Variable - model may follow rules but miss best practices | Consistent - model applies learned patterns |
| Trust required  | Low - you specify everything                              | Higher - you trust the model's defaults     |

## Frequently asked questions

### What is over-prompting and why does it hurt agent performance?

Over-prompting occurs when you provide so much context and specification that the agent spends more tokens parsing your instructions than generating useful code. The agent may also encounter conflicts between your detailed rules and its training data, producing output that follows your spec but ignores established best practices.

### How do I know if I'm over-prompting my AI coding agent?

Watch for these signs: the agent generates lengthy to-do lists before writing code, output includes scaffolding for edge cases you barely mentioned, or the agent seems to be following your rules mechanically rather than applying judgment. If simpler tasks consistently take longer than expected, your prompt may be the bottleneck.

### What is a mandate-based prompt?

A mandate-based prompt specifies the desired outcome without prescribing the implementation. Instead of detailing every parameter and pattern, you state what you want accomplished and let the model apply its training. For example, "add retry logic to the API client" rather than specifying exact delay values and jitter percentages.

### How does Roo Code help with prompt calibration?

Roo Code closes the loop by running commands and tests, showing you immediately whether your prompt worked. The approval system lets you catch over-specification early - when the agent proposes an elaborate plan for a simple task, you can reject it and simplify your prompt. With BYOK, you see your actual token costs, making over-prompting overhead visible and actionable.

### When should I use detailed specifications instead of mandates?

Use detailed specifications when your codebase has unusual conventions the model wouldn't know, when you need exact consistency with existing patterns, or when the task involves domain-specific rules not represented in the model's training. For standard patterns and common tasks, mandates typically outperform detailed specs.
