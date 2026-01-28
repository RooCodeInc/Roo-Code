---
title: "PRDs Are Becoming Artifacts of the Past"
slug: prds-are-becoming-artifacts-of-the-past
description: "The velocity of AI change has outpaced the traditional PRD's shelf life. Teams are shifting to prototype-first workflows where documentation emerges from shipped work rather than preceding it."
tags:
    - product-management
    - ai-workflows
    - engineering-velocity
status: published
publish_date: 2026-01-12
publish_time_pt: 9:00am
---

Forty-seven pages. Three months of stakeholder reviews. One product requirements document.

By the time it shipped, the model it described was two generations behind.

## The document that ages out

You've seen this loop. A PM spends weeks gathering requirements, aligning stakeholders, formatting sections. The PRD becomes a ceremony: cover page, executive summary, user stories, acceptance criteria, and fourteen appendices.

Then Claude 4 ships. Or the API you were planning around deprecates. Or your team discovers a workflow that makes half the document irrelevant.

The PRD that was perfect in January is not perfect in February.

This is what Paige Bailey observed at Google: teams are abandoning the rigorous PRD process not because they've gotten sloppy, but because the velocity of change has outpaced the document's shelf life.

> "Now things are moving so fast that even if you had a PRD that was perfect as of January, it would not be perfect as of February."
>
> Paige Bailey, [Office Hours S01E15](https://www.youtube.com/watch?v=sAFQIqmDFL4)

## The shift: prototypes as specification

The replacement is not "no documentation." The replacement is documentation that emerges from working software.

Instead of writing a spec and then building, teams build something small and iterate against real feedback. The prototype becomes the specification. The commit history becomes the decision log. The PR comments become the rationale.

> "For software, it's much more effective to get something out and keep iterating on it really really quickly."
>
> Paige Bailey, [Office Hours S01E15](https://www.youtube.com/watch?v=sAFQIqmDFL4)

This works because AI tooling has compressed the cost of producing working code. When you can generate a functional prototype in an afternoon, the economics of "plan first, build second" flip. The sunk cost of writing a detailed PRD becomes harder to justify when you could have shipped the first version instead.

## The tradeoff is real

Abandoning upfront planning does not mean abandoning coordination. Teams still need to align on scope, surface constraints, and communicate with stakeholders.

The difference is when that alignment happens. Waterfall-style PRDs front-load alignment before any code exists. Prototype-first workflows back-load alignment: you ship something, learn what breaks, and document the decisions retrospectively.

This approach has failure modes:

**Scope creep without anchors.** If there's no initial constraint document, the prototype can drift in directions that no stakeholder wanted.

**Lost rationale.** If you don't capture why decisions were made, you lose institutional memory. This matters when teammates leave or when you need to revisit a choice six months later.

**Stakeholder whiplash.** Executives who expect a polished plan before greenlighting work may not trust a "we'll figure it out as we build" pitch.

The mitigation is lightweight decision records: ADRs, RFC-style docs, or even structured commit messages that capture the why, not just the what. The goal is not zero documentation. The goal is documentation that emerges from shipped work rather than preceding it.

## Why this matters for your team

For a Series A team with five engineers, a three-week PRD cycle is a significant tax. That's three weeks where no code ships while stakeholders negotiate requirements that will change anyway.

If your team is shipping 8-10 PRs a week, the prototype-first model lets you compress the feedback loop. Instead of aligning on a document and then discovering problems in production, you discover problems in the prototype and align on fixes that already work.

The compounding effect: teams that treat prototypes as the specification ship more iterations per quarter. Teams that cling to waterfall-style documentation lose velocity to teams that iterate against real user feedback.

> "I also feel like we don't have nearly as rigorous of a process around PRDs. Like PRDs kind of feel like an artifact of the past."
>
> Paige Bailey, [Office Hours S01E15](https://www.youtube.com/watch?v=sAFQIqmDFL4)

## The decision

The question is not "should we have documentation?" The question is "when does documentation happen?"

If your PRDs take longer to write than your prototypes take to ship, the economics have flipped. Start with a working prototype. Capture decisions as you make them. Align stakeholders around something they can touch, not something they have to imagine.

The artifact that matters is the diff, not the document.
