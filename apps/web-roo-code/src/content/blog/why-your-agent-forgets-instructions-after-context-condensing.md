---
title: Why Your Agent Forgets Instructions After Context Condensing
slug: why-your-agent-forgets-instructions-after-context-condensing
description: Learn why AI coding agents lose formatting rules and workflow constraints after context condensing, and how preserving the first message fixes instruction drift in long sessions.
primary_schema:
    - Article
    - FAQPage
tags:
    - context-management
    - agentic-workflows
    - prompt-engineering
    - ai-coding-agents
status: draft
publish_date: "2025-09-17"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

Your formatting rules worked perfectly. For the first twenty exchanges.

Then the context window filled up, the agent condensed, and suddenly it stopped following your output structure.

## The symptom

You have strict instructions about output format. Every review comment should follow a specific template. Every code suggestion should include a test case. The agent knows this. It follows the rules.

Until it doesn't.

After a long session, the agent condenses your conversation to fit within context limits. The next response comes back wrong. Not wrong in content, wrong in structure. The formatting rules vanished.

> "I was seeing some weird behavior with some of my workflows. Some of my workflows have really like strict instructions about the output how it should look and I saw that it was just after condensing it was just forgetting how to properly format you know comments reviews."
>
> Dan, [Roo Cast S01E09](https://www.youtube.com/watch?v=Vo5grOXbjIY&t=1299)

You didn't change anything. The agent didn't misunderstand. Something got lost in the condensing.

## The root cause

The problem was in what got replaced during condensing. The first message in your conversation contains your directive: the system prompt, your formatting rules, your workflow constraints. That message is the anchor.

When the context window fills up and condensing kicks in, the system needs to summarize. The naive approach: replace the first message with something like "please continue with this summary." The summary captures the conversation state but drops your original instructions.

> "It turns out the first message was being replaced with something else when condensing something along the lines of please continue with this summary or something like that."
>
> Dan, [Roo Cast S01E09](https://www.youtube.com/watch?v=Vo5grOXbjIY&t=1313)

The model now treats the summary as the main instruction. Your formatting rules existed in the first message. The first message is gone. The rules are gone.

## Why providers do middle-out

This explains a pattern you might have noticed: many providers use middle-out transformations when hitting context limits. They preserve the first message and the recent messages while summarizing the middle.

> "The first message includes... that's why providers for example do middle out transformations when when you reach the context window limit... because the first message contains your directive."
>
> Dan, [Roo Cast S01E09](https://www.youtube.com/watch?v=Vo5grOXbjIY&t=1341)

The first message is architecturally significant. It's not just another turn in the conversation. It's the directive that shapes everything else. Lose it, and the model loses its purpose.

## The fix

The solution is straightforward: preserve the first message during condensing. Don't replace it with a generic "continue with this summary" prompt. Keep the original directive intact and summarize the middle of the conversation instead.

After implementing this fix, agents stay on task across long sessions. The formatting rules persist. The workflow constraints hold. The condensing happens, but the directive survives.

## Context condensing approaches compared

| Dimension                | Naive condensing             | Middle-out condensing            |
| ------------------------ | ---------------------------- | -------------------------------- |
| First message handling   | Replaced with summary prompt | Preserved intact                 |
| Directive persistence    | Lost after condensing        | Retained across sessions         |
| Formatting rule survival | Rules vanish at boundary     | Rules persist through condensing |
| Long session reliability | Drift increases over time    | Consistent behavior maintained   |
| Recovery required        | Manual re-instruction needed | No intervention required         |

## How Roo Code preserves your directives

Roo Code implements middle-out context management to keep your workflow instructions intact across long sessions. When the context window fills, Roo Code summarizes the middle of the conversation while preserving both your original directive and recent context. This means your formatting rules, output structures, and workflow constraints survive the condensing boundary.

**Roo Code preserves the first message during context condensing, ensuring your workflow instructions and formatting rules persist across long agentic sessions.**

Because Roo Code closes the loop by running commands, tests, and iterating based on results, maintaining consistent instructions is critical. An agent that forgets your output format mid-task creates manual correction work. With directive preservation, you can run complex multi-step tasks knowing your constraints will hold from start to finish.

## What to check

If your agent is drifting after long sessions, check what happens at the condensing boundary:

1. Is your first message being preserved or replaced?
2. Does the summary include your directive, or just the conversation state?
3. Are your formatting rules making it through the condensing intact?

The symptom is instruction drift. The cause is usually the first message getting dropped. The fix is preserving it.

## Frequently asked questions

### Why do my agent's formatting rules disappear after long conversations?

When context windows fill up, some systems replace the first message with a generic summary prompt. Since your formatting rules and workflow instructions live in that first message, they get lost during condensing. The agent continues with the summary as its new directive, which lacks your original constraints.

### What is middle-out context condensing?

Middle-out condensing is a strategy that preserves the first message and recent messages while summarizing the middle of the conversation. This approach recognizes that the first message contains architecturally significant directives that shape the entire session. By keeping it intact, the agent maintains its purpose and constraints.

### How does Roo Code handle context condensing differently?

Roo Code preserves your original directive during context condensing by implementing middle-out summarization. Your workflow instructions, formatting rules, and output constraints survive the condensing boundary. This lets you run long agentic sessions without losing the instructions that define your task.

### Can I recover from instruction drift without starting over?

If your agent has already lost its instructions, you can re-state your formatting rules and constraints in a new message. However, the better approach is using a tool that preserves directives during condensing so you don't need to manually intervene. Prevention is more reliable than recovery.

### How do I know if my first message is being preserved?

Watch for sudden changes in output format or structure after long sessions. If the agent was following specific rules and suddenly stops, check whether the condensing replaced your first message. You can also explicitly ask the agent what its current instructions are to see if your original directive is still present.
