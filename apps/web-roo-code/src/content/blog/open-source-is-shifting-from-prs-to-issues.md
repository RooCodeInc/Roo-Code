---
title: Open Source Is Shifting from PRs to Issues
slug: open-source-is-shifting-from-prs-to-issues
description: The open source contribution model is reversing. With AI agents that can attempt fixes from issue descriptions, the valuable contribution shifts from writing code to describing problems clearly.
primary_schema:
    - Article
    - FAQPage
tags:
    - open-source
    - ai-agents
    - developer-workflow
    - code-contribution
status: published
publish_date: "2025-08-06"
publish_time_pt: "9:00am"
---

"Open a PR for that."

That used to be the answer. Now it's: "Open an issue."

The contribution model is reversing.

## The old workflow

A community member finds a bug. They fork the repo, write a fix, open a pull request. The maintainer reviews the code, requests changes, the contributor revises. Repeat until merge or abandonment.

This worked when the bottleneck was "who can write the code." The contribution was the implementation itself.

But now agents can attempt the fix. The contribution shifts upstream: describing the problem clearly enough that an agent can take a first pass.

## The new workflow

Contributor opens an issue with a clear description. Agent attempts the fix automatically. Human reviews what the agent produced.

The maintainer's job changes. Instead of reviewing contributor code, they're reviewing agent output. Instead of coaching a contributor through revisions, they're refining the issue description so the next agent attempt lands closer.

> "Hannes used to tell everyone like open a PR, you want to fix that. Now, it's really open an issue, you know, and it's been interesting to see that evolution."
>
> Hannes Rudolph, [Roo Cast S01E04](https://www.youtube.com/watch?v=ily1bY8w2vI)

The feedback loop tightens. A PR that doesn't land still generates information: you now know what not to do.

> "If the PR is not like accurate or it's not valid or something weird then we can go back to the issue and we can go like oh you need to do this instead."
>
> Guest, [Roo Cast S01E04](https://www.youtube.com/watch?v=ily1bY8w2vI)

Even failed attempts become documentation. The agent's wrong approach becomes a constraint for the next attempt.

> "So we have like a base we have some information now on how not to do something. It's easier to tell it now what to do correctly."
>
> Hannes Rudolph, [Roo Cast S01E04](https://www.youtube.com/watch?v=ily1bY8w2vI)

## What this changes for teams

**Contributor onboarding shifts.** You're no longer asking "can this person write code in our stack?" You're asking "can this person describe a problem clearly?" The skill bar moves from implementation to specification.

**Work scoping changes.** Issues become the unit of work, not PRs. A well-written issue is more valuable than a half-working PR because it can be re-attempted. A poorly-written issue wastes agent cycles.

**Review load redistributes.** Maintainers spend less time coaching code style and more time validating correctness. The agent handles the "make it compile" phase; humans handle the "is this the right fix" phase.

## The tradeoff

This workflow assumes you have agents that can attempt fixes from issue descriptions. If your agent can't close the loop (run tests, iterate on failures, produce a reviewable diff), you're still in the old world.

And issue quality matters more than ever. Vague issues produce vague attempts. The investment shifts from "write the code" to "write the specification."

## Why this matters for your team

For a Series A-C engineering team, this changes how you think about external contributions. You're not waiting for someone to write a complete PR. You're inviting problem descriptions and letting agents take first passes.

This also changes internal workflows. Junior engineers can contribute by writing clear issues. The agent attempts the fix; senior engineers review the output. The skill required to participate drops; the skill required to validate stays the same.

If your open-source project still gates contribution at "submit a PR," you're asking contributors to do work an agent could attempt. The contribution model is shifting. Issues are the new PRs.

## How Roo Code closes the loop on issue-to-PR workflows

Roo Code is an AI coding agent that closes the loop: it reads an issue description, proposes diffs, runs commands and tests, and iterates based on the results. This is exactly what enables the shift from PRs to issues as the primary contribution unit.

With BYOK (bring your own key), teams pay their LLM provider directly with no token markup, making it economical to let the agent attempt multiple passes on an issue. Roo Code doesn't just generate code and stop. It executes the code, observes failures, and revises until tests pass or it reaches a clear stopping point that humans can evaluate.

**For teams adopting issue-first contribution models, the agent must be able to run tests and iterate on failures autonomously. Otherwise you're just generating code suggestions that still require human debugging.**

## Contribution models compared

| Dimension                | PR-first model                          | Issue-first model                                      |
| ------------------------ | --------------------------------------- | ------------------------------------------------------ |
| Bottleneck               | Finding contributors who can write code | Finding contributors who can describe problems clearly |
| Contribution unit        | Pull request with working code          | Issue with clear specification                         |
| Maintainer time spent on | Code review and style coaching          | Validating correctness and refining specifications     |
| Failed attempt value     | Usually abandoned                       | Becomes documentation for next agent attempt           |
| Onboarding requirement   | Know the codebase and stack             | Know how to write clear problem descriptions           |

## Frequently asked questions

### What skills do contributors need in an issue-first workflow?

Contributors need to describe problems precisely: what behavior they observed, what behavior they expected, and enough context for an agent to locate the relevant code. Implementation knowledge becomes optional; specification clarity becomes essential.

### How do failed agent attempts help future contributions?

When an agent produces an incorrect fix, maintainers can add that information back to the issue. The failed approach becomes a documented constraint, narrowing the solution space for the next attempt. Each failed PR adds signal about what not to do.

### Does Roo Code support this issue-to-PR workflow?

Yes. Roo Code closes the loop by reading issue descriptions, generating fixes, running tests, and iterating on failures. Because it can execute code and observe results, it produces reviewable diffs rather than suggestions that require human debugging. Teams using BYOK pay their LLM provider directly, making repeated agent attempts cost-effective.

### What happens if the issue description is too vague?

Vague issues produce vague or incorrect agent attempts. The investment that previously went into "write the code" now goes into "write the specification." Teams adopting issue-first workflows often create issue templates that prompt contributors for reproduction steps, expected behavior, and relevant file paths.

### How does review workload change for maintainers?

Maintainers shift from coaching contributors through code style and compilation errors to validating whether the agent's output is the correct fix. The agent handles mechanical correctness; humans handle semantic correctness. This often reduces total review time while increasing the importance of each review decision.
