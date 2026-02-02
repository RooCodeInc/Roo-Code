---
title: "Issues-First: Slowing Down PRs to Speed Up Shipping"
slug: issuesfirst-slowing-down-prs-to-speed-up-shipping
description: Learn why requiring issues before PRs reduces technical debt and improves codebase organization - a proven approach from the Roo Code team.
primary_schema:
    - Article
    - FAQPage
tags:
    - development-workflow
    - code-review
    - technical-debt
    - team-practices
status: published
publish_date: "2025-05-14"
publish_time_pt: "9:00am"
source: "Office Hours"
---

"LGTM."

Merged.

Three weeks later, nobody can find where the auth logic lives.

## The spaghetti problem

A PR shows up. It looks good. The tests pass. The description is reasonable. You merge it.

Then another one. Same deal. Looks fine. Merge.

Then a third, a fourth, a fifth. Each one makes sense in isolation. Each one passes review. Each one ships.

Six months later, you're staring at a codebase where the business logic is scattered across fourteen files, the naming conventions conflict, and nobody remembers why half of these changes were made in the first place.

This is the "good-looking PR" trap. The problem is not that the code is bad. The problem is that nobody discussed the approach before the code existed.

## The shift: issues before PRs

The Roo Code team made a deliberate change. Issues are now required before PRs get accepted. Every change starts with a written discussion of what the change is, why it matters, and how it fits into the existing architecture.

> "In the last week, we have shifted to an issues first approach where issues are required before we make PRs and where we review these issues on a regular basis."
>
> Hannes Rudolph, [Office Hours S01E06](https://www.youtube.com/watch?v=zPhNXCHJ5xk&t=2858)

The goal is not bureaucracy. The goal is catching misalignment before code exists. A five-minute conversation about approach is cheaper than a two-hour code review that ends with "actually, we should have done this differently."

## Why PRs alone fail

Code review is supposed to catch problems. But by the time a PR exists, the author has already invested hours. The sunk cost is real. Reviewers feel pressure to approve work that technically functions, even when the approach creates future problems.

> "We're doing this as a team to prevent just simply taking on PRs. Oh, there's a good PR. Let's put it in there. And then we end up with a mountain of technical debt, of really a spaghetti codebase."
>
> Hannes Rudolph, [Office Hours S01E06](https://www.youtube.com/watch?v=zPhNXCHJ5xk&t=2876)

The pattern is predictable. A contributor submits a PR. It looks reasonable. The team merges it to avoid blocking progress. Repeat until the codebase is a patchwork of isolated decisions that never had a chance to be coordinated.

## The tradeoff

This approach is not free. Week one feels slower. PRs that would have been merged immediately now wait for issue discussions. Contributors who want to ship quickly hit friction.

But the friction is the feature. The conversation that happens before code exists is where architectural alignment happens. The review of an issue is a review of intent, not implementation. You can redirect approach in ten minutes instead of discovering problems after the code is merged.

> "The technical debt has really gone down. From the days where we were just client work or the code was really messy back in the day, but right now I can say the code is much better organized."
>
> Dan, [Office Hours S01E06](https://www.youtube.com/watch?v=zPhNXCHJ5xk&t=2931)

## Why this matters for your team

For a Series A team shipping with five engineers, every architectural misstep compounds. You do not have the headcount to refactor constantly. You cannot afford to have three people debugging a merge conflict that exists because two PRs made conflicting assumptions about how auth should work.

The issues-first approach forces the conversation to happen at the cheapest possible moment: before anyone writes code. A ten-minute issue review can prevent a week of cleanup.

The math is simple. Slower PR acceptance in week one. Faster iteration in month two. The velocity you lose upfront comes back when your codebase stays reviewable.

## The rule

If a PR shows up without an issue, ask the question: "What are we trying to solve, and why this approach?"

That question is easier to answer before the code exists. Start there.

## How Roo Code enforces issues-first workflows

Roo Code closes the loop between intent and implementation by making the issue discussion part of the agentic workflow. When you use Roo Code with an issues-first approach, the agent can read the issue context, understand the architectural constraints discussed in comments, and generate code that aligns with the agreed-upon approach - not just code that technically works.

**An AI coding agent that closes the loop can propose diffs, run tests, and iterate based on results - but it works best when the intent is already documented in an issue.** This prevents the agent from making isolated decisions that conflict with your team's architectural direction.

With BYOK (Bring Your Own Key), teams control their AI spend while ensuring the agent operates within the boundaries set by issue discussions. The result: faster implementation of agreed-upon approaches, not faster accumulation of technical debt.

## Issues-first vs. PRs-first: a comparison

| Dimension                  | PRs-First Approach                         | Issues-First Approach                 |
| -------------------------- | ------------------------------------------ | ------------------------------------- |
| When alignment happens     | After code is written                      | Before code exists                    |
| Cost of changing direction | Hours of rework                            | Minutes of discussion                 |
| Sunk cost pressure         | High - reviewer feels obligated to approve | Low - no code to defend yet           |
| Documentation of intent    | Often missing or retrofitted               | Built into the workflow               |
| AI agent effectiveness     | Agent makes isolated decisions             | Agent works within documented context |

## Frequently asked questions

### Why not just write better PR descriptions?

PR descriptions explain what was done, not why this approach was chosen over alternatives. By the time the PR exists, the author has already committed to an implementation. Issues capture the decision-making process before that commitment happens, when changing direction is still cheap.

### Does issues-first work with AI coding agents like Roo Code?

Yes. AI coding agents perform better when they have documented context about intent and constraints. When Roo Code reads an issue that specifies the approach, it generates code aligned with that approach rather than making independent architectural decisions. The issue becomes the shared understanding between human reviewers and the AI agent.

### How long should an issue discussion take before starting a PR?

Most issues need ten to fifteen minutes of discussion. Complex architectural changes might need longer. The goal is not exhaustive documentation - it is agreement on approach. If reviewers understand what problem is being solved and why this solution was chosen, the issue has done its job.

### What if a contributor submits a PR without an issue?

Ask them to open an issue first. This is not punishment - it is an opportunity to have the conversation that should have happened before coding started. Often the PR reveals assumptions that need discussion, and the issue becomes a place to resolve those before the code is merged.

### Does this slow down shipping velocity?

In week one, yes. In month two and beyond, no. Teams that adopt issues-first report faster overall velocity because they spend less time on rework, merge conflicts from conflicting assumptions, and debugging architectural problems that could have been prevented with a ten-minute conversation.
