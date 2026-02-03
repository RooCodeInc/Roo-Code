---
title: Without Evals You Cannot Iterate on Prompts
slug: without-evals-you-cannot-iterate-on-prompts
description: Why LLM evals are the foundation for prompt iteration - how to escape the trap of fixing one edge case while breaking two others, with practical steps to build regression detection into your workflow.
primary_schema:
    - Article
    - FAQPage
tags:
    - evals
    - prompt-engineering
    - ai-coding-agents
    - developer-workflow
status: draft
publish_date: "2025-04-30"
publish_time_pt: "9:00am"
source: "Office Hours"
---

Three prompts.

One edge case fixed.

Two new edge cases broken.

## The trap

You ship an LLM-powered prototype in a day. It works. The demo lands. Someone asks you to handle a new edge case.

You tweak the prompt. The edge case is fixed. You push to staging.

Then another edge case breaks. You tweak the prompt again. Now the first edge case is broken again. You have no ground truth. You cannot tell if the prompt is getting better or if your expectations just shifted.

This is the iteration trap. Without evals, you are navigating without a map. Every change feels like progress until you realize you have been walking in circles.

## Why gut-checking fails

For narrow tasks, you can spot-check outputs and trust your intuition. Coding agents are not narrow. The domain is too broad: refactoring, debugging, test generation, documentation, code review. Each task has different failure modes. Each failure mode has edge cases you will not think to check manually.

The problem compounds when you are iterating daily. You fix something, ship it, and move on. A week later, you cannot remember what "good" looked like. Your baseline has drifted.

> "There was a while where everyone was getting gas-lit by LLMs when an update would secretly come out and people are like 'this is garbage, was it ever good?' or did I just... my expectations shifted so much."
>
> David Leen, [Office Hours S01E04](https://www.youtube.com/watch?v=ZnKkwWuQ9QQ&t=1749)

You end up gas-lit by your own model. The output feels worse, but you cannot prove it. Or it feels better, but you cannot replicate it.

## The center of everything

Evals are not a nice-to-have for mature teams. They are the foundation for any iteration at all.

The pattern is simple: define a set of inputs, define expected outputs, run the model, compare results. When you tweak a prompt, you run the eval suite. If the score goes up, you are moving forward. If the score goes down, you caught a regression before it hit production.

> "You can build a prototype using LLMs amazingly fast... But when you try iterate on it, try changing the prompt or you're seeing that there's an edge case that it's failing horribly on and you tweak the prompt and now some other edge case pops up and the LLM starts failing at that. Evals are at the center of everything."
>
> David Leen, [Office Hours S01E04](https://www.youtube.com/watch?v=ZnKkwWuQ9QQ&t=1681)

The key insight: evals are not about proving your model is good. They are about knowing when your model gets worse. Regression detection is the unlock.

## Domain-specific benchmarks

Generic evals will not save you. A coding agent that scores well on HumanEval might still fail on your monorepo with its custom build system and legacy patterns.

The evals that matter are the ones built from your actual edge cases. Every time you find a failure, you add it to the suite. Over time, the suite becomes a map of every trap the model can fall into.

> "Giving general guidance is incredibly hard and to solve the problem I think you need a set of evals and a set of benchmarks for domain-specific use cases."
>
> David Leen, [Office Hours S01E04](https://www.youtube.com/watch?v=ZnKkwWuQ9QQ&t=1768)

This is work. It is slower than just tweaking prompts and hoping. But it is the difference between iterating and wandering.

## Old approach vs. eval-driven development

| Dimension            | Without Evals                         | With Evals                                       |
| -------------------- | ------------------------------------- | ------------------------------------------------ |
| Feedback loop        | Manual spot-checking, intuition-based | Automated regression detection on every change   |
| Baseline drift       | No record of what "good" looked like  | Persistent ground truth you can measure against  |
| Edge case handling   | Fix one, break two unknowingly        | Fix one, immediately see if others regressed     |
| Team velocity        | Slows over time as changes feel risky | Accelerates because you can ship with confidence |
| Institutional memory | Lost when people leave or forget      | Encoded in the eval suite permanently            |

## How Roo Code closes the loop on prompt iteration

Roo Code is an AI coding agent that closes the loop: it proposes diffs, runs commands and tests, and iterates based on results. This architecture directly supports eval-driven development. When you configure Roo Code with BYOK (bring your own key), you maintain full control over which models run your evals and at what cost.

The agent can execute your eval suite after each prompt change, surface regressions immediately, and iterate on fixes without manual intervention. Instead of guessing whether a prompt tweak helped or hurt, you get concrete feedback from your domain-specific test cases.

**For teams building with coding agents, evals are not optional - they are the foundation that makes confident iteration possible.**

## Why this matters for your team

For a Series A - C team with three engineers, the iteration trap is especially dangerous. You do not have the bandwidth to manually QA every prompt change. You do not have institutional memory to remember what "good" looked like six months ago.

Without evals, every prompt tweak is a coin flip. With evals, you can confidently ship changes knowing you have not broken the cases that matter.

The compounding effect: teams with evals iterate faster because they can move without fear. Teams without evals slow down over time because every change feels risky.

## Start here

If you have no evals today, start with three test cases: one happy path, one known edge case, one previous failure. Run them before and after every prompt change. Expand the suite as you find new failures.

The goal is not perfection. The goal is a baseline you can measure against. Everything else follows from that.

## Frequently asked questions

### What is the minimum eval suite to start with?

Start with three test cases: one happy path that covers core functionality, one known edge case from real usage, and one previous failure you have already fixed. This gives you immediate regression detection without requiring weeks of setup. Expand the suite incrementally as you discover new failure modes.

### How do I know if my evals are testing the right things?

Your evals should come from real failures, not hypothetical scenarios. Every time you find a bug or edge case in production, add it to the suite. Over time, the suite becomes a comprehensive map of every trap your model can fall into. If you are adding test cases that never fail, they are not providing signal.

### Can Roo Code help automate eval execution?

Yes. Roo Code closes the loop by running commands and tests automatically. You can configure it to execute your eval suite after prompt changes, surface regressions immediately, and iterate on fixes. With BYOK, you control which models run your evals and manage costs directly with your API provider.

### How do evals differ from traditional unit tests?

Traditional unit tests check deterministic code paths. LLM evals check probabilistic outputs against expected patterns or quality thresholds. You need tolerance for variation while still catching meaningful regressions. The structure is similar - inputs, expected outputs, comparison - but the scoring may involve fuzzy matching, semantic similarity, or rubric-based grading.

### What if my team does not have time to build an eval suite?

You do not have time not to. Without evals, every prompt change is a gamble that costs more time in debugging and rollbacks than building the suite would have cost. Start with three test cases today. The investment compounds: teams with evals iterate faster because they can ship without fear.
