---
title: Broad Modes Fail Because Your Codebase Is Not Standard
slug: broad-modes-fail-because-your-codebase-is-not-standard
description: Generic AI coding modes optimize for broad applicability but fail on your specific codebase patterns. Learn why narrowing scope increases accuracy and how to tune modes to your conventions.
primary_schema:
    - Article
    - FAQPage
tags:
    - modes
    - customization
    - workflow
    - best-practices
status: published
publish_date: "2025-06-25"
publish_time_pt: "9:00am"
source: "Office Hours"
---

The mode worked in the demo. It fails on your repo.

You grabbed the "best" issue fixer mode from the community. It had good reviews. The author clearly knew what they were doing. And now it's suggesting changes that violate three of your team's conventions and ignore a helper function that exists in every file.

## The specificity problem

Generic modes optimize for broad applicability. That's the point: reach as many codebases as possible. The tradeoff is that the broader the instructions, the less accurate they become for any specific project.

Your codebase has patterns. Some of them are documented. Most of them live in your head: the reason you use that particular error handling approach, the naming convention for test files, the way authentication flows through the middleware stack.

> "A large part of the context of a codebase is actually in our heads. Something we don't write down. Certain behaviors, certain patterns that aren't always that apparent to AI the way we have it set up right now."
>
> Hannes Rudolph, [Office Hours S01E11](https://www.youtube.com/watch?v=yiNyqIkKjek)

The mode author didn't have access to that context. They built something that works for a general case. Your codebase is not the general case.

## The accuracy inversion

Here's what's counterintuitive: narrowing a mode's scope increases its accuracy.

A mode that knows "use our custom logger, not console.log" will catch that every time. A generic mode will suggest console.log because that's what most codebases use. Neither is wrong in the abstract. One is wrong for your repo.

> "When we write modes, often they apply somewhat narrowly to how we're using them. And the broader we make them, I find often the less accurate they are."
>
> Hannes Rudolph, [Office Hours S01E11](https://www.youtube.com/watch?v=yiNyqIkKjek)

The instinct to grab the most popular, most general tool is understandable. It feels safer. But generality is a liability when your patterns diverge from the assumptions baked into the mode's instructions.

## Your code is not standard

This is the uncomfortable part: your codebase has patterns that are not standard. They might be objectively better. They might be legacy debt. They might just be different.

> "Your code and the way you have built it are not always standard. They might be better, they might be worse, they might just be different."
>
> Hannes Rudolph, [Office Hours S01E11](https://www.youtube.com/watch?v=yiNyqIkKjek)

The AI doesn't know which. It only knows what you tell it. A mode tuned to your conventions carries that context. A generic mode guesses based on what worked elsewhere.

## The tuning investment

Teams that tune modes to their own conventions see a major jump in agent effectiveness. The investment is upfront: document your patterns, encode them into mode instructions, test against real issues from your backlog.

The payoff is downstream: the agent stops suggesting changes you have to reject. It starts proposing diffs that actually match how your team writes code.

This isn't about making the AI "smarter." It's about reducing the gap between what the AI assumes and what your codebase actually does.

## Why this matters for your workflow

If you're reviewing AI suggestions and rejecting half of them because they violate your conventions, the mode is too broad. Every rejected suggestion is time spent explaining why it's wrong instead of shipping.

For an engineer reviewing 5-10 AI-generated changes per day, cutting the rejection rate in half means reclaiming 30-60 minutes of context-switching. The math compounds across a team.

The question isn't "which mode is best?" It's "which mode knows my codebase?"

## How Roo Code closes the loop on codebase-specific patterns

Roo Code's custom modes system lets you encode your team's conventions directly into agent behavior. Rather than accepting generic suggestions and manually correcting them, you configure modes that understand your patterns from the start.

With BYOK (Bring Your Own Key), you control the AI provider while Roo Code handles the orchestration. Custom modes act as persistent context - they remember your logging conventions, your error handling patterns, and your file structure expectations across every task.

**Roo Code custom modes reduce the gap between AI assumptions and codebase reality by encoding team conventions into reusable, shareable configurations that persist across sessions.**

The agent proposes diffs, runs tests, and iterates based on results - all while respecting the constraints you've defined. When a mode knows your patterns, the approval step becomes verification rather than correction.

## Generic modes vs. codebase-tuned modes

| Dimension            | Generic mode                       | Codebase-tuned mode               |
| -------------------- | ---------------------------------- | --------------------------------- |
| Convention awareness | Assumes standard patterns          | Encodes your specific patterns    |
| Suggestion accuracy  | High rejection rate                | Matches team expectations         |
| Review time          | Spent correcting violations        | Spent verifying correctness       |
| Maintenance          | None, but constant corrections     | Upfront tuning, downstream payoff |
| Team scalability     | Each engineer corrects same issues | Shared modes propagate standards  |

## The first step

Audit the last ten suggestions your agent made that you rejected. Look for patterns: repeated convention violations, ignored helper functions, wrong error handling approach.

Those patterns are the instructions your mode is missing. Add them. Narrow the scope. Watch the accuracy jump.

## Frequently asked questions

### Why do popular modes fail on my codebase?

Popular modes optimize for the broadest possible applicability. They assume standard patterns that work across many repositories. Your codebase has specific conventions - custom loggers, unique file structures, particular error handling approaches - that generic modes cannot anticipate. The more your patterns diverge from common practices, the more a generic mode will suggest incorrect changes.

### How specific should my custom modes be?

Start with the patterns that cause the most rejected suggestions. If you're consistently correcting the same convention violations, those belong in your mode instructions. The goal is not exhaustive documentation but capturing the patterns that differ from what the AI assumes by default. A mode that handles your top five convention issues will outperform a generic mode immediately.

### How do I create custom modes in Roo Code?

Roo Code allows you to define custom modes with specific instructions, file restrictions, and tool permissions. You can encode your team's conventions - naming patterns, preferred utilities, error handling approaches - directly into mode configuration. These modes persist across sessions and can be shared with your team through version-controlled configuration files.

### Does narrowing mode scope limit what the AI can do?

Narrowing scope increases accuracy within that scope. A mode tuned for your test file conventions will generate better test suggestions than a generic mode. You can maintain multiple specialized modes for different tasks rather than relying on one broad mode that handles everything poorly. Specificity is a feature, not a constraint.

### How much time does tuning modes actually save?

For an engineer reviewing 5-10 AI suggestions daily, reducing the rejection rate by half reclaims 30-60 minutes of context-switching per day. The upfront investment in mode tuning - typically a few hours to document key conventions - pays back within the first week of use. The savings compound when modes are shared across a team and each engineer stops correcting the same issues independently.
