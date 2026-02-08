---
title: Ask About Design Patterns Before You Start Coding
slug: ask-about-design-patterns-before-you-start-coding
description: Learn why asking AI coding agents about design patterns before implementation produces more maintainable code and reduces refactoring debt.
primary_schema:
    - Article
    - FAQPage
tags:
    - design-patterns
    - ai-coding-workflow
    - code-quality
    - prompt-engineering
status: draft
publish_date: "2025-10-01"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

The diff solves the problem. It's also the brute-force solution you'll refactor next sprint.

## The default behavior

You're reviewing code the agent just produced. It compiles. It handles the edge cases. Every line does what you asked.

But there are three nested conditionals where a strategy pattern would do. There's a chain of if-else blocks that screams for a state machine. The agent solved the problem the way a junior developer would: correctly, but without recognizing that established patterns already exist for this exact situation.

You accept the diff because it works. You add "refactor this" to your mental backlog. The backlog grows.

## The unlock

The fix is two words, applied before the agent starts writing code.

> "I just actually unlocked a new one recently that I'm going to use a lot more going forward and that is to ask the agent what design patterns we should apply to the problem we're trying to solve up front."
>
> John Sterns, [Roo Cast S01E11](https://www.youtube.com/watch?v=bqLEMZ1c9Uk&t=2006)

The prompt shift is simple: before you describe the feature, ask the agent which design patterns apply to the problem you're trying to solve.

Not "implement this feature." First: "What design patterns should we consider for this problem?"

The agent recognizes patterns well. Strategy, observer, factory, state machine, command: models have seen thousands of examples. They know when a problem fits a known shape. But they won't apply that knowledge unless you ask. Left to default behavior, they write code that works without thinking about whether established abstractions already solve the structural problem.

## Why it works

Models are trained on codebases that include pattern implementations. They can identify when a problem matches the shape of a known pattern. But without explicit prompting, they optimize for "produce code that compiles and passes the immediate test" rather than "produce code that fits the architectural conventions of this codebase."

Asking about patterns front-loads architectural thinking. The agent names the pattern, explains why it fits, and then writes an implementation that uses it. The resulting diff is closer to what a senior developer would write: not just correct, but structured.

> "Those magic words, design patterns, is creating much more elegant implementations than just kind of the sometimes the brute force solution that we'll go to by default."
>
> John Sterns, [Roo Cast S01E11](https://www.youtube.com/watch?v=bqLEMZ1c9Uk&t=2024)

The tradeoff: this adds a step. You're not diving straight into implementation. For trivial tasks, it's overhead. For anything you'll maintain for more than a week, the upfront investment prevents the "technically correct but structurally messy" pattern that creates refactoring debt.

## The prompt pattern

Before the implementation prompt:

What design patterns should we consider for [problem description]?
Consider the existing codebase structure and explain which pattern fits best.

Then, once the agent identifies a pattern:

Implement [feature] using the [pattern] approach you identified.

This works because you're asking the agent to do pattern recognition, which it's good at, before asking it to generate code, which it will do however you let it.

## Pattern-first vs implementation-first approach

| Dimension          | Implementation-first                | Pattern-first                  |
| ------------------ | ----------------------------------- | ------------------------------ |
| Initial speed      | Faster to first diff                | Adds one prompt cycle          |
| Code structure     | Solves immediate problem            | Fits established abstractions  |
| Refactoring debt   | Accumulates over time               | Reduced from the start         |
| Agent behavior     | Optimizes for "compiles and passes" | Optimizes for maintainability  |
| Long-term velocity | Slows as backlog grows              | Sustained through cleaner code |

## How Roo Code closes the loop on design patterns

Roo Code's ability to close the loop - proposing diffs, running tests, and iterating based on results - makes the pattern-first approach particularly effective. When you ask Roo Code about design patterns before implementation, it can identify the appropriate pattern, generate code that uses it, run your test suite to verify correctness, and iterate if the pattern implementation needs adjustment.

With BYOK (bring your own key), you control which model handles the pattern recognition step. More capable models often identify subtler pattern applications, while faster models work well for straightforward cases like replacing conditionals with strategy patterns.

The key insight: Roo Code knows design patterns from its training data, but it won't apply them unless you explicitly ask before implementation begins.

## Why this matters for your workflow

If you're shipping features weekly, the cumulative effect of brute-force implementations adds up. Each "works but messy" diff becomes a future refactoring task. Each future refactoring task competes with new feature work.

The pattern-first prompt doesn't slow you down much: one additional question before implementation. But it shifts the quality of the output from "junior developer who solved the problem" to "senior developer who recognized the pattern."

Over a month of feature work, the difference shows up in how much time you spend refactoring code that the agent could have written correctly the first time.

## The rule

If the task involves any branching logic, state transitions, or extensibility concerns, ask about patterns first.

The agent knows the patterns. It just won't use them unless you ask.

## Frequently asked questions

### When should I skip the pattern-first approach?

Skip pattern-first prompts for trivial tasks that you won't maintain beyond a week: one-off scripts, quick fixes to isolated functions, or prototype code you plan to discard. The overhead of an extra prompt cycle isn't worth it when the code has a short lifespan.

### Which design patterns do AI coding agents recognize most reliably?

AI agents reliably recognize the Gang of Four patterns with abundant training examples: Strategy, Observer, Factory, State, Command, and Singleton. They also identify common structural patterns like Repository, Adapter, and Decorator. Less common or domain-specific patterns may require more explicit guidance in your prompt.

### How do I know if the agent chose the right pattern?

Review the agent's explanation before accepting the implementation. A good pattern choice will clearly match the problem's structure: Strategy for interchangeable algorithms, State for objects that change behavior based on internal state, Observer for one-to-many dependencies. If the explanation feels forced, ask the agent to reconsider or suggest alternatives.

### Does Roo Code apply design patterns automatically?

Roo Code, like other AI coding agents, optimizes for producing code that compiles and passes tests unless you explicitly ask about patterns. By prompting for pattern recognition before implementation, you shift Roo Code's behavior from "solve the immediate problem" to "solve the problem using established abstractions."

### How does pattern-first prompting affect code review time?

Pattern-first code typically passes review faster because reviewers recognize the structure. Instead of tracing through custom logic, they see familiar patterns and focus on whether the pattern is applied correctly. This reduces both the reviewer's cognitive load and the likelihood of "refactor this later" comments.
