---
title: When Everyone Can Open a PR, You Need a New Approval Process
slug: when-everyone-can-open-a-pr-you-need-a-new-approval-process
description: How to implement cross-functional approval gates when AI agents enable non-engineers to generate production code. Learn the three-role review process that keeps agent-generated PRs safe.
primary_schema:
    - Article
    - FAQPage
tags:
    - ai-governance
    - code-review
    - team-workflows
    - enterprise-adoption
status: published
publish_date: "2025-10-01"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

"People were pretty scared of what this meant and pretty nervous about what was going to develop."

That's Audrey describing the reaction when Roo Vet rolled out Slack-based agents to the entire company. Not just engineering. Everyone.

## The governance gap

You're an engineering lead at a 50-person company. You've been piloting AI agents with your dev team for three months. The results are promising: faster prototypes, fewer context switches, PRs that actually reference the codebase.

Leadership sees the productivity numbers and asks the obvious question: why limit this to engineering?

So you roll it out company-wide. Marketing can prototype landing pages. Product can test feature ideas. Ops can build internal tools.

Then the PR queue starts filling up with changes from people who have never shipped production code. Some of the diffs look reasonable. Some touch authentication. Some reference files that don't exist. Product and design teams see PRs opened against their domains without any conversation first.

The fear is reasonable. The old flow assumed that anyone opening a PR understood the downstream implications. That assumption breaks when the bar to generate code drops to "type a sentence in Slack."

## The fix: cross-functional approval gates

Roo Vet's solution was explicit governance. Every agent-generated PR now requires sign-off from three roles: a PM, a designer, and an engineer.

> "One thing we had to do is we had to define a pretty good process for managing those. And the way we did it was essentially to have to require an approval from a PM, a designer, and an engineer on any @roomote PR that gets opened."
>
> John Sterns, [Roo Cast S01E11](https://www.youtube.com/watch?v=bqLEMZ1c9Uk&t=1452)

The three-role requirement ensures that:

1. **Engineering** validates the technical correctness and safety
2. **Product** confirms the change aligns with roadmap and priorities
3. **Design** catches UX implications before they ship

To make this sustainable, they added a rotating on-call schedule to monitor the queue. Someone is always responsible for reviewing agent-generated PRs, so they don't pile up or slip through.

## The shift in mental model

The old PR flow assumed alignment before the code existed. Someone has a problem, discusses it, gets buy-in, then writes the code. The PR is a formality at that point.

Agent-generated PRs flip this. The code exists first. The alignment happens at review time.

> "Almost every engineering team I've worked on, the flow has been that someone opens a PR and then everyone is just working to help get that PR over the line... that's just different in this world where we prototype first."
>
> Matt Rubens, [Roo Cast S01E11](https://www.youtube.com/watch?v=bqLEMZ1c9Uk&t=1741)

This means the review process has to do work that used to happen in planning meetings. The PR review is where you ask: should this exist? Does this fit? Who does this affect?

## The tradeoff

Three-role approval adds friction. Every agent-generated PR waits for three people instead of one. That slows the feedback loop.

The alternative is worse. Unreviewed PRs from people who don't understand the codebase lead to incidents. Incidents lead to rollback. Rollback leads to "we tried AI agents and it didn't work."

The friction is intentional. It's the price of keeping the tool enabled for everyone while maintaining quality gates.

## Traditional PR workflow vs. agent-generated PR workflow

| Dimension           | Traditional PR workflow                            | Agent-generated PR workflow                                  |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| Code origin         | Written by someone who discussed the problem first | Generated from a prompt, often without prior discussion      |
| Alignment timing    | Happens before coding begins                       | Happens during code review                                   |
| Reviewer assumption | Author understands downstream implications         | Author may not understand the codebase                       |
| Approval scope      | Usually one technical reviewer                     | Requires cross-functional sign-off (PM, design, engineering) |
| Queue management    | Self-regulating based on team capacity             | Needs explicit on-call rotation to prevent backlog           |

## How Roo Code closes the loop on agent governance

When AI agents can generate production code from a single prompt, governance becomes the bottleneck. Roo Code addresses this by closing the loop between code generation and human oversight. Rather than generating code in isolation, Roo Code proposes diffs, runs tests, and iterates based on results while keeping humans in control of what actually ships.

With BYOK (Bring Your Own Key), teams maintain full control over their AI spending and provider relationships. Combined with configurable approval workflows, engineering leads can define exactly which actions require human sign-off before execution. This means you can enable broad access to AI-assisted development while maintaining the quality gates your organization needs.

The key insight from Roo Vet's rollout applies directly: the friction of approval processes is intentional, and tools that make approval workflows configurable rather than all-or-nothing let organizations find the right balance between speed and safety.

## Why this matters for your organization

If you're considering broad AI agent rollout beyond engineering, you're going to hit this governance question. The answer isn't "don't do it" or "trust everyone." The answer is explicit approval processes designed for the new flow.

Questions to answer before rollout:

- Who can open agent-generated PRs?
- Who must approve them before merge?
- Who monitors the queue to prevent backlog?
- What domains are off-limits without prior discussion?

Define the approval process before you enable the agent. The governance structure you build now determines whether broad rollout builds trust or erodes it.

## Frequently asked questions

### Why do agent-generated PRs need different approval processes than regular PRs?

Agent-generated PRs flip the traditional workflow. In conventional development, alignment happens before code exists through planning discussions and design reviews. With AI agents, working code appears first, often from people unfamiliar with the codebase. The review process must now validate both technical correctness and strategic alignment, work that previously happened in planning meetings.

### How many approvers should be required for agent-generated code?

The three-role model (engineering, product, design) provides comprehensive coverage without excessive overhead. Engineering validates technical safety, product confirms roadmap alignment, and design catches UX implications. Fewer roles create blind spots. More roles create bottlenecks that discourage agent use entirely.

### What happens when the approval queue backs up?

Backlogged queues are the most common failure mode for agent governance. Roo Vet solved this with a rotating on-call schedule where someone is always responsible for reviewing agent-generated PRs. Without explicit ownership, PRs pile up, requesters get frustrated, and teams abandon the process.

### How does Roo Code help teams manage agent-generated code review?

Roo Code closes the loop by keeping humans in control of what ships while still enabling AI-assisted development. With configurable approval workflows, teams can define which actions need sign-off. BYOK ensures organizations maintain control over AI costs and provider relationships. This combination lets teams enable broad access to AI coding assistance while maintaining quality gates.

### Should some parts of the codebase be off-limits to agent-generated PRs?

Yes. Authentication, billing, data access layers, and other sensitive domains often require prior discussion before any code changes. Define these boundaries explicitly before rollout. The alternative is discovering them through incidents, which erodes trust in the entire program.
