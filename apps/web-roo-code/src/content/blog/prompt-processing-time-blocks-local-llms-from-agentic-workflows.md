---
title: Prompt Processing Time Blocks Local LLMs from Agentic Workflows
slug: prompt-processing-time-blocks-local-llms-from-agentic-workflows
description: Why 500 tokens per second still feels slow for local LLMs - the hidden bottleneck of prompt processing time in agentic coding workflows and how to design around it.
primary_schema:
    - Article
    - FAQPage
tags:
    - local-llms
    - agentic-workflows
    - performance
    - prompt-engineering
status: draft
publish_date: "2025-09-25"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

500 tokens per second.

Still too slow.

The number looks production-ready. The experience is not.

## The wait before the wait

You spin up a local model. You've seen the benchmarks: 500 tokens per second on your hardware. You load your codebase into context, fire off an agentic task, and wait.

The model starts generating. Then it needs to check something. New prompt. More waiting. Another check. Another prompt. Each step costs you the same processing time before any tokens appear.

The bottleneck is not generation speed. It's prompt processing time.

A 20,000-token system prompt takes significant time to process before the first output token appears. In a single-pass workflow, you pay that cost once. In an agentic loop, you pay it on every iteration.

> "You've got a big amount of prompt processing time that happens and you could be getting 500 tokens per second but that still ends up being pretty long amount of time... that just makes it unattainable when you're doing that."
>
> Adam, [Roo Cast S01E10](https://www.youtube.com/watch?v=BWxsa_JxGZI&t=531)

## The math that breaks agent loops

Agentic workflows iterate. The model proposes a change, runs a command, reads the output, and decides what to do next. Each step requires reprocessing the context.

If prompt processing takes 30 seconds and you need 8 iterations to complete a task, you've spent 4 minutes just waiting for the model to start generating. The actual token generation might be fast. The pauses between steps are not.

This is different from cloud inference. Cloud providers optimize for throughput across many users, and the context processing happens on hardware designed for it. Your local GPU is doing both the processing and the generation, and the processing dominates the latency budget.

## The workflow that works

The fix is architectural: design for single-pass execution.

Load the codebase. Request a specific change. Generate a diff. Apply it. Done.

> "I can actually load in my codebase. I can actually say, 'Hey, I want you to update the design of this page.' It'll go through and do it and create a diff for me that I can immediately apply to my codebase. That works a lot better than trying to drive an agentic task just due to the speed and nature of it."
>
> Adam, [Roo Cast S01E10](https://www.youtube.com/watch?v=BWxsa_JxGZI&t=402)

Diff view workflows succeed where agent loops fail because they pay the prompt processing cost exactly once. You get one generation pass, one output, one decision point.

This constrains what you can do. You lose the iterative refinement loop where the model tests its own changes and corrects mistakes. But on current local hardware, that loop costs more time than it saves.

## The tradeoff

Single-pass workflows require more upfront clarity. You need to specify what you want precisely because the model will not iterate toward correctness. If the diff is wrong, you request another one. Manually.

This works for:

- Targeted refactors with clear scope
- Design changes to specific pages or components
- Adding features to well-understood codebases

This struggles with:

- Debugging tasks that require running code and interpreting output
- Multi-file changes that depend on each other
- Tasks where you do not know what "done" looks like until you see it

## Why this matters for your workflow

If you are running local models because you want control over your data or want to avoid API costs, this constraint shapes your architecture.

Design your prompts for single-pass execution. Load the context once. Request the complete change. Review the diff. Apply or reject.

When a task requires iteration, either accept the latency cost or offload that task to cloud inference where prompt processing is not the bottleneck.

## How Roo Code handles local model constraints

Roo Code supports BYOK (bring your own key) configurations including local model endpoints, giving you full control over where your code is processed. The diff view workflow aligns with how Roo Code presents changes: proposed edits appear as reviewable diffs that you approve before they apply to your codebase.

For tasks that require the agent to close the loop - running tests, checking build output, iterating on failures - cloud inference through your own API keys removes the prompt processing bottleneck while maintaining data control. **Roo Code lets you choose the right inference target per task: local models for single-pass diff generation, cloud APIs for agentic loops that need to run and iterate.**

This hybrid approach means you do not have to choose between local control and agentic capability. You allocate each task to the inference path that matches its iteration requirements.

## Comparing workflow approaches for local LLMs

| Dimension                             | Agentic loop on local hardware       | Single-pass diff workflow     |
| ------------------------------------- | ------------------------------------ | ----------------------------- |
| Prompt processing cost                | Paid on every iteration              | Paid once                     |
| Time for 8-step task (30s processing) | 4+ minutes of waiting                | 30 seconds of waiting         |
| Iteration and self-correction         | Automatic                            | Manual                        |
| Task clarity required                 | Lower (model figures it out)         | Higher (you specify upfront)  |
| Best use case                         | Cloud inference or high-end hardware | Local models on consumer GPUs |

## The decision point

Check your prompt processing time against your iteration count.

If a task needs 5+ iterations and each prompt takes 20+ seconds to process, you are spending more time waiting than working. Redesign the workflow or pick a different inference target.

The generation speed metric on the box is not the metric that matters. Prompt processing time is.

## Frequently asked questions

### Why does prompt processing time matter more than tokens per second?

Tokens per second measures generation speed after the model starts outputting. Prompt processing time measures how long before that first token appears. In agentic workflows with multiple iterations, you pay the processing cost repeatedly, making it the dominant factor in total task time.

### Can I run agentic coding workflows on local LLMs?

Yes, but with constraints. Tasks requiring many iterations will hit the prompt processing bottleneck on consumer hardware. Either accept longer wait times, limit iteration count through precise prompts, or route iteration-heavy tasks to cloud inference.

### What hardware would eliminate the prompt processing bottleneck for local models?

Enterprise-grade GPUs with more VRAM and faster memory bandwidth reduce processing time significantly. However, even high-end consumer hardware (RTX 4090, Mac M3 Ultra) still shows noticeable delays with large contexts. The gap between local and cloud processing remains substantial for agentic use cases.

### How does Roo Code work with local LLMs?

Roo Code supports local model endpoints through its BYOK configuration. You can point Roo Code at Ollama, LM Studio, or any OpenAI-compatible local server. The diff view workflow is particularly effective with local models because it minimizes iteration and prompt reprocessing.

### Should I use local models or cloud APIs for AI coding assistance?

It depends on the task. Use local models for single-pass changes where you want data control and can tolerate processing delays. Use cloud APIs for complex agentic tasks that require running code, checking outputs, and iterating on results. Roo Code lets you configure both and choose per task.
