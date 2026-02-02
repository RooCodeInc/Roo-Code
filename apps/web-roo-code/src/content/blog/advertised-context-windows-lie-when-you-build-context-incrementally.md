---
title: Advertised Context Windows Lie When You Build Context Incrementally
slug: advertised-context-windows-lie-when-you-build-context-incrementally
description: Why 1 million token context windows degrade to 300-400K usable tokens in agentic workflows, and how to design tasks for the effective limit.
primary_schema:
    - Article
    - FAQPage
tags:
    - context-windows
    - agentic-workflows
    - task-design
    - llm-limitations
status: published
publish_date: "2025-08-20"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

1 million tokens of context.

That's what the spec sheet says. That's not what you get.

## The difference between spec and reality

You're debugging a failing integration test. The agent reads the test file. Then the implementation. Then the config. Then it runs the test, reads the output, proposes a fix, and you reject it. It reads more files. Runs the test again. Reasons about the delta.

Each turn adds to the context. Files, command outputs, reasoning traces, your feedback. The context grows incrementally, turn by turn, as the agent does its job.

And somewhere around 300,000 to 400,000 tokens, the wheels start to come off.

Not dramatically. The model doesn't refuse to respond. It just starts losing the thread. References a file it read eight turns ago incorrectly. Suggests a fix you already tried. Forgets a constraint you stated clearly in the second message.

> "I see 1 million context with Gemini as not 1 million context. If you dump it all in at the beginning no problem. But once you're slowly building that context, adding one file at a time, several files at a time, doing some thinking back and forth, that context goes to crap 3, 400,000."
>
> Guest, [Roo Cast S01E05](https://www.youtube.com/watch?v=h5lA0vaLH64&t=2000)

The distinction matters: static context versus incrementally built context. If you paste your entire codebase into a single prompt and ask one question, the advertised limit holds. But agentic workflows don't work that way. The context accumulates through the conversation, interleaved with reasoning and tool outputs.

## The "secret stat"

Every model has a degradation curve. The spec sheet tells you the maximum. It does not tell you where quality starts to drop.

> "It's a secret stat for the models... where the model starts to degrade heavily every turn."
>
> Hannes Rudolph, [Roo Cast S01E05](https://www.youtube.com/watch?v=h5lA0vaLH64&t=2047)

This isn't published anywhere. You discover it empirically: the agent starts repeating itself, losing track of prior reasoning, or confidently stating things that contradict earlier context.

The practical limit for incrementally built context appears to be 30% to 40% of the advertised maximum. For a model advertising 1 million tokens, plan for 300,000 to 400,000 usable tokens in a multi-turn agentic session.

## What this means for task design

Long-running tasks hit this wall. If your workflow involves reading a large codebase, running multiple commands, and iterating through several fix attempts, you will exceed the effective limit before you exceed the advertised one.

The symptoms are subtle:

- The agent suggests a fix you already rejected
- It references file contents incorrectly
- It loses track of requirements stated early in the conversation
- Reasoning quality degrades even though the model still responds

The fix isn't "use a bigger context window." The fix is task design: break large tasks into smaller ones, summarize and restart when context accumulates, and watch for the degradation signals.

> "With Sonnet, I haven't tested to see does it hold on to reality as you go up one 100,000, 200,000, 300,000."
>
> Guest, [Roo Cast S01E05](https://www.youtube.com/watch?v=h5lA0vaLH64&t=2028)

Different models degrade at different rates. Testing your specific workflow against your specific model is the only way to know where the effective limit lives.

## Why this matters for your workflow

For an engineer running agentic debugging sessions, this changes how you structure work. A task that reads 50 files and runs 10 command iterations will accumulate context differently than a quick "fix this lint error" task.

If you're hitting the 200,000 token mark and the agent starts losing coherence, that's not a model bug. That's the effective limit revealing itself. The move is to checkpoint, summarize, and start a fresh task with the condensed context.

## The planning rule

Plan for the effective limit, not the spec sheet number.

If your workflow regularly builds 500,000 tokens of incremental context, you're past the usable range for most models. Restructure the task, or build in explicit condensation points where you summarize progress and reset the context.

The advertised context window is an upper bound. The effective context window is what you can actually use. Treat them as different numbers.

## How Roo Code manages context accumulation

Roo Code's architecture addresses context degradation through deliberate task boundaries. Because Roo Code closes the loop - reading files, running commands, and iterating on results within a single conversation - context accumulates rapidly. The solution is structured handoffs between tasks.

With BYOK (bring your own key), you control which models power your workflows, letting you match model selection to task complexity. Short tasks can use faster models. Long debugging sessions benefit from models with better degradation curves.

**The agentic workflow principle:** Break large tasks into focused subtasks before context degrades, then use condensed summaries to carry forward only what matters.

Roo Code's mode system and task isolation let you checkpoint progress naturally. When you notice the agent losing coherence, start a new task with a summary of where you left off. The context resets; your progress doesn't.

## Comparison: Static prompts vs. agentic context building

| Dimension               | Static prompt (paste everything) | Incremental agentic context                           |
| ----------------------- | -------------------------------- | ----------------------------------------------------- |
| Context composition     | All information loaded upfront   | Files, outputs, and reasoning accumulate turn by turn |
| Usable context          | Near advertised maximum          | 30-40% of advertised maximum                          |
| Degradation pattern     | Rare if under limit              | Gradual loss of coherence over turns                  |
| Recovery strategy       | N/A                              | Checkpoint, summarize, restart                        |
| Task design requirement | Single well-formed query         | Explicit condensation points                          |

## Frequently asked questions

### Why does context quality degrade when building incrementally?

Each turn adds not just new information but also reasoning traces, tool outputs, and conversational overhead. This interleaved content competes for attention with the core information you need the model to retain. The model's ability to maintain coherence across disparate chunks degrades faster than raw token counts would suggest.

### How do I know when my context has degraded too far?

Watch for these signals: the agent suggests fixes you already rejected, references file contents incorrectly, forgets constraints stated earlier, or provides confident answers that contradict prior context. These indicate the effective limit has been reached, even if token counts remain under the advertised maximum.

### Does Roo Code help manage context limits automatically?

Roo Code's task-based architecture provides natural checkpoints for context management. When you complete a subtask or notice degradation, you can start a fresh task with a condensed summary. Roo Code closes the loop within each task while letting you control when to reset context between tasks.

### Should I choose models based on context window size?

Context window size matters less than degradation behavior. A model with 200,000 tokens that maintains quality throughout may outperform a 1 million token model that degrades at 300,000. Test your specific workflows against candidate models to find where each model's effective limit lives.

### What's the best strategy for long debugging sessions?

Structure debugging as a series of focused tasks rather than one continuous conversation. After each major milestone - identifying the bug, implementing a fix, verifying the solution - summarize progress and start fresh. Carry forward only the condensed context needed for the next phase.
