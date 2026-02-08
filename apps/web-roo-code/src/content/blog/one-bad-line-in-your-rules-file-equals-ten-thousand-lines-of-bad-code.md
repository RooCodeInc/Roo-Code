---
title: One Bad Line in Your Rules File Equals Ten Thousand Lines of Bad Code
slug: one-bad-line-in-your-rules-file-equals-ten-thousand-lines-of-bad-code
description: Why agent configuration errors multiply across every task and how to allocate review effort proportionally to blast radius, not lines changed.
primary_schema:
    - Article
    - FAQPage
tags:
    - agent-configuration
    - rules-files
    - code-review
    - agentic-workflows
status: draft
publish_date: "2025-10-08"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

A bug is just a bug.

A bad rule is ten thousand bugs.

## The multiplication problem

You find a typo in your codebase. You fix it. One line changed, one line fixed. The blast radius is contained.

Now imagine the same typo in your agent's rules file. That typo shapes every prompt the agent receives. Every task it runs. Every diff it generates. That single incorrect line doesn't produce one bug - it produces a pattern of bugs across every file the agent touches.

This is the error multiplication hierarchy:

- One bad line of code: one bug
- One bad line in a spec: a hundred bugs (every implementation follows the wrong spec)
- One bad line in your rules file: ten thousand lines of bad code

The agent doesn't know the rule is wrong. It follows the rule faithfully, which is exactly what makes it dangerous.

> "A line of incorrect code is just a line of bad code. A line in a spec, like an incorrect line in a spec is like a hundred or a thousand lines of bad code... an incorrect line in a rule or like an agent file or something like that is maybe 10,000 lines of bad code."
>
> Hannes Rudolph, [Roo Cast S01E13](https://www.youtube.com/watch?v=fFUxIKH-t7o&t=2577)

## Where your review effort should go

Most teams allocate review effort uniformly. Every PR gets the same scrutiny. But error multiplication means some changes deserve disproportionate attention.

A PR that changes application code? Standard review. The blast radius is limited to what that code touches.

A PR that changes your agent configuration, your rules file, your system prompts? That change affects every task the agent runs from that point forward. The blast radius is your entire codebase.

> "Something that's going to come out of the init command or that you're putting into rules, I think that's where more review should be gone into, right? Like so if you got a PR that's changing your core rules or your structure, I think it's pretty critical."
>
> Elliot, [Roo Cast S01E13](https://www.youtube.com/watch?v=fFUxIKH-t7o&t=2607)

The practical implication: treat rules file changes like infrastructure changes. More eyes. More scrutiny. Slower merge velocity is acceptable because the cost of a bad merge is so much higher.

## The tradeoff

Tighter review on rules files means slower iteration on agent behavior. You can't just tweak a prompt and ship it. Someone else needs to look at it first.

This feels like friction when you're trying to move fast. But the alternative is discovering three weeks later that the agent has been following a subtly wrong instruction across dozens of tasks, and now you're debugging a pattern of failures instead of a single bug.

The friction is the feature. It forces you to think about what you're encoding as policy before it compounds.

## What to watch for

Rules file errors aren't always obvious. They're often:

- **Ambiguous instructions** the agent interprets consistently but incorrectly
- **Missing constraints** that let the agent drift into unwanted behavior
- **Conflicting rules** where the agent picks one interpretation and sticks with it
- **Outdated assumptions** about your codebase structure or conventions

The symptom is usually not "the agent crashed." The symptom is "the agent kept doing something slightly wrong, and we didn't notice until the pattern was everywhere."

## Why this matters for your workflow

If you're using rules files or agent configurations, you already have a leverage point that affects every task. The question is whether you're treating it with appropriate weight.

For a team running 20 agent tasks a week, a bad rule doesn't just affect one task. It affects 20. Then 40. Then 100. By the time someone notices the pattern, the cleanup is substantial.

The review cost of catching a bad rule before it merges is minutes. The cleanup cost after it's been running for a month is hours or days.

## How Roo Code closes the loop on configuration errors

Roo Code's architecture surfaces configuration mistakes faster than traditional AI coding tools because it closes the loop: the agent proposes changes, runs tests, and iterates based on actual results. When a rules file contains a bad instruction, you see the pattern emerge in real diffs rather than discovering it weeks later in production.

With BYOK (bring your own key), you control both the model and the rules that govern it. This means your team owns the full configuration stack and can establish review gates at every layer - from API keys to system prompts to project-specific rules files.

**The principle that separates effective agent teams from struggling ones: review effort should be proportional to error multiplication, not to lines changed.**

## Old approach vs. new approach

| Dimension          | Old approach (uniform review)   | New approach (proportional review)  |
| ------------------ | ------------------------------- | ----------------------------------- |
| Review allocation  | Same scrutiny for all PRs       | Weight review by blast radius       |
| Rules file changes | Treated like any other code     | Treated like infrastructure changes |
| Merge velocity     | Consistent across change types  | Slower for high-leverage configs    |
| Error discovery    | Weeks later, pattern everywhere | Earlier, contained to fewer tasks   |
| Cleanup cost       | Hours or days of debugging      | Minutes of pre-merge review         |

## The shift

Audit your current review process. If rules file changes get the same scrutiny as application code changes, you're underweighting the leverage point.

The principle: review effort should be proportional to error multiplication, not to lines changed.

One line in a rules file is not one line of risk. It's ten thousand.

## Frequently asked questions

### What counts as a "rules file" for AI coding agents?

Rules files include any configuration that shapes agent behavior across multiple tasks: system prompts, custom instructions, `.roo` files, mode configurations, and project-level agent settings. Any file that tells the agent how to behave globally rather than for a single task falls into this category.

### How do I know if a rules file error is causing my issues?

Look for patterns rather than isolated bugs. If you're seeing the same type of mistake across multiple files or multiple tasks - consistent formatting errors, repeated architectural decisions you didn't intend, or the same bad assumption appearing everywhere - the source is likely upstream in your configuration rather than in individual code changes.

### Does Roo Code help prevent rules file errors?

Roo Code's close-the-loop workflow surfaces configuration problems faster because you see the agent's interpretation immediately in proposed diffs. When you run a task and review the output, bad rules manifest as patterns in the generated code. The approval step before any changes are applied gives you a checkpoint to catch configuration drift before it compounds.

### Should I version control my agent configuration files?

Yes. Treat rules files like infrastructure-as-code. Version control enables PR-based review, rollback when patterns emerge, and audit trails showing what changed when. If you can't explain why your agent started behaving differently, the answer is often in your configuration commit history.

### How much review is enough for rules file changes?

At minimum, require a second pair of eyes for any change to agent configuration. For teams with high task volume, consider requiring sign-off from someone who understands both the codebase conventions and the agent's behavior patterns. The review cost is minutes; the cost of a bad rule running for a month is substantially higher.
