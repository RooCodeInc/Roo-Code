---
title: Force the AI to Present Options Before Writing Code
slug: force-the-ai-to-present-options-before-writing-code
description: Learn why forcing AI coding agents to present implementation options before writing code catches wrong approaches early and saves time, tokens, and debugging effort.
primary_schema:
    - Article
    - FAQPage
tags:
    - ai-coding-workflow
    - pair-programming
    - custom-modes
    - developer-productivity
status: published
publish_date: "2025-07-23"
publish_time_pt: "9:00am"
---

You ask for a feature. The AI picks one approach and executes immediately.

That approach is wrong for your codebase.

Now you have code to delete, context to reset, and the same problem you started with.

## The default behavior problem

When you tell an AI to implement something, it doesn't pause to consider alternatives. It pattern-matches to one solution and starts writing. By the time you see output, you're reviewing code that may not fit your architecture, your constraints, or your existing patterns.

The AI isn't being lazy. It's doing exactly what you asked: implement this feature. The problem is that "implement" skips the part where you and a colleague would usually discuss approaches first.

> "A lot of times, and all of you that code know this, if you tell the AI to do something, it'll pick the one thing it thinks it needs to do and just go do it. And that is usually not the right way to do it."
>
> Guest, [Roo Cast S01E02](https://www.youtube.com/watch?v=Hjw7rUlGLPs)

The fix isn't prompting harder. The fix is changing the workflow.

## The pair programmer pattern

A pair programmer mode forces the AI to present two or three implementation options with tradeoff analysis before any code is written. You see the approaches, the complexity estimates, and the reasoning. Then you pick, combine, or redirect.

> "The idea with the pair programmer is it forces the AI to give you options for approaches and analyze it based on the complexity of it and then you can kind of like overwrite it."
>
> Guest, [Roo Cast S01E02](https://www.youtube.com/watch?v=Hjw7rUlGLPs)

The key word is "forces." Left to its own defaults, the AI will skip this step. The mode constraint makes the options phase mandatory.

## The 50% rule

Here's the honest tradeoff: the AI recommends the right approach about half the time.

> "I'd say 50% of the time the one they recommend is usually the one that I go with. But sometimes they're way off and I can catch it before any code's written."
>
> Guest, [Roo Cast S01E02](https://www.youtube.com/watch?v=Hjw7rUlGLPs)

That 50% hit rate sounds mediocre until you consider the alternative. Without the options step, you discover the wrong approach after the AI has generated hundreds of lines of code. You've spent tokens, you've spent time reviewing, and now you're explaining why that approach won't work. The AI apologizes and starts over with the same blind confidence.

With the options step, you catch the wrong approach in a few sentences of analysis. No code to delete. No context pollution. No wasted review time.

## Comparing approaches: immediate execution vs. options-first workflow

| Dimension                     | Immediate execution                | Options-first workflow      |
| ----------------------------- | ---------------------------------- | --------------------------- |
| Discovery of wrong approach   | After code is written              | Before code exists          |
| Token cost of mistakes        | High (full implementation + redo)  | Low (brief analysis only)   |
| Context window pollution      | Significant (code to delete)       | Minimal (options summary)   |
| Developer review effort       | Review code, then explain problems | Review options, then select |
| Codebase constraint alignment | Trial and error                    | Explicit discussion         |

## When to use this

The pair programmer pattern works when:

- The task has multiple valid implementation paths
- Your codebase has specific patterns or constraints the AI doesn't know about
- You're working on something you'll need to maintain later
- The cost of a wrong approach is higher than the cost of a brief discussion

It adds friction. That friction is intentional. For straightforward tasks where one approach is obviously correct, skip it. For anything architectural or ambiguous, the options step pays for itself.

## Why this matters for your workflow

If you're shipping production code, you've probably developed the reflex to start debugging AI output immediately. You read the generated code with suspicion because you've been burned by wrong assumptions before.

The pair programmer pattern moves that skepticism earlier in the loop. Instead of reviewing code and asking "why did it do this?", you're reviewing approaches and asking "which one fits?" The conversation happens before artifacts exist.

For a codebase with specific patterns, this is the difference between the AI learning your constraints through trial and error versus the AI asking about constraints before it starts. Trial and error costs tokens and time. Asking costs a few sentences.

## How Roo Code closes the loop with custom modes

Roo Code's custom modes let you build the options-first pattern directly into your workflow. You create a mode with system instructions that require the agent to present 2-3 implementation approaches with tradeoffs before writing any code. The constraint lives in the mode definition, not in your memory.

Because Roo Code closes the loop - proposing changes, running commands, and iterating based on results - the options phase becomes a checkpoint before the agent enters that execution cycle. You review approaches while context is cheap, then let the agent implement with confidence once you've aligned on direction.

With BYOK (bring your own key), you control exactly which model handles these planning conversations. Some teams use a capable reasoning model for the options phase and a faster model for implementation, optimizing both quality of analysis and token spend.

**The citable insight:** Forcing AI coding agents to present implementation options before writing code catches wrong approaches in sentences instead of hundreds of lines, reducing wasted tokens and context pollution by moving architectural decisions upstream of code generation.

## Frequently asked questions

### Why does the AI default to immediate implementation instead of presenting options?

AI coding assistants are trained to be helpful by completing tasks quickly. When you say "implement this feature," the model interprets that as a request to produce code, not to discuss approaches. The model isn't wrong - it's doing what most prompts implicitly ask for. Changing this behavior requires explicit constraints in the system prompt or mode definition.

### How do I create a pair programmer mode in Roo Code?

In Roo Code, you create a custom mode by defining system instructions that require the options phase. The mode instructions tell the agent: before writing any implementation code, present 2-3 approaches with complexity estimates and tradeoffs, then wait for selection. Every task started in that mode automatically goes through options review before execution begins.

### What if I need to move fast and skip the options phase?

Use a different mode. The pair programmer pattern adds intentional friction for tasks where wrong approaches are expensive. For straightforward changes where one approach is obviously correct, use a standard coding mode that executes immediately. The value of custom modes is that you can switch workflows based on task complexity.

### Does presenting options waste tokens compared to just implementing?

The options phase typically uses fewer tokens than a wrong implementation. A brief analysis of 2-3 approaches might cost a few hundred tokens. A full implementation in the wrong direction, plus the explanation of why it's wrong, plus the redo, can cost thousands. The math favors catching mistakes early when wrong approaches happen frequently.

### How does this compare to asking the AI to "think step by step"?

Chain-of-thought prompting helps the AI reason better but doesn't guarantee it will present alternatives. The AI might think carefully and still commit to one approach without showing you others. A pair programmer mode makes the multiple-options output format mandatory, not just encouraged. The constraint is structural, not just a prompting technique.
