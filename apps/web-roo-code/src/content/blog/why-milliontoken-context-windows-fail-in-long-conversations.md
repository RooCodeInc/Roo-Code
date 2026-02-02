---
title: Why Million-Token Context Windows Fail in Long Conversations
slug: why-milliontoken-context-windows-fail-in-long-conversations
description: Million-token context windows work for one-shot queries but degrade to 200K effective context in extended agentic conversations. Learn why attention drift happens and how to calibrate for real-world coding workflows.
primary_schema:
    - Article
    - FAQPage
tags:
    - context-windows
    - agentic-workflows
    - AI-coding
    - developer-productivity
status: published
publish_date: "2025-05-21"
publish_time_pt: "9:00am"
source: "Office Hours"
---

A million tokens sounds like infinite memory.

It isn't.

## The difference between dump and dialogue

You paste a 200-page specification into the context window. You ask one question. The model answers correctly, citing page 47. The million-token context worked exactly as advertised.

Now try something different. Start a task. Go back and forth for an hour. Add new files. Run commands. Review diffs. Ask follow-up questions. Watch the conversation grow to 300K tokens.

The model starts missing things. It references files you mentioned an hour ago but ignores the correction you made ten minutes ago. It suggests a fix you already tried. It loses focus.

Same model. Same context window. Different behavior.

## One-shot vs. extended tasks

The million-token context window works differently depending on how you use it.

**One-shot queries:** you dump a large document, ask a question, get an answer. The model processes the full context once, retrieves what it needs, and responds. This works.

**Extended conversations:** you go back and forth, the context grows incrementally, and the model has to track state across many turns. The attention mechanism that works for retrieval starts losing track of what matters.

> "The million context works differently when you're dumping it, you're one-shotting, you're saying, here's a giant trove of stuff and you ask it a question... But when you have an ongoing conversation back and forth and it grows to hundreds of thousands, it doesn't maintain focus. So, for extended tasks, it's more like 200K in my experience."
>
> Shank, [Office Hours S01E07](https://www.youtube.com/watch?v=yGVPIdn0mVw)

The advertised number tells you the theoretical maximum. The effective number for agentic workflows is closer to 200K. Sometimes less.

## Where the focus breaks

In one set of tests with subtask delegation, the highest any single subtask reached was around 80K tokens. That's not a limitation of the tool. That's where the workflow naturally settled to keep outputs coherent.

When context grows beyond what the model can effectively track, you see specific symptoms:

- The model repeats suggestions it already made
- It ignores constraints you stated earlier in the conversation
- It references outdated assumptions instead of recent corrections
- It becomes confidently wrong about the current state of the codebase

These aren't random failures. They're symptoms of attention degradation in long contexts.

## One-shot retrieval vs. extended conversation

| Dimension         | One-shot retrieval                 | Extended conversation                       |
| ----------------- | ---------------------------------- | ------------------------------------------- |
| Context usage     | Load once, query once              | Incremental growth over many turns          |
| Effective limit   | Full advertised window (1M tokens) | 200K or less before degradation             |
| Attention pattern | Focused retrieval from static dump | Distributed across evolving state           |
| Failure mode      | Missing information                | Losing track of corrections and constraints |
| Recovery strategy | Re-query with different prompt     | Start fresh task with summary               |

## The tradeoff

You have two options for extended tasks.

**Option 1: Accept the effective limit.** Keep conversations under 200K. Start fresh tasks when context gets stale. Split large workflows into focused subtasks.

**Option 2: Invest in context management.** Use summarization, hierarchical memory, or explicit state tracking to keep the relevant information in the attention window.

Neither option is free. Fresh tasks lose history. Context management adds complexity and tokens. The question is which cost you prefer.

## How Roo Code closes the loop on context management

Roo Code addresses context degradation through its subtask orchestration architecture. Instead of running a single conversation until attention drifts, Roo Code's Orchestrator mode breaks complex workflows into focused subtasks, each staying within the effective context range.

When you use BYOK (bring your own key) with Roo Code, the agent can delegate work to specialized modes - each subtask starts with a clean context and a focused objective. The parent orchestrator maintains the high-level state while child tasks execute without carrying accumulated noise.

**The key difference:** Roo Code closes the loop by running commands, tests, and iterations within bounded subtasks, then consolidating results back to the orchestrator. This design keeps each unit of work within the 80K range where coherence stays high, while preserving the overall workflow state across the full task.

## Why this matters for your team

For a team running multi-hour agent tasks, the million-token marketing number creates a false expectation. You plan for infinite memory. You get degraded focus after 200K.

The impact shows up in subtle ways: tasks that should converge keep looping. Bugs that were "fixed" reappear. The agent suggests approaches you already rejected. You start wondering if the model is broken when the real issue is context length.

If your team is shipping 5-10 PRs a week through agentic workflows, calibrating for effective context (not advertised context) saves hours of debugging attention drift.

## The practical calibration

For extended agentic tasks, plan for 200K effective context. When you hit that threshold, consider starting a fresh task with a summary of the current state.

If you're delegating to subtasks, keeping each under 80K seems to be where coherence stays high. That's not a hard rule; it's an observation from practice.

The million-token window is real. But for ongoing back-and-forth work, the effective limit is lower. Plan accordingly.

## Frequently asked questions

### Why does my AI coding agent forget things I told it earlier in the conversation?

This is attention degradation in long contexts. As your conversation grows beyond 200K tokens, the model's attention mechanism loses track of earlier constraints and corrections. It's not forgetting in the human sense - it's that the attention weights spread too thin across the growing context. The model may reference something from early in the conversation while missing a correction you made more recently.

### What is the actual effective context limit for extended coding tasks?

Based on practical observation, the effective limit for extended agentic tasks is around 200K tokens, not the million-token advertised maximum. For individual subtasks where you need high coherence, 80K tokens appears to be where outputs stay reliable. These aren't hard limits but practical thresholds where degradation becomes noticeable.

### How does Roo Code handle context limits differently than other AI coding tools?

Roo Code uses subtask orchestration to keep individual work units within effective context ranges. The Orchestrator mode breaks complex workflows into focused subtasks, each starting with clean context. This architecture lets you run multi-hour workflows without the attention drift that occurs in single long conversations. Each subtask closes the loop independently, then results consolidate back to the parent orchestrator.

### Should I start a new conversation when my agent starts repeating itself?

Yes. When the model starts repeating suggestions, ignoring recent corrections, or referencing outdated assumptions, those are symptoms of context degradation. Starting a fresh task with a summary of the current state is more efficient than fighting attention drift. Think of it as a checkpoint rather than a failure.

### Does using a model with a larger context window solve this problem?

Not for extended conversations. The million-token context window works well for one-shot retrieval tasks where you dump a large document and ask questions. But the attention mechanism degrades differently in extended back-and-forth dialogue. A larger window gives you more theoretical capacity, but the effective limit for conversational workflows remains around 200K regardless of the advertised maximum.
