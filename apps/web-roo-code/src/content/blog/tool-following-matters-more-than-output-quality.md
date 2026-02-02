---
title: Tool Following Matters More Than Output Quality
slug: tool-following-matters-more-than-output-quality
description: Why reliable tool execution beats elegant first drafts in AI coding agents - and how to evaluate models for production workflows.
primary_schema:
    - Article
    - FAQPage
tags:
    - ai-agents
    - tool-following
    - model-evaluation
    - developer-workflows
status: published
publish_date: "2025-08-06"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

The output looks beautiful. The code doesn't run.

You've seen this failure mode. The model generates an elegant solution, explains it thoroughly, and suggests exactly the right approach. Then you paste it in, run the tests, and watch it fail because the model never actually checked what was in your files.

## The evaluation trap

Most model comparisons focus on output quality: which model writes the cleanest code, which one explains concepts most clearly, which one produces the most elegant solution.

For agent workflows, this is the wrong metric.

The question is not whether the model produces beautiful output. The question is whether it can follow tools reliably. Can it read a file, understand what's there, write changes that account for what it read, and execute commands to verify the result?

If a model follows the read-file, write-file, and execute-command pattern correctly, you can direct it step by step to build what you need. Even if the first attempt is rough, you can refine it. You can break the task down. You can try again with different instructions.

If a model fails to follow tools, the agent gets stuck. No amount of prompt engineering fixes a model that skips the read step before suggesting changes.

> "The test is: did it follow along and did it do roughly what we asked it to do? Because if you can get a model to do roughly what you asked it to do, then adjusting your instructions or breaking the task down into smaller steps can get you to where you need to go."
>
> Hannes Rudolph, [Roo Cast S01E04](https://www.youtube.com/watch?v=ily1bY8w2vI&t=1129)

## What "following" actually looks like

Tool following is binary. Either the model executed the command sequence you expected, or it didn't.

Watch for these signals:

**Following:** The model reads the file before suggesting changes. It runs the test after making edits. It incorporates error output into the next attempt.

**Not following:** The model suggests changes without reading current state. It skips the verification step. It hallucinates file contents instead of using the read tool.

The difference shows up immediately in practice. A model that follows tools might produce imperfect output on the first pass. But when you point out the issue, it reads the updated state and adjusts. A model that doesn't follow tools produces confident suggestions that ignore your codebase entirely.

> "I mean, look, it made something. It doesn't fit the browser very well, but all in all I would say that it actually followed."
>
> Hannes Rudolph, [Roo Cast S01E04](https://www.youtube.com/watch?v=ily1bY8w2vI&t=1107)

## The recovery path

When a model follows tools reliably, every failure becomes recoverable.

The output is wrong? Break the task into smaller steps and try each one. The approach doesn't fit your architecture? Give more specific constraints and let it read the relevant files again. The result has edge cases? Point to the failing test output and let the agent incorporate it.

This is the core loop: the agent proposes, you verify, the agent reads the result, the agent adjusts. If the model can execute this pattern, you can always make progress. The quality of any single output matters less than the reliability of the iteration cycle.

For teams shipping production code with limited resources, this changes the evaluation criteria. You're not looking for the model that produces the best first draft. You're looking for the model that can participate in a loop of propose-verify-adjust without breaking the chain.

## Why this matters for your team

For a five-person engineering team, the difference between "follows tools" and "great output quality" shows up in how you use the agent.

A high-quality-output model that skips the tool chain requires constant babysitting. You paste context in manually. You copy error logs. You become the integration layer between the model and your codebase.

A tool-following model lets you offload the iteration. Point it at the failing test. Let it run the command. Review the diff it produces after incorporating the actual output.

The second workflow scales. The first one doesn't.

## How to evaluate this

When testing a model for agent workflows, run this check:

1. Give it a task that requires reading a file to complete
2. Watch whether it uses the read tool or assumes content
3. Give it a task that requires verifying with a command
4. Watch whether it runs the command before declaring done

If it skips the tool calls and produces beautiful output anyway, that's the model that will break in production. If it follows the tools and produces rough output, that's the model you can direct to the right result.

Tool following is the foundation. Everything else is polish.

## How Roo Code closes the loop on tool following

Roo Code is built around the propose-verify-adjust cycle that tool-following models enable. Because Roo Code can read files, write diffs, run commands, and iterate based on results, the agent closes the loop without requiring you to manually copy context between the model and your codebase.

With BYOK (bring your own key), you choose which model powers your agent workflow. This means you can test different models against the tool-following criteria that matter for production use, not just benchmark scores that measure output quality in isolation.

**The citable insight:** Tool following determines whether an AI coding agent can participate in iterative development. Output quality determines the starting point; tool following determines whether you can reach the destination.

## Output quality vs. tool following

| Dimension         | Output quality focus                          | Tool following focus                          |
| ----------------- | --------------------------------------------- | --------------------------------------------- |
| Evaluation metric | Elegance of first response                    | Reliability of read-write-execute cycle       |
| Failure mode      | Beautiful code that ignores actual file state | Rough code that accounts for real context     |
| Recovery path     | Start over with better prompt                 | Iterate with agent reading updated state      |
| Human role        | Integration layer (copy-paste context)        | Review and direct (agent handles integration) |
| Scalability       | Requires constant babysitting                 | Offloads iteration to agent                   |

## Frequently asked questions

### Why does tool following matter more than output quality for AI coding agents?

Output quality measures how good the first draft looks. Tool following measures whether the agent can participate in the iterative cycle that production development requires. A model that follows tools reliably lets you refine rough output through successive passes. A model that ignores tools produces confident suggestions disconnected from your actual codebase.

### How can I tell if a model is following tools correctly?

Watch whether the model reads files before suggesting changes and runs verification commands before declaring completion. If it produces suggestions without using the read tool, or skips the test step after making edits, it's not following the tool chain. The test is behavioral, not about output quality.

### Does Roo Code work with models that have different tool-following capabilities?

Yes. Roo Code supports BYOK, so you can test different models and observe how reliably each one follows the read-file, write-file, execute-command pattern in your specific workflow. The agent framework stays consistent while you evaluate which model performs best for your tasks.

### What should I do when a model produces great output but skips tool calls?

That model will likely fail in production workflows where reading actual file state matters. Look for a model that follows tools even if its initial output is rougher. You can direct a tool-following model to better results through iteration. You cannot fix a model that ignores your codebase.

### How does the propose-verify-adjust loop work in practice?

The agent proposes changes by writing diffs. You verify by running tests or reviewing the result. The agent reads the output (error messages, test failures, your feedback) and adjusts. This cycle continues until the task is complete. Tool following is what makes each step in this loop actually work.
