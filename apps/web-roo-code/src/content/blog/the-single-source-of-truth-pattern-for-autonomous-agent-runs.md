---
title: The Single Source of Truth Pattern for Autonomous Agent Runs
slug: the-single-source-of-truth-pattern-for-autonomous-agent-runs
description: Learn the immutable reference pattern that enabled a 27-hour autonomous agent run to port 47 routes from Laravel to Go and Next.js with 83% success rate for $110.
primary_schema:
    - Article
    - FAQPage
tags:
    - autonomous-agents
    - agent-patterns
    - long-running-tasks
    - coding-workflows
status: published
publish_date: "2025-05-21"
publish_time_pt: "9:00am"
source: "Office Hours"
---

47 routes. 33 pages. 27 hours. $110.

One autonomous agent porting a Laravel app to Go and Next.js.

That's the result. Here's the pattern that made it work.

## The drift problem

An agent running for 27 hours without human intervention will drift. Not because the model is bad, but because it has nothing to check itself against.

You've seen this in shorter runs. The agent makes a change. The change introduces a bug. The agent tries to fix the bug by modifying the same file. Three iterations later, it's confidently solving a problem it created while ignoring the original task.

The drift accelerates when the agent can touch its own instructions. If the to-do list is editable, the agent will edit it. If the specification is in a file it can modify, it will "helpfully" update the spec to match what it built instead of what you asked for.

Without an anchor, models hallucinate and tasks break down into nonsense.

## The pattern: immutable reference

The fix is structural, not prompting. You need a file the agent can read but never modify.

> "You need to have a single source of truth... you need to have something that Roo Code will never touch but is always verifiable by Roo Code. So that's just to make sure the model can never ever get confused about what the instruction is."
>
> Shank, [Office Hours S01E07](https://www.youtube.com/watch?v=yGVPIdn0mVw&t=1083)

In the 27-hour porting run, the legacy Laravel codebase served as that anchor. The agent could:

- Read the existing routes and business logic
- Run the existing tests
- Verify its Go/Next.js output against real behavior

But it could not modify the Laravel source. The business logic was verified by checking against something the agent had no permission to change.

## The receipts

Out of 47 routes specified in the to-do prompt and 33 React pages planned, 39 routes and 32 pages worked out of the box.

That's 83% route success and 97% page success for a 27-hour autonomous run.

> "This full 27 hour run basically only cost me about $110 all in."
>
> Shank, [Office Hours S01E07](https://www.youtube.com/watch?v=yGVPIdn0mVw&t=1824)

The cost matters. $110 for a migration that would take a human team days or weeks of context-switching between two codebases.

## The tradeoff

The pattern requires upfront work. You need to:

1. Identify what the agent should never modify (the reference)
2. Configure permissions so it cannot accidentally touch the reference
3. Structure prompts so the agent knows to verify against the reference

This is more setup than "run and hope." But for long autonomous runs, the alternative is watching the agent drift into nonsense around hour four.

The immutable reference also means you need a codebase worth verifying against. If your legacy code has no tests, no clear routes, no consistent structure, the agent has nothing stable to check. The pattern works best when the source of truth is actually trustworthy.

## Immutable reference vs. unanchored runs

| Dimension             | Unanchored approach                                 | Immutable reference pattern                         |
| --------------------- | --------------------------------------------------- | --------------------------------------------------- |
| Drift prevention      | Relies on model coherence across thousands of calls | Agent verifies against an unchangeable source       |
| Instruction stability | Agent may "helpfully" edit specs to match output    | Specs remain outside write permissions              |
| Verification method   | Manual review at the end                            | Continuous self-checking against reference          |
| Long-run success rate | Degrades significantly after 4-6 hours              | Maintains 83%+ success over 27 hours                |
| Setup cost            | Minimal                                             | Requires identifying and protecting reference files |

## How Roo Code closes the loop with immutable references

Roo Code's architecture enables the immutable reference pattern through its permission system and verification workflow. When you configure file restrictions, Roo Code respects those boundaries while still reading from protected sources to verify its work.

The pattern works because Roo Code closes the loop: it proposes changes, runs tests against the reference implementation, and iterates based on real results rather than assumptions. With BYOK (bring your own key), you control costs directly while running extended autonomous sessions.

**For long autonomous runs, Roo Code can read your legacy codebase as ground truth, generate new code, run verification tests, and iterate on failures - all while being structurally prevented from modifying the source of truth.**

## Why this matters for your workflow

The pattern scales beyond porting projects. Any task where the agent runs for extended periods benefits from an immutable anchor:

- **Migration:** the source codebase is the reference
- **Refactoring:** the test suite is the reference
- **Feature implementation:** the spec document (in a read-only location) is the reference
- **Documentation generation:** the code itself is the reference (treat docs as output, code as canonical)

The key question before any long autonomous run: what can the agent verify against that it cannot change?

If the answer is "nothing," you're relying on the model to stay coherent across thousands of tool calls. That's not a bet that pays off at hour 20.

Give the agent an anchor. Keep the source of truth outside its write permissions.

## Frequently asked questions

### Why do autonomous agents drift during long runs?

Agents drift because they lack external verification. When an agent can modify both its work and its instructions, it optimizes for internal consistency rather than the original goal. Small errors compound across iterations. The agent "solves" problems it created while losing sight of the actual task.

### How do I identify what should be immutable for my project?

Look for the canonical source of behavior in your system. For migrations, it's the source codebase. For refactoring, it's your test suite. For feature work, it's your specification document. The reference should be something that definitively answers "is this correct?" without ambiguity.

### Can Roo Code be configured to respect immutable references?

Yes. Roo Code's permission system allows you to specify which files and directories the agent can read versus write. You can configure the agent to read from your reference codebase for verification while restricting write access to only the output directories. This structural constraint prevents accidental modification of your source of truth.

### What if my legacy codebase has no tests or clear structure?

The pattern requires a trustworthy reference. If your source lacks tests or consistent structure, consider creating a minimal verification layer first. Document the expected behavior of critical routes. Write integration tests for core workflows. The upfront investment in a reliable reference pays off in successful long runs.

### How much does a 27-hour autonomous run actually cost?

The referenced run cost $110 total using BYOK pricing. Actual costs depend on your model choice, token usage, and provider rates. With BYOK, you pay your provider directly with no markup, giving you full control over the cost of extended autonomous sessions.
