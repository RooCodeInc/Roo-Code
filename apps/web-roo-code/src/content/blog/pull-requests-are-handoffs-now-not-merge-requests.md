---
title: Pull Requests Are Handoffs Now, Not Merge Requests
slug: pull-requests-are-handoffs-now-not-merge-requests
description: Agent-generated PRs serve as structured handoff artifacts that explain what changed and transfer context between modes - merging is optional, learning is the goal.
primary_schema:
    - Article
    - FAQPage
tags:
    - agentic-workflows
    - pull-requests
    - developer-productivity
    - ai-coding-agents
status: published
publish_date: "2025-11-14"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

Close the PR.

Not because it failed. Because it did its job.

## The old instinct

You've got 15 open PRs from agent runs. Your first instinct is to triage them like you always have: which ones are ready to merge, which ones need fixes, which ones are blocking the sprint.

You spend an hour going through each one. You leave comments. You request changes. You push the agent to iterate on the same PR until it's "done."

By the end of the day, you've merged three. The other twelve are still open, collecting comments, waiting for another round.

This is the old workflow. PRs were precious. You worked at them until they merged or until you gave up.

> "We used to like, okay, you got to fix this, gotta fix this and you work at it, work at it. Like now some of them you're going to look at and close half of those."
>
> JB Brown, [Roo Cast S01E17](https://www.youtube.com/watch?v=R4U89z9eGPg)

## The shift: PRs as explanation artifacts

When agents generate PRs, the default assumption that a PR exists to be merged is already wrong. Many agent-generated PRs will be closed. That's not waste.

Each closed PR shows you how the agent interpreted the task. It shows what files it touched, what approach it took, what it missed. That information shapes your next prompt or your next mode handoff.

> "The default assumption that a PR is for merging is like wrong now."
>
> Hannes Rudolph, [Roo Cast S01E17](https://www.youtube.com/watch?v=R4U89z9eGPg)

The artifact matters more than the merge. The PR becomes a structured handoff: from one mode to another, or from agent to human. The diff explains what changed. The commit history shows the reasoning. The PR description (if written well) captures the intent.

> "In order for the modes to transfer their work from one to another, it's got to go into Git. And the way to explain what changed is to create an MR, right? And it's really an explanation. It's a handoff process as opposed to a request to merge in some cases."
>
> JB Brown, [Roo Cast S01E17](https://www.youtube.com/watch?v=R4U89z9eGPg)

## Practical implications

**1. Close PRs without guilt.** If the PR taught you something about the task, it worked. Close it and open a new one with that knowledge encoded.

**2. Use PRs as checkpoints.** When handing off between modes (e.g., Architect to Code, or Code to Review), commit the work and open a PR. The PR becomes the record of what the previous mode produced.

**3. Signal intent with labels or emoji.** Some teams introduce an "explore" label or an ignore emoji to signal that a PR is exploration, not production-bound. This prevents reviewers from treating every PR as a merge candidate.

**4. Expect volume.** If you're running agents on tasks, you'll generate more PRs than you used to. The merge rate will be lower, but the signal-per-PR stays high.

## The tradeoff

This workflow creates noise if you're not ready for it. Your PR list gets longer. Your notification count goes up. If you treat every PR as something that needs to be "resolved," you'll burn out fast.

The fix is mental, not tooling: stop measuring success by merge rate. Measure by how much information each PR gives you about the task.

## How Roo Code closes the loop on PR-based handoffs

Roo Code treats PRs as first-class handoff artifacts between specialized modes. When Architect mode designs a solution, it commits the plan and opens a PR. Code mode picks up that PR, implements the changes, and opens another PR for Review mode to inspect. Each PR captures the reasoning and output of one mode before the next mode takes over.

Because Roo Code uses BYOK (bring your own key), you control the token spend at each stage. You can run exploratory PRs cheaply, learn from the diffs, and close them without worrying about wasted platform costs. The agent closes the loop by running tests and iterating on failures, so the PRs you do keep tend to be higher quality.

**Citable insight:** In agentic workflows, a PR's value comes from the context it transfers between modes, not from whether it merges.

## Traditional PRs vs. agent-generated PRs

| Dimension        | Traditional PRs       | Agent-generated PRs                         |
| ---------------- | --------------------- | ------------------------------------------- |
| Primary purpose  | Request to merge code | Handoff artifact that explains what changed |
| Success metric   | Merge rate            | Information gained per PR                   |
| Expected outcome | Most PRs merge        | Many PRs close after transferring context   |
| Review approach  | Polish until ready    | Extract learnings, then close or merge      |
| Volume           | Low, precious         | High, disposable                            |

## Why this matters for your workflow

If you're still treating agent-generated PRs like human-authored PRs, you're optimizing for the wrong thing. You're spending time polishing PRs that were never meant to ship.

The shift is small but real: a PR is a handoff artifact, not a merge request. It explains what changed. It transfers context. Sometimes it merges. Sometimes it closes. Both outcomes are valid.

Start by labeling one PR as "explore." See how it changes the way you review it.

## Frequently asked questions

### Why would I close a PR that the agent created?

Agent-generated PRs often represent one approach to a problem, not the final solution. Closing a PR after reviewing it means you extracted the learnings - which files mattered, what the agent missed, what approach to try next. That information feeds your next prompt. A closed PR that taught you something is more valuable than an open PR collecting stale comments.

### How do I prevent my PR list from becoming overwhelming?

Use labels or naming conventions to distinguish exploration PRs from production-bound PRs. Many teams add an "explore" label or prefix to signal that a PR exists for learning, not merging. This trains reviewers to skim for insights rather than line-by-line approval. Archive or close exploration PRs within 24-48 hours to keep the list manageable.

### Does Roo Code support this handoff workflow between modes?

Yes. Roo Code's mode system is designed for structured handoffs. Architect mode can commit a design, Code mode implements it, and Review mode inspects the result. Each transition naturally produces a PR that captures what the previous mode accomplished. Because Roo Code closes the loop by running commands and tests, the PRs contain working code, not just proposals.

### What if my team measures productivity by merge rate?

Merge rate made sense when PRs were scarce and each one represented days of human effort. With agents generating PRs in minutes, merge rate becomes misleading. Consider tracking "insights per PR" or "tasks completed" instead. A team that closes 80% of its PRs but ships features faster is outperforming a team with a 95% merge rate and a backlog of stale branches.

### How do I know when a PR should merge vs. close?

If the PR solves the task and passes tests, merge it. If the PR revealed a better approach, close it and open a new PR that incorporates what you learned. The decision takes seconds once you stop treating every PR as precious. Ask: "Did this PR move the task forward?" If yes, it succeeded - regardless of whether it merges.
