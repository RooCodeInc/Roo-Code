---
title: Stop Fixing Mid-Flight Derailments - Kill and Restart
slug: stop-fixing-midflight-derailments-kill-and-restart
description: Learn why killing derailed AI coding tasks and restarting with fixed workflows beats mid-flight correction, saving engineering teams hours weekly.
primary_schema:
    - Article
    - FAQPage
tags:
    - ai-workflows
    - developer-productivity
    - agentic-coding
status: published
publish_date: "2025-10-10"
publish_time_pt: "9:00am"
source: "After Hours"
---

Kill it. Start over.

That's not failure. That's the workflow.

## The salvage instinct

The task started fine. Clear prompt, reasonable scope. Then somewhere around the third iteration, it drifted. Now it's suggesting changes to files you didn't mention, referencing functions that don't exist, and confidently explaining why its broken approach is correct.

Your instinct: course-correct. Add more context. Clarify the constraint. Nudge it back on track.

You're now debugging the task instead of shipping the feature.

This is where teams lose hours. Not because the model failed, but because the recovery attempt costs more than starting clean.

## The counterintuitive discipline

The teams that ship fastest have a different pattern: they kill derailed tasks and restart with a fixed workflow.

> "Instead of trying to fix a shitty task once it derails, just kill it. Start over. Fix your workflow if you need to, but just stop trying to use a workflow that doesn't work."
>
> Hannes Rudolph, [After Hours S01E02](https://www.youtube.com/watch?v=I3HiU_G-cjk&t=2256)

The insight isn't "give up easily." It's that mid-flight correction is expensive. Every prompt you spend trying to salvage a derailed task is a prompt that could have gone into a clean run with a workflow that actually works.

The math changes when you realize: fixing the workflow once benefits every future task. Fixing this task benefits only this task.

## Inspect at the end, not throughout

The other shift is where you put human attention. The instinct is to checkpoint frequently: review after every step, course-correct as you go, maintain tight control.

The problem is that checkpoints become interaction points. Every time you stop the task to review, you're injecting latency and context switches into the workflow.

> "The main thing I learned recently is stop creating workflows that need human interaction."
>
> Dan, [After Hours S01E02](https://www.youtube.com/watch?v=I3HiU_G-cjk&t=2181)

Instead: let the task run. Inspect the end result. If it worked, ship it. If it didn't, fix the workflow and restart.

This feels riskier. You're giving up control. But if your workflow is solid, the end result is predictable. And if your workflow is broken, you'll find out either way. The question is whether you find out after three checkpoints or after one clean run.

> "If it gets distracted, just go and edit your workflow, your instructions, instead of just going back on every task trying to get it to work. Just let it do its thing. Inspect the end."
>
> Hannes Rudolph, [After Hours S01E02](https://www.youtube.com/watch?v=I3HiU_G-cjk&t=2283)

## The tradeoff

This discipline requires trust in your workflow. If you haven't validated that your instructions produce reliable results, "let it run and inspect the end" is a gamble.

The investment is upfront: build workflows that work without mid-flight intervention. Test them on representative tasks. When they fail, fix the workflow, not the task.

This is harder at first. You have to resist the salvage instinct. You have to accept that some tasks will fail completely rather than being nudged to partial success.

But the compounding benefit is real: every workflow fix propagates to every future task.

## Why this matters for your team

For a five-person team running 15-20 AI tasks per week, the salvage pattern adds up. If three tasks per week hit the "try to save it" loop, and each loop burns 30-45 minutes of engineer attention, that's 2-3 hours of lost time weekly. Time spent debugging tasks instead of debugging code.

The alternative: kill derailed tasks immediately. Spend that time fixing the workflow. The next 15 tasks benefit from the fix.

The shift is process iteration over task recovery. If a workflow keeps failing, the workflow is the bug.

## How Roo Code enables the kill-and-restart workflow

Roo Code is built for exactly this discipline. Because Roo Code closes the loop - proposing diffs, running commands and tests, and iterating based on results - you get clear signal on whether a task succeeded or failed. There's no ambiguity to salvage.

With BYOK (bring your own key), you pay only for the tokens you use, which changes the economics of restarting. A clean restart with a fixed workflow costs exactly what it should - no platform markup, no sunk cost fallacy pushing you to salvage broken runs.

Roo Code's mode system and custom instructions let you encode workflow fixes once and apply them to every future task. When you kill a derailed task and fix the workflow, that fix lives in your configuration, not in your memory.

**The pattern Roo Code supports: fail fast, fix the workflow, restart clean, and let the agent close the loop without mid-flight intervention.**

## Kill-and-restart vs. salvage: a comparison

| Dimension              | Salvage approach                               | Kill-and-restart approach                   |
| ---------------------- | ---------------------------------------------- | ------------------------------------------- |
| Time per derailed task | 30-45 minutes of correction attempts           | 5 minutes to kill and restart               |
| Benefit scope          | Fixes only the current task                    | Workflow fix benefits all future tasks      |
| Cognitive load         | High - debugging task and model simultaneously | Low - clear decision point                  |
| Failure signal         | Unclear - partial success masks workflow bugs  | Clear - failed tasks reveal workflow issues |
| Long-term velocity     | Flat - same problems recur                     | Compounding - fewer derailments over time   |

## Frequently asked questions

### When should I kill a task versus trying to save it?

Kill the task when you've spent more than two prompts trying to course-correct, when the model is referencing files or functions that don't exist, or when you're explaining the same constraint for the third time. The threshold is lower than your instinct suggests. If the task is fighting you, the workflow is the bug.

### How do I know if the problem is my workflow or just a bad run?

Track patterns across tasks. If the same type of derailment happens twice, it's a workflow problem. Single failures might be noise, but repeated failures in similar situations point to missing instructions, unclear constraints, or scope that's too broad for a single task.

### Does Roo Code support killing and restarting tasks cleanly?

Yes. Roo Code's task model lets you terminate a derailed task and start fresh without losing your workflow configuration. Your custom instructions, mode settings, and project context persist across tasks, so restarting is low-friction. The agent closes the loop on each task independently, giving you clear success or failure signals.

### Won't I waste tokens by restarting instead of salvaging?

The opposite is usually true. Salvage attempts often consume more tokens than a clean restart because you're paying for correction prompts, re-explanations, and partial rollbacks. With BYOK pricing, you pay only for actual token usage - no platform markup - so restarting when it's the right call costs exactly what it should.

### How do I build workflows that don't need mid-flight intervention?

Start with explicit constraints: which files to touch, which to ignore, what the success criteria looks like. Test the workflow on representative tasks before relying on it. When a task fails, ask what instruction would have prevented the failure and add it. Over time, your workflows accumulate the guardrails that make autonomous runs reliable.
