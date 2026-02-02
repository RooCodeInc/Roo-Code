---
title: Agent Orchestrators Need Better Handoff Primitives
slug: agent-orchestrators-need-better-handoff-primitives
description: Why most agent orchestration systems fail at coordination and what primitives you need for parent-child communication, cost rollup, and persistent context.
primary_schema:
    - Article
    - FAQPage
tags:
    - agent-orchestration
    - ai-agents
    - developer-tools
    - agentic-workflows
status: published
publish_date: "2025-05-14"
publish_time_pt: "9:00am"
source: "Office Hours"
---

Rule: If the parent cannot check in on the child, it is not an orchestrator. It is a launcher.

Most agent orchestration systems have two primitives: "start task" and "end task." The parent spins up a subtask, waits for completion, aggregates the result. Done.

The gaps show up the moment something goes wrong.

## Where the primitives break

You have an orchestrator managing three subtasks. Subtask two stalls. The parent cannot check in. It cannot ask "what are you stuck on?" It cannot give feedback mid-flight. It waits.

Meanwhile, you restart the system. Context is gone. The parent does not remember what it delegated. The subtasks do not remember who spawned them. You are back to manual coordination.

Costs do not accumulate visibly. You cannot see that subtask one burned through your token budget while subtask three sat idle. There is no ledger, no rollup, no "here is what the tree spent."

Navigation is one-way. You can jump from parent to child, but not back. You cannot move laterally between siblings. The orchestration graph is a one-time traversal, not a workspace you can explore.

These are not edge cases. These are the first things you notice when you try to build a system where agents manage other agents.

## The shift in thinking

The insight from teams building orchestration: treat communication between agents as a first-class design problem, not an afterthought.

> "I think in some ways we found it to be such a powerful change: the idea that the agents can be orchestrators and managers of other agents."
>
> Matt, [Office Hours S01E06](https://www.youtube.com/watch?v=zPhNXCHJ5xk)

The power is real. But the power requires infrastructure.

What does that infrastructure look like? Start with the primitives that are missing:

**Persistent context across restarts.** Parent and subtask relationships should survive a crash. When you come back, the orchestrator should know what it delegated and what came back.

**Mid-flight feedback.** The parent should be able to check in on a running subtask. Not just "is it done?" but "what are you seeing?" and "here is additional context."

> "It would also be interesting if they could give feedback on some of the things. They could check in while the task is running."
>
> Matt, [Office Hours S01E06](https://www.youtube.com/watch?v=zPhNXCHJ5xk)

**Cost rollup.** Token spend and runtime should accumulate visibly at the parent level. You should be able to see "this orchestration tree cost X" without summing logs manually.

**Bidirectional navigation.** You should be able to move from parent to child, child to parent, and sibling to sibling. The task graph is a workspace, not a one-way path.

**Self-description for routing.** Subtasks should be able to introduce themselves. The orchestrator should know what each agent is good at before delegating.

> "Spoiler alert: we added a new field to the modes that's optional to have them kind of introduce themselves a little bit and make it easier for the orchestrator to know when to use them."
>
> Matt, [Office Hours S01E06](https://www.youtube.com/watch?v=zPhNXCHJ5xk)

## The tradeoff

Adding these primitives adds complexity. Every handoff primitive is a protocol to maintain. Persistent context means storage and sync logic. Mid-flight feedback means interrupts and state management.

The question is whether the complexity is in your infrastructure or in your head. Without explicit primitives, you end up rebuilding coordination logic in prompts. You become the message bus.

## Orchestration primitives: launcher vs. coordinator

| Dimension                 | Launcher (basic)          | Coordinator (full primitives)            |
| ------------------------- | ------------------------- | ---------------------------------------- |
| Parent-child relationship | Fire and forget           | Persistent across restarts               |
| Mid-task feedback         | None                      | Parent can check in, provide context     |
| Cost visibility           | Per-task only             | Rolled up to orchestration tree          |
| Navigation                | One-way (parent to child) | Bidirectional (parent, child, sibling)   |
| Agent routing             | Hardcoded or prompt-based | Self-describing agents with capabilities |

## How Roo Code closes the loop on orchestration

Roo Code implements orchestration as a first-class workflow through its Orchestrator mode. When you spawn subtasks, Roo Code maintains bidirectional navigation between parent and child tasks, preserving context across the session. The BYOK model means token costs roll up visibly since you pay your provider directly and can track spend across your orchestration tree without hidden markup.

Roo Code's mode system supports self-describing agents: each mode can introduce its capabilities to help the orchestrator route tasks appropriately. This is not a launcher that fires and forgets. It is a coordinator where the parent can check in, provide feedback, and iterate based on results.

## Why this matters for your codebase

If you are building agent orchestration, audit your handoff layer.

Can the parent check in on a running child? Can the child report back before completion? Do costs roll up? Does context persist?

If the answer is "no," you are building a launcher, not an orchestrator. The difference shows up the first time a subtask stalls and you realize you have no way to ask it what went wrong.

Treat agent-to-agent communication as a first-class design problem. The primitives you build now determine whether your orchestration scales or whether you stay in the loop as the human coordinator.

## Frequently asked questions

### What is the difference between an agent launcher and an agent orchestrator?

A launcher starts subtasks and waits for completion with no ability to intervene. An orchestrator maintains ongoing relationships with subtasks: it can check in mid-flight, provide feedback, track costs across the tree, and navigate bidirectionally between parent and child agents.

### Why does context persistence matter for agent orchestration?

When an orchestration system restarts, you lose the parent-child relationships and delegation history. Without persistent context, you cannot resume work or understand what was delegated to whom. You end up re-coordinating manually, which defeats the purpose of orchestration.

### How does Roo Code handle agent-to-agent communication?

Roo Code's Orchestrator mode treats subtask management as a first-class workflow. Parent tasks can spawn child tasks, maintain context across the conversation, and navigate between related tasks. The mode system allows agents to self-describe their capabilities, helping the orchestrator route work appropriately.

### What should I look for when evaluating orchestration frameworks?

Audit five primitives: persistent context across restarts, mid-flight feedback from parent to child, cost rollup at the orchestration tree level, bidirectional navigation between tasks, and self-description capabilities for routing. If these are missing, you have a launcher, not an orchestrator.

### How do token costs work in multi-agent orchestration?

Each subtask consumes tokens independently. Without cost rollup, you cannot see what an orchestration tree spent in total. With BYOK (bring your own key) systems like Roo Code, costs are transparent since you pay your provider directly and can track aggregate spend across all orchestrated tasks.
