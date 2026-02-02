---
title: Context Compression Creates a Photocopy Problem
slug: context-compression-creates-a-photocopy-problem
description: Why compressing context to save tokens actually costs more tokens, and how task orchestration keeps context clean without fidelity loss.
primary_schema:
    - Article
    - FAQPage
tags:
    - context-management
    - task-orchestration
    - token-efficiency
    - agentic-workflows
status: published
publish_date: "2025-05-07"
publish_time_pt: "9:00am"
---

Saving tokens costs you tokens.

Compressing context to fit more into the window sounds like discipline. In practice, it's a trap.

## The photocopy loop

You're on iteration twelve of a refactoring task. The model proposed a solid approach eight iterations ago. Now it's suggesting changes that contradict its earlier reasoning.

You scroll back. The context that explained _why_ this approach was chosen is gone. Compressed. Summarized into a sentence that lost the nuance.

So you re-explain. The model incorporates your re-explanation, proposes a fix, and the cycle continues. You're spending tokens to recover information you already had.

This is the photocopy problem. Each compression pass loses fidelity. The summary of a summary of a decision no longer contains the constraints that made the decision make sense.

> "You create a new task, you squish it down, but we find that actually becomes a bit of a photocopy of a photocopy situation and we're not interested in getting lesser results like that."
>
> Hannes Rudolph, [Office Hours S01E05](https://www.youtube.com/watch?v=Wa8ox5EVBZQ)

## Why teams compress

The intuition makes sense. Context windows have limits. Tokens cost money. If you can summarize the last ten iterations into a paragraph, you free up space for new work.

The problem is what gets lost in the summary:

- The specific constraint that ruled out option B
- The edge case that made the current approach necessary
- The reason the model proposed this structure instead of that one

When that context disappears, the model starts from a weaker foundation. It re-proposes ideas that were already rejected. It misses the nuance that made the current approach work. You spend time re-establishing what was already established.

The token savings from compression get eaten by the tokens spent recovering lost context.

## The orchestration alternative

The alternative is task orchestration: a parent task spawns focused child tasks. Each child task operates with fresh context, does its specific job, and returns only the necessary result to the parent.

> "The child task then returns just the necessary context to the parent task, thus keeping your context clean."
>
> Hannes Rudolph, [Office Hours S01E05](https://www.youtube.com/watch?v=Wa8ox5EVBZQ)

The parent's context stays clean because it never ingested the full working state of each child. It only receives what it needs: the outcome, the decision, the artifact.

This is different from compression. Compression takes everything and makes it smaller. Orchestration keeps contexts separate and passes only the relevant handoff.

The mental model shift: instead of one long task that periodically squishes its own history, think of a coordinator that delegates to specialists. The coordinator doesn't need to know every line the specialist considered. It needs to know what the specialist concluded.

## Context management: compression vs. orchestration

| Dimension                | Compression approach                          | Orchestration approach                                       |
| ------------------------ | --------------------------------------------- | ------------------------------------------------------------ |
| Context handling         | Summarize accumulated state into smaller form | Keep contexts separate, pass only results                    |
| Fidelity over iterations | Degrades with each pass                       | Preserved within each focused task                           |
| Token efficiency         | Upfront savings, hidden recovery costs        | Higher coordination overhead, lower rework                   |
| When it fails            | Around iteration 8-12 as nuance is lost       | When task boundaries are poorly defined                      |
| Best for                 | Short, single-focus tasks                     | Multi-step refactors, debugging sessions, cross-file changes |

## The tradeoff

Orchestration requires upfront structure. You have to define what the child tasks are, what they return, and how the parent incorporates their results. That's more setup than "keep going and compress when you hit the limit."

For short tasks, compression might never hurt you. The photocopy problem surfaces in longer multi-step work: refactors that span multiple files, debugging sessions that iterate through hypotheses, feature builds that require coordinated changes across layers.

If your tasks regularly exceed ten iterations, the fidelity loss from compression will start showing up as rework.

## Why this matters for your team

For a five-person engineering team running multiple parallel workstreams, the compounding effect is significant. Each developer hitting the photocopy loop loses an hour here, thirty minutes there. The model confidently proposes something that contradicts a constraint from six iterations ago. The developer catches it, re-explains, watches the context get compressed again.

Multiply that across a week. Across a sprint.

The shift is structural: use task orchestration to keep context clean instead of using compression to make dirty context fit. The parent task stays focused. The child tasks stay focused. The handoffs carry only what matters.

## How Roo Code closes the loop on context management

Roo Code's Orchestrator mode addresses the photocopy problem directly. Instead of compressing context within a single runaway task, Orchestrator spawns focused subtasks that each operate with clean context and return only the necessary results to the parent.

This approach embodies the "close the loop" principle: the agent proposes changes, executes them, observes results, and iterates, all while maintaining context integrity through task boundaries rather than lossy compression.

With BYOK (bring your own key), teams control their token spend directly without markup, making the orchestration overhead predictable and the rework savings measurable. The result: spend tokens intentionally for outcomes rather than spending tokens to recover from compression artifacts.

## When to notice the problem

If outputs start degrading around iteration ten, check whether context compression is the cause. The symptom: the model contradicts its own earlier reasoning, or re-proposes approaches that were already rejected.

The fix: break the long task into parent and child tasks. Let each child return a clean result. Keep the parent's context window free of accumulated working state.

Context is not infinite. How you manage it matters more than how much you compress it.

## Frequently asked questions

### Why does context compression seem to work at first but fail later?

Early iterations benefit from recent, high-fidelity context. As the context window fills and compression kicks in, each summary loses decision rationale and edge cases. By iteration eight to twelve, the model operates on degraded information and starts contradicting earlier reasoning, forcing you to re-explain constraints that were already established.

### How do I know if my team is hitting the photocopy problem?

Watch for these symptoms: the model re-proposes approaches you already rejected, suggests changes that contradict earlier decisions, or produces outputs that ignore constraints discussed five or more iterations ago. Developers spending time re-explaining context is a clear signal that compression is eating your token savings.

### Does task orchestration cost more tokens than compression?

Orchestration has higher upfront coordination costs, but lower total costs for complex tasks. Each subtask runs with clean context and returns focused results, eliminating the rework tokens spent recovering from compression artifacts. For tasks under five iterations, compression may be fine. For ten-plus iteration work, orchestration typically costs fewer total tokens.

### How does Roo Code help avoid context compression issues?

Roo Code's Orchestrator mode structures work as parent and child tasks automatically. The parent maintains clean context by receiving only necessary results from each child task, not the full working state. Combined with BYOK pricing, teams can measure the actual token efficiency gains from orchestrated workflows versus compressed single-task approaches.

### When should I use compression versus orchestration?

Use compression for short, focused tasks that complete in under five iterations. Use orchestration when work spans multiple files, involves iterative debugging, or requires coordinated changes across system layers. If you find yourself re-explaining earlier decisions to the model, that's the signal to switch to orchestrated subtasks.
