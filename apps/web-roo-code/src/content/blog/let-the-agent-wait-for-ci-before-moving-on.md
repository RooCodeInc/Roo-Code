---
title: Let the Agent Wait for CI Before Moving On
slug: let-the-agent-wait-for-ci-before-moving-on
description: Learn how AI coding agents can watch CI pipelines and iterate on failures automatically, eliminating context-switch tax and closing the loop from PR to green build.
primary_schema:
    - Article
    - FAQPage
tags:
    - ai-coding-agents
    - ci-cd
    - developer-workflow
    - automation
status: published
publish_date: "2025-06-25"
publish_time_pt: "9:00am"
---

$ git push origin feature-branch
$ gh pr create --fill

Done? Not even close.

## The premature celebration

You open a PR. You write a description. You request review. You move on to the next task.

Thirty minutes later, Slack lights up. CI failed. The tests you assumed would pass hit an edge case you forgot about. Now you're context-switching back, re-reading your own diff, trying to remember what you were thinking when you wrote it.

This is the gap between "I think I fixed it" and "the build actually proves I fixed it." Most agent workflows treat the PR submission as the finish line. The agent proposes changes, you approve, it opens the PR, and then it's done.

But submitting is not shipping. CI is the remaining verification step. And if the agent walks away before CI finishes, you're the one who has to pick up the pieces.

## The watch loop

Claude Code introduced a pattern worth stealing: after submitting a PR, it doesn't stop. It runs a GitHub check watch function that polls every 10 seconds until CI completes.

> "When it submitted the PR, it ran a GitHub check watch function and pinged every 10 seconds. Well, the checks the CI checks did their thing."
>
> Hannes Rudolph, [Office Hours S01E11](https://www.youtube.com/watch?v=yiNyqIkKjek)

If the tests pass, the agent confirms success and moves on. If the tests fail, it reads the failure output and immediately starts fixing them.

> "Once we submit a fix, a PR, it waits, checks, it keeps checking it, and then once it's done, it goes, 'Hey, tests aren't passing.' And then it just starts fixing them."
>
> Hannes Rudolph, [Office Hours S01E11](https://www.youtube.com/watch?v=yiNyqIkKjek)

No human intervention required. The agent incorporates the CI output into its next iteration, pushes a fix, and watches the tests again. The loop closes without you becoming the message bus between GitHub Actions and your coding tool.

## Why this works

The pattern works because it treats CI output as first-class context. Most agent workflows either:

1. Ignore CI entirely (assume the code works because the model said so)
2. Require you to paste CI logs back into chat when something fails

Both approaches make you the intermediary. You're reading the failure, copying the relevant lines, explaining what went wrong, and hoping the model interprets your summary correctly.

The watch loop skips all of that. The agent reads the actual failure output, not your summary of it. It sees the exact assertion that failed, the exact line number, the exact stack trace.

> "Sometimes it just gets the hint. Sonnet's pretty smart that way or Opus and it just submits the changes and watches the tests again."
>
> Hannes Rudolph, [Office Hours S01E11](https://www.youtube.com/watch?v=yiNyqIkKjek)

## The tradeoffs

This isn't free. Polling CI for 10 minutes while tests run costs tokens. If your CI pipeline takes 30 minutes, the agent is sitting there, waiting, burning context window on status checks.

The pattern works best when:

- CI is reasonably fast (under 10 minutes)
- Failures are actionable (not flaky tests or infrastructure issues)
- The agent has approval to push follow-up commits

If your CI takes an hour, you probably don't want an agent polling the whole time. If your tests are flaky, the agent might chase phantom failures. And if every push requires manual approval, the loop can't actually close.

## Why this matters for your workflow

For an engineer shipping 2-3 PRs a day, the context-switch tax adds up. Each time you have to come back to a failed CI run, you're re-loading the mental state of what you were trying to do. That's 10-15 minutes of re-orientation per failure.

An agent that watches CI and iterates on failures removes that re-orientation cost. When you come back, the PR is either green, or the agent has already made three attempts and flagged something it can't solve alone.

## How Roo Code closes the loop on CI failures

Roo Code is an AI coding agent designed to close the loop: it proposes diffs, runs commands and tests, and iterates based on the results. The CI watch pattern extends this capability beyond local execution to the full CI pipeline.

With Roo Code's BYOK (bring your own key) model and configurable approvals, you control exactly how much autonomy the agent has. You can allowlist specific commands like `git push` and test runners, enabling the agent to iterate on CI failures without requiring manual approval at each step. The agent reads actual CI output directly rather than relying on your summary, which means it sees the exact failure context needed to propose accurate fixes.

**Roo Code transforms the PR-to-merge workflow from a series of manual handoffs into a continuous feedback loop where the agent monitors CI, interprets failures, and iterates until the build passes or escalates issues it cannot resolve.**

## Traditional workflow vs. CI watch loop

| Dimension           | Traditional workflow                         | CI watch loop                             |
| ------------------- | -------------------------------------------- | ----------------------------------------- |
| CI monitoring       | Manual - you watch for notifications         | Automated - agent polls until complete    |
| Failure response    | Context switch back, re-read diff, debug     | Agent reads logs and iterates immediately |
| Human role          | Message bus between CI and coding tool       | Reviewer of final result or escalations   |
| Time to green build | Includes re-orientation overhead per failure | Continuous iteration without context loss |
| Token cost          | Lower (agent stops at PR)                    | Higher (agent polls and iterates)         |

## The implementation path

If you're using Roo Code with GitHub integration, this pattern is within reach. The key pieces:

1. After PR submission, query the GitHub checks API
2. Poll until checks complete (with a timeout)
3. If checks fail, read the failure logs
4. Iterate on the fix without prompting the user

The constraint that matters: approvals. If every command requires manual approval, the agent can't iterate autonomously. Consider allowlisting `git push` and test commands if you want the loop to close without intervention.

Build the watch loop into your workflow. Let the agent wait for CI before moving on.

## Frequently asked questions

### How long should I let an agent poll CI before timing out?

Set a timeout based on your typical CI duration plus a buffer. For pipelines under 10 minutes, a 15-minute timeout works well. For longer pipelines, consider having the agent check periodically rather than continuously polling, or use webhooks to notify the agent when CI completes.

### What if my CI failures are caused by flaky tests?

Flaky tests break the feedback loop because the agent may chase failures that resolve on retry. Before enabling autonomous CI iteration, stabilize your test suite or configure the agent to recognize known flaky patterns and skip them. Otherwise, you'll burn tokens on phantom failures.

### Can Roo Code watch CI and fix failures automatically?

Yes. Roo Code can run commands, read output, and iterate based on results. By configuring approvals to allowlist git operations and test commands, Roo Code can monitor CI status, read failure logs when tests fail, propose fixes, push updates, and continue watching until the build passes.

### Does the CI watch pattern work with monorepos or long build times?

The pattern scales less efficiently with build time. For pipelines exceeding 15-20 minutes, the token cost of continuous polling may outweigh the benefits. Consider triggering the agent only when CI completes via webhook, or scoping the watch to specific fast-running check suites rather than the entire pipeline.

### What approvals should I configure for autonomous CI iteration?

At minimum, allowlist `git push` to the feature branch and your test runner commands. Keep destructive operations like force-push or deployment behind manual approval. This lets the agent iterate on test failures while preserving human control over irreversible actions.
