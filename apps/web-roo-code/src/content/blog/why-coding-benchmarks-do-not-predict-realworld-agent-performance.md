---
title: Why Coding Benchmarks Do Not Predict Real-World Agent Performance
slug: why-coding-benchmarks-do-not-predict-realworld-agent-performance
description: Coding benchmarks test isolated function generation, not real-world agentic work. Learn why building your own evals produces reliable signal for model selection.
primary_schema:
    - Article
    - FAQPage
tags:
    - ai-coding-agents
    - benchmarks
    - model-evaluation
    - developer-productivity
status: published
publish_date: "2025-06-18"
publish_time_pt: "9:00am"
---

Model scores 87% on HumanEval.

Model cannot navigate your monorepo.

These are not contradictory statements. They describe different tasks.

## What benchmarks actually test

Public coding benchmarks measure a specific skill: can a model write a single file that passes a unit test? The model gets a function signature, writes an implementation, and the harness checks if the output matches expected values.

This is a reasonable test of raw code generation ability. It is not a test of whether the model can help you ship.

> "When we think about coding, we're thinking about using it in real code and it working well. When they think about coding, it's like: can it make a Python script, and then does a function pass? It's just two very different things."
>
> Adam, [Office Hours S01E10](https://www.youtube.com/watch?v=yVf2LalAubc)

Real coding means navigating an existing codebase with years of accumulated decisions. It means interpreting a PRD that references three other documents. It means making changes that do not break the fourteen services that depend on this endpoint.

Benchmarks do not test any of this.

## The gap between benchmark and production

The challenge shows up the moment you hand an agent something real.

> "The challenge is working with existing codebases, or giving a very complex PRD or some sort of technical specification."
>
> Adam, [Office Hours S01E10](https://www.youtube.com/watch?v=yVf2LalAubc)

A benchmark task has clean boundaries. The function signature tells you exactly what to implement. The test tells you exactly what success looks like.

Production tasks have fuzzy boundaries. The spec says "improve performance" without defining acceptable latency. The codebase has three different authentication patterns, and you need to figure out which one applies here. The test suite takes 40 minutes to run, so you cannot iterate quickly.

A model that scores well on benchmarks can still produce changes that break in ways the benchmark never tests: race conditions, incorrect error handling, changes that technically work but violate team conventions.

## What evaluation actually looks like

Teams that want accurate signal build their own evals.

> "A lot of my testing I do and my eval are unfortunately manual... I have 20 complex prompts. I feed them into Roo Code for a model."
>
> Adam, [Office Hours S01E10](https://www.youtube.com/watch?v=yVf2LalAubc)

The process is straightforward: collect prompts that represent real tasks your team faces. Feed them into the agent. Let it run. Score the output against your actual acceptance criteria.

This is more work than checking a leaderboard. It also produces signal you can trust.

The prompts should include:

- Tasks that require understanding existing code, not just generating new code
- Specs with ambiguity that require reasonable interpretation
- Changes that touch multiple files across different parts of the codebase
- Requests that would normally require clarifying questions

Score the outputs on dimensions that matter for your workflow: Did it find the right files? Did it ask clarifying questions when the spec was ambiguous? Did the change follow team conventions? Would you merge this PR?

## The tradeoff

Building your own evals takes time. You need to curate prompts, run repeated tests, and score outputs manually.

The alternative is trusting benchmarks that measure a different task. Teams that make model decisions based on HumanEval scores often discover the gap when they try to use the model on real work.

The investment is upfront. The signal is reliable.

## How Roo Code closes the loop on real-world evaluation

Roo Code lets you test models against your actual codebase, not synthetic benchmarks. With BYOK (bring your own key), you can swap models and run the same complex prompt against different providers to see which one navigates your monorepo, follows your conventions, and produces mergeable PRs.

Because Roo Code closes the loop - proposing diffs, running commands and tests, then iterating based on results - you observe how a model performs across the full task lifecycle, not just the code generation step. This gives you evaluation signal that benchmarks cannot provide: does the model recover when tests fail? Does it ask clarifying questions when specs are ambiguous? Does the final PR match what you would have written?

**Roo Code enables teams to build reliable model evaluations by testing against real tasks in their actual development environment, producing signal that public benchmarks cannot measure.**

## Benchmark vs. real-world evaluation

| Dimension          | Public benchmarks               | Real-world evaluation                   |
| ------------------ | ------------------------------- | --------------------------------------- |
| Task scope         | Single function or file         | Multi-file changes across codebase      |
| Success criteria   | Unit test passes                | PR is mergeable and follows conventions |
| Context required   | Function signature only         | Existing code, specs, team patterns     |
| Iteration tested   | One-shot generation             | Full loop including test runs and fixes |
| Signal reliability | High variance across task types | Directly applicable to your work        |

## Why this matters for your team

For a team evaluating which model to use for agentic coding work, benchmark scores are a starting point, not a decision. The model that tops the leaderboard may not be the model that works well in your codebase with your conventions and your types of tasks.

If you are choosing between models for a team of five shipping to production, you need signal from tasks that look like your tasks. Twenty minutes building a custom eval set produces more reliable information than an hour comparing benchmark tables.

## The shift

The benchmarks that matter are the ones you build yourself.

Start with five prompts that represent real work your team does. Run them against two models. Score the outputs. The differences become obvious when the task is yours.

## Frequently asked questions

### Why do models score high on benchmarks but struggle with real codebases?

Benchmarks test isolated code generation with clear inputs and outputs. Real codebases require understanding existing patterns, navigating dependencies, and making changes that fit team conventions. These are fundamentally different tasks, and benchmark performance does not transfer directly to production work.

### How many prompts do I need for a useful custom eval?

Start with five prompts that represent common tasks your team handles. This is enough to surface meaningful differences between models. You can expand to 15-20 prompts for more comprehensive coverage, but even a small eval set produces better signal than benchmark comparisons.

### Can I use Roo Code to compare different models on my codebase?

Yes. With BYOK, you can configure different model providers and run identical prompts against each one. Because Roo Code closes the loop by running tests and iterating on failures, you see the full picture of how each model handles your specific tasks, not just initial code generation quality.

### What should I score when evaluating model outputs?

Focus on dimensions that affect your workflow: Did the model find the right files to modify? Did it ask clarifying questions when the spec was ambiguous? Does the change follow your team's conventions? Would you merge this PR without significant revisions? These criteria matter more than whether the code technically runs.

### How often should I re-run custom evals?

Re-run evals when you consider switching models or when model providers release significant updates. Quarterly evaluation is reasonable for most teams. Keep your prompt set updated to reflect the types of tasks your team currently handles.
