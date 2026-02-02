---
title: Local Models Work for Edits, Not for Oneshots
slug: local-models-work-for-edits-not-for-oneshots
description: Learn why local AI models excel at scoped code edits but fail at greenfield generation, and how to build a hybrid workflow that balances privacy requirements with agentic coding capability.
primary_schema:
    - Article
    - FAQPage
tags:
    - local-models
    - agentic-coding
    - model-selection
    - enterprise-privacy
status: published
publish_date: "2025-04-09"
publish_time_pt: "9:00am"
---

"Add a method to this class."

Works.

"Generate a complete application."

Doesn't work.

That's the line between local and hosted models for agentic coding.

## The scope trap

You've got a 32B parameter model running on your M3 Max. The inference is free. The privacy story is clean. Your security team is happy.

You point it at a well-structured codebase and ask it to add a test for an existing function. It reads the file, sees the patterns, writes a test that matches the style. You merge it.

Then you ask it to scaffold a new feature from scratch. A complete auth flow with OAuth, session management, and token refresh. The model starts generating. It hallucinates imports. It references files that don't exist. It loses track of its own output halfway through.

You've hit the scope trap. The same model that nailed the targeted edit cannot hold the full context of a greenfield task.

## Why the gap exists

Local models on consumer hardware top out around 32B parameters. The state-of-the-art hosted models are an order of magnitude larger, with context windows and reasoning depth to match.

For agentic tool calling, where the model needs to plan multi-step operations, execute commands, and iterate based on real output, that gap matters.

> "Agent models behave and work a lot better for stuff like that rather than oneshotting stuff."
>
> Adam, [Office Hours S01E01](https://www.youtube.com/watch?v=DZIkxSMPKOY)

The distinction is between modification and generation. When you're adding a method to an existing class, the codebase itself provides the context: naming conventions, import patterns, test structures. The model fills in a gap within a known frame.

When you're generating from scratch, the model has to hold the entire application architecture in context while producing coherent output across multiple files. That's where local models fall apart.

> "There is no comparison. They don't touch the local models."
>
> Hannes Rudolph, [Office Hours S01E01](https://www.youtube.com/watch?v=DZIkxSMPKOY)

## The real use case

Local models aren't useless. They're scoped.

The practical use case is privacy-sensitive enterprises or developers working on well-defined modifications rather than greenfield projects. If your compliance requirements mean code cannot leave your network, a local model running targeted edits is a legitimate workflow.

> "Local models are for people, you know, enterprises who have privacy concerns mostly. They want to build something up on their own and they have highly secure privacy issues. Otherwise you're just better off using some large language model online because it's going to cost you less money, less time."
>
> Shik, [Office Hours S01E01](https://www.youtube.com/watch?v=DZIkxSMPKOY)

The tradeoff is explicit: privacy versus capability. If you need both, you need to scope your tasks differently depending on which model you're using.

## The hybrid approach

The practical workflow for teams with mixed requirements:

1. **Scoped edits on local models:** Adding methods, writing tests for existing functions, implementing a component in an established pattern. The codebase provides context; the model fills gaps.

2. **Greenfield and complex orchestration on hosted models:** New features, multi-file refactors, anything that requires holding a complete application architecture in working memory.

3. **Clear handoff points:** When a local model starts hallucinating file paths or losing coherence, that's the signal to switch. Don't burn cycles prompting it again.

## How Roo Code supports hybrid model workflows

Roo Code's BYOK (Bring Your Own Key) architecture lets you configure multiple model providers and switch between them based on task scope. You can point Roo Code at a local Ollama instance for privacy-sensitive edits, then switch to a hosted provider when you need the agent to close the loop on complex multi-file operations.

Because Roo Code closes the loop by running commands, executing tests, and iterating based on real output, the model capability gap becomes immediately visible. A local model that hallucinates on a greenfield task will fail the test run; you'll know to switch models before wasting more cycles.

**For teams balancing compliance requirements with shipping velocity, Roo Code's model-agnostic design means you can enforce privacy policies on sensitive codebases while still accessing frontier model capability when the task demands it.**

## Local models vs hosted models for agentic coding

| Dimension                                            | Local models (32B and under)           | Hosted frontier models                 |
| ---------------------------------------------------- | -------------------------------------- | -------------------------------------- |
| Scoped edits (single file, clear patterns)           | Reliable completion                    | Reliable completion                    |
| Greenfield generation (multi-file, new architecture) | Frequent hallucination, coherence loss | Reliable completion                    |
| Multi-step agentic reasoning                         | Limited by context window              | Full planning and iteration capability |
| Privacy and compliance                               | Code stays on your network             | Code sent to external API              |
| Cost structure                                       | Hardware cost, free inference          | Pay per token                          |

## Why this matters for your team

For a Series A team with five engineers and a compliance-conscious customer segment, this distinction shapes your tooling strategy.

If you're building internal tools or modifying well-structured existing code, a local model workflow might satisfy both your security requirements and your shipping velocity. The constraint is real: keep tasks scoped to modifications, not generation.

If you're shipping new product features, greenfield services, or anything that requires multi-step agentic reasoning, the hosted models are where the capability lives. The cost is real, but so is the completion rate.

The mistake is treating them as interchangeable. They aren't.

## Where to draw the line

If the task fits in a single file and the surrounding codebase provides clear patterns, try the local model.

If you're generating something new, or the task requires holding multiple files in context while planning a coherent architecture, use a hosted model.

Track your completion rate per model, not just your token cost. The local model that's free but fails three times costs more than the hosted model that finishes once.

## Frequently asked questions

### Can local models handle agentic coding at all?

Yes, but only for scoped tasks. Local models work well for modifications where the existing codebase provides context: adding methods, writing tests for existing functions, implementing components that follow established patterns. They struggle with greenfield generation that requires holding multiple files and a complete architecture in working memory.

### What size local model do I need for reliable code edits?

Most developers see reasonable results with 32B parameter models on hardware like an M3 Max with 64GB+ of unified memory. Smaller models (7B-13B) can handle simple edits but lose coherence faster on anything requiring multi-step reasoning.

### How do I know when to switch from a local model to a hosted model?

The signal is hallucination. When your local model starts referencing files that don't exist, generating imports for nonexistent packages, or losing track of its own output mid-generation, that's the handoff point. Don't keep prompting - switch to a hosted model.

### Does Roo Code support both local and hosted models?

Yes. Roo Code's BYOK architecture lets you configure multiple providers, including local models through Ollama or LM Studio, alongside hosted providers like Anthropic, OpenAI, or Google. You can switch between them based on task requirements and compliance constraints.

### Is the cost savings from local models worth the capability tradeoff?

It depends on your task mix. If 80% of your work is scoped edits in established codebases, a local model workflow can deliver significant cost savings while meeting privacy requirements. If you're primarily doing greenfield development or complex refactors, the failed attempts on local models will cost more in developer time than the token costs of hosted models.
