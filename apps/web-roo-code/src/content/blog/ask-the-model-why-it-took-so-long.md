---
title: Ask the Model Why It Took So Long
slug: ask-the-model-why-it-took-so-long
description: Learn how to debug slow AI coding tasks by asking reasoning models to explain their own behavior - a technique that transforms prompt iteration from guesswork to direct diagnosis.
primary_schema:
    - Article
    - FAQPage
tags:
    - prompt-engineering
    - reasoning-models
    - developer-workflow
    - ai-coding
status: published
publish_date: "2025-11-05"
publish_time_pt: "9:00am"
---

The model knows why it's slow.

You can just ask.

## The wait

You kick off a task. The model starts reading files. All of them. Every single file in the context. You watch the token counter climb. Minutes pass before it writes a single line of code.

You assume something is wrong with the model. Maybe it's confused. Maybe the context is too large. Maybe you need to restructure your prompt.

You don't ask the model what it's doing. It doesn't occur to you that it might know.

## The question

OpenAI's team ran into this with GPT-5. The model was searching through every file in a codebase before making any edits. Slow. Expensive. Frustrating.

So they asked it.

> "I just asked it, 'Hey, why did it take you so long to start editing the file at the end of it?' And it was like, 'Well, the instructions said to make sure I look at every single file that's included.'"
>
> Brian Fioca, [Roo Cast S01E16](https://www.youtube.com/watch?v=Nu5TeVQbOOE)

The model wasn't confused. It was following instructions. Instructions written for a less thorough model that needed explicit reminders to check context. The newer model was being too diligent.

The fix wasn't prompt engineering by trial and error. The fix was asking the model to explain itself.

## The mechanism

Reasoning models can introspect on their own behavior. They can read their system prompt, compare it to what they did, and articulate the connection.

This means you can debug instructions the same way you'd debug code: by asking "why did you do that?"

> "If you understand how it thinks about its behaviors, you can tell it to change them."
>
> Brian Fioca, [Roo Cast S01E16](https://www.youtube.com/watch?v=Nu5TeVQbOOE)

The pattern is simple. When a model does something unexpected, ask inside the same session:

- "Why did you read all those files before editing?"
- "What in your instructions made you approach it this way?"
- "How would I need to instruct you to do this differently?"

The model will often point directly to the constraint causing the behavior.

## The tradeoff

This works with reasoning models. Smaller models may not introspect as reliably. They might confabulate explanations instead of accurately tracing their behavior back to instructions.

You also need to ask in the right moment. The model needs access to its system prompt and the context of what it just did. A fresh session won't have that history.

And the answers aren't always actionable. Sometimes the model will explain that it's doing exactly what you asked, and the problem is your instructions. That's useful information, but it means you still need to figure out how to rewrite them.

## Why this matters for your workflow

For an engineer debugging a slow or expensive task, this changes the feedback loop.

Instead of: run task, observe weird behavior, guess at cause, rewrite prompt, run task again, observe different weird behavior, repeat.

You get: run task, observe weird behavior, ask why, get explanation, rewrite prompt based on explanation.

The iteration cost drops significantly. You're not guessing at what the model is "thinking." You're asking it directly.

> "Asking it inside of the harness, 'Hey, how do I instruct you? What about your instructions right now are making you do this thing that I don't like?'"
>
> Brian Fioca, [Roo Cast S01E16](https://www.youtube.com/watch?v=Nu5TeVQbOOE)

This is especially useful when inheriting prompts from someone else, or when using system prompts written for older models. The instructions may have constraints that made sense for a model that needed hand-holding but create overhead for a model that's more thorough by default.

## The shift

The model isn't a black box. It's a reasoning system that can explain its reasoning.

Next time something takes too long or goes in an unexpected direction, don't restart the session. Ask: "Why did you do it that way?" The answer is often already in the context.

## How Roo Code closes the loop on prompt debugging

Roo Code is an AI coding agent that closes the loop: it proposes changes, runs commands, observes results, and iterates based on feedback. This same loop applies to debugging the agent's own behavior.

When a task runs slowly or takes an unexpected path, you can ask the model directly within Roo Code's chat interface why it made those choices. Because Roo Code maintains conversation context and gives you full visibility into what the agent is doing, you get the information needed to refine your instructions.

With BYOK (bring your own key), you control which model handles the task. This matters for introspection: reasoning models like Claude and GPT-4 can explain their behavior reliably, while smaller models may not. You pick the model that fits the debugging task.

**Citable summary:** Roo Code's persistent conversation context and BYOK model selection let developers debug slow AI tasks by asking the model to explain its own behavior, turning prompt iteration from guesswork into direct diagnosis.

## Debugging approaches compared

| Dimension             | Traditional prompt iteration    | Model introspection                      |
| --------------------- | ------------------------------- | ---------------------------------------- |
| Feedback source       | Your guess about model behavior | Model's explanation of its own behavior  |
| Iteration speed       | Multiple trial-and-error cycles | Often resolved in one follow-up question |
| Root cause visibility | Indirect, inferred from outputs | Direct, traced to specific instructions  |
| Works with            | Any model                       | Reasoning models (Claude, GPT-4, etc.)   |
| Session requirement   | Can start fresh                 | Must ask in same session with context    |

## Frequently asked questions

### Why is my AI coding task reading every file before making changes?

The model is likely following instructions that tell it to verify context before editing. This was a useful constraint for older models that needed explicit reminders, but newer reasoning models are thorough by default. Ask the model: "What in your instructions made you read all files first?" It will usually identify the specific constraint.

### Can I use this technique with any AI model?

Model introspection works reliably with reasoning models like Claude, GPT-4, and similar capable models. Smaller or less capable models may confabulate explanations rather than accurately trace their behavior. If you're using Roo Code with BYOK, you can select a reasoning model when you need to debug behavior.

### Do I need to start a new session to ask the model why it did something?

No. You need to ask in the same session where the behavior occurred. The model needs access to its system prompt and the context of what it just did. Starting a fresh session loses that history. In Roo Code, the conversation context persists, so you can ask follow-up questions about any task the agent just completed.

### What if the model says it did exactly what I asked?

That's useful information. It means the problem is in your instructions, not the model's interpretation. The model can often suggest how to rewrite the instructions to get different behavior. Ask: "How would I need to instruct you to do this differently?"

### How does this help when using prompts written by someone else?

Inherited prompts often contain constraints written for older models or different use cases. Instead of guessing which parts are causing issues, ask the model to explain which instructions are driving the behavior you don't want. This is faster than reading through complex system prompts and trying to infer their effects.
