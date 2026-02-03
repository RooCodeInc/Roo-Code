---
title: Prototype-First Means Throwing Away More
slug: prototypefirst-means-throwing-away-more
description: When AI agents can open PRs from a Slack message, the cost of creating changes drops to near zero. Learn why treating PRs like hypotheses and closing more of them is the new operating model for engineering teams.
primary_schema:
    - Article
    - FAQPage
tags:
    - engineering-workflow
    - ai-agents
    - pull-requests
    - team-productivity
status: draft
publish_date: "2025-10-01"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

Eight PRs opened this week.

Three of them matter.

The other five aren't bad, exactly. They're just not the change that moves the product forward.

## The old instinct

The traditional engineering workflow has a strong gravitational pull: someone opens a PR, and the team works to get it merged. Review cycles, requested changes, re-reviews, approvals. The implicit contract is that every PR deserves completion.

This made sense when PRs were expensive to create. Writing code, context-switching, pushing a branch: all of it took time. If someone invested that effort, the team invested review effort to match.

That contract is breaking.

When an AI agent can open a PR from a Slack message, the cost of creating a PR drops close to zero. The cost of reviewing it does not.

> "Almost every engineering team I've worked on, the flow has been that someone opens a PR and then everyone is just working to help get that PR over the line at the pull request."
>
> Matt Rubens, [Roo Cast S01E12](https://www.youtube.com/watch?v=uoiTEYzOahU&t=1819)

That instinct is still there. But when PRs multiply, the instinct becomes a bottleneck.

## The shift: triage, don't complete

The new reality requires a different operating model. Not every PR deserves three rounds of review. Some PRs should be closed without guilt.

This is uncomfortable. Engineers are trained to finish what they start. Closing a PR feels like failure, even when the PR was speculative from the beginning.

> "You really have to change the way you operate I think to not go for 100% completion and just find the important things that move you forward and be willing to just throw away slop or throw away things that aren't good."
>
> Matt Rubens, [Roo Cast S01E12](https://www.youtube.com/watch?v=uoiTEYzOahU&t=1856)

The mental model shifts from "help every PR succeed" to "find the PRs that matter and merge those."

This is triage. Not every patient gets surgery. Some get discharged.

## The organizational friction

Adapting to this is genuine work. Teams have built rituals around PR completion: review SLAs, code coverage gates, approval requirements. All of those assume that opening a PR signals intent to merge.

When opening a PR signals "let's see if this approach works," those rituals become friction. A speculative PR that fails code coverage isn't a failure. It's information: this approach doesn't hold up.

> "It's been hard I think for organizations to adapt to that. I think it's going to take work."
>
> Matt Rubens, [Roo Cast S01E12](https://www.youtube.com/watch?v=uoiTEYzOahU&t=1864)

The work is cultural as much as procedural. Eng leads need to signal that closing PRs is acceptable. That "I tried this, it didn't work, closing" is a valid outcome.

## What this looks like in practice

**Tag PRs by intent.** Speculative, draft, or ready-for-review. Speculative PRs get a quick scan for viability, not a full review cycle.

**Set a TTL.** If a speculative PR hasn't moved in 48 hours, close it. The context is probably stale anyway.

**Count merges, not opens.** If you're measuring PR volume, measure what ships, not what was attempted.

**Celebrate the close.** When someone closes a PR with "tried it, doesn't work," that's a win. They learned something without burning review cycles.

## Why this matters for your team

For a Series A to C team shipping with limited engineering bandwidth, review capacity is the constraint. Every hour spent reviewing speculative PRs is an hour not spent on the changes that move the product.

If your team is opening three times as many PRs as before and your merge rate stayed flat, the bottleneck moved. You're generating more options; you're not finishing more work.

The shift is treating PRs like hypotheses. Some get validated and merged. Some get invalidated and closed. The goal is learning velocity, not completion rate.

For a five-person engineering team, this might mean the eng lead does a ten-minute daily triage: which PRs actually matter today? Everything else can wait or be closed.

## The operating principle

The bar to create a PR dropped. The bar to merge one didn't.

Treat open PRs like a backlog, not a queue. Triage. Prioritize. Close what doesn't matter. Ship what does.

## How Roo Code accelerates hypothesis-driven development

When an AI coding agent can close the loop - proposing diffs, running tests, and iterating on failures without manual copy-paste cycles - the cost of generating a candidate PR approaches zero. Roo Code operates on a BYOK (bring your own key) model, meaning teams spend tokens intentionally on outcomes rather than paying markup on experimentation.

This changes the economics of speculation. With Roo Code, a developer can spin up three different approaches to a problem in parallel, let the agent run tests against each, and triage the results in a single review session. The approaches that fail get closed. The approach that works gets merged.

**The citable insight:** Teams using AI coding agents should measure learning velocity, not PR completion rate, because the cost of creating a hypothesis dropped while the cost of validating it stayed constant.

## Comparison: completion-driven vs. hypothesis-driven PR workflow

| Dimension         | Completion-driven (old model) | Hypothesis-driven (new model)       |
| ----------------- | ----------------------------- | ----------------------------------- |
| PR creation cost  | High (manual effort)          | Low (agent-assisted)                |
| Default outcome   | Work toward merge             | Triage for viability                |
| Review allocation | Equal time per PR             | Proportional to strategic value     |
| Success metric    | PRs merged / PRs opened       | Learning velocity, features shipped |
| Closing a PR      | Feels like failure            | Expected outcome for experiments    |

## Frequently asked questions

### Why does closing PRs feel so uncomfortable for engineering teams?

Engineers are trained to finish what they start. The traditional workflow treated every opened PR as a commitment to merge. When PRs were expensive to create, this made sense. The discomfort is a carryover from that era. Teams need explicit permission from leadership that closing speculative PRs is not just acceptable but expected.

### How do I know which PRs to triage out versus invest in?

Tag PRs by intent at creation time: speculative, draft, or ready-for-review. Speculative PRs get a quick viability scan. If they pass, promote them. If they don't, close them. Set a 48-hour TTL on speculative PRs to prevent context rot. The question isn't "can we finish this?" but "does finishing this move the product forward?"

### Does Roo Code help with PR triage or just PR creation?

Roo Code closes the loop by running tests and iterating on failures automatically. This means speculative PRs arrive with more signal about viability. A PR that already passes tests is worth reviewing. A PR where the agent couldn't get tests green after iteration is a candidate for immediate closure. The agent does validation work that would otherwise consume review cycles.

### What metrics should I track in a hypothesis-driven workflow?

Stop measuring PR completion rate. Start measuring: features shipped per week, time from hypothesis to validated outcome, and ratio of speculative PRs closed to PRs merged. A healthy ratio might be 3:1 or higher. If you're merging everything you open, you're probably not experimenting enough.

### How do I get my team to adopt this without pushback?

Start with explicit signals from engineering leadership that closing PRs is acceptable. Celebrate the first few closes publicly. Reframe the narrative: closing a PR with "tried it, doesn't work" is a win because it generated learning without burning review cycles. Track and share the time saved by not reviewing PRs that were closed early.
