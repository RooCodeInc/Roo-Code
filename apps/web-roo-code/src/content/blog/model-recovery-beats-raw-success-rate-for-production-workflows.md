---
title: Model Recovery Beats Raw Success Rate for Production Workflows
slug: model-recovery-beats-raw-success-rate-for-production-workflows
description: Why graceful failure recovery matters more than raw success rates when evaluating AI models for agentic coding workflows - and how to test for it.
primary_schema:
    - Article
    - FAQPage
tags:
    - ai-agents
    - model-evaluation
    - production-workflows
    - developer-experience
status: published
publish_date: "2025-08-27"
publish_time_pt: "9:00am"
---

The model fails a tool call. Then fails the same way again. And again.

Three attempts. Same error. Zero learning.

## The loop problem

You're watching a model debug a test failure. It tries to read a file that doesn't exist. The call fails. Instead of trying a different path or asking for clarification, it tries the exact same call again.

And again.

And again.

The context is poisoned. The failed tool call became the new pattern, and now the model is committed to beating its head against the wall until you kill the task or run out of tokens.

This is the difference between a model with a 95% success rate that loops forever on failures, and a model with a 90% success rate that recovers and tries a different approach. The second model is more useful for production workflows.

## What makes a model recoverable

The problem isn't occasional failures. Every model fails sometimes. The problem is what happens next.

A recoverable model treats failed tool calls as information, not as a template. If a file read fails, it looks for alternative paths. If a command errors out, it parses the error message and adjusts. The failed attempt gets purged from the pattern-matching context instead of becoming the new baseline.

> "It's not about, you know, failing the occasional right to file. It's about not getting stuck on a loop after it fails a single call, which we've seen with some models after they fail once, they just continue failing forever."
>
> Dan, [Roo Cast S01E06](https://www.youtube.com/watch?v=PZgkQtTRtUw)

A non-recoverable model does the opposite. It sees the failed call, treats it as a valid approach, and doubles down. Each retry reinforces the pattern. The context window fills with repeated failures, which makes recovery even less likely.

## The evaluation shift

When teams evaluate models for agentic work, the standard benchmarks focus on raw success rates. Can the model solve the task? What percentage of the time?

Those benchmarks miss the loop problem entirely.

A model that passes 95% of tasks but loops indefinitely on the other 5% might be worse than a model that passes 90% and recovers gracefully on the remaining 10%. The first model wastes hours of wall-clock time and burns through your token budget on failures that will never resolve. The second model either finds an alternative approach or surfaces the failure clearly so you can intervene.

> "So if the model, you know, fails occasionally, probably more often than Sonic 4, but it's able to keep going even if it fails, I think that makes it a useful model for sure."
>
> Dan, [Roo Cast S01E06](https://www.youtube.com/watch?v=PZgkQtTRtUw)

The tradeoff is explicit: you might accept a lower raw success rate in exchange for graceful degradation. The question isn't "how often does this model succeed?" It's "what happens when it fails?"

## Testing for recovery

If you're evaluating models for production agentic workflows, add failure recovery to your test suite.

Run tasks where the expected file doesn't exist. Run tasks where the first command returns an unexpected error format. Run tasks where the context starts with a misleading assumption.

Then watch what happens on the second attempt.

Does the model parse the error and adjust? Does it try a different approach? Or does it loop?

> "Basically if it can sort of purge that poisoning and move on instead of taking that failed tool call as the new the new... this is the new pattern to follow and I'm just going to keep beating my head against the ball."
>
> Dan, [Roo Cast S01E06](https://www.youtube.com/watch?v=PZgkQtTRtUw)

## Why this matters for your workflow

If you're running agentic tasks on real codebases, you will hit edge cases. Files get renamed. APIs return unexpected formats. Test environments drift from production. The model will fail.

The question is whether that failure costs you five seconds of recovery time or five hours of loop-watching before you realize nothing is going to change.

When you evaluate models, test for recovery. Count the loops, not just the wins.

## How Roo Code closes the loop on model failures

Roo Code is designed to close the loop - running commands, observing results, and iterating based on what actually happened. When a tool call fails, Roo Code can parse the error output and adjust its approach rather than repeating the same failed pattern.

With BYOK (bring your own key), you can test different models against your actual codebase to evaluate their recovery behavior. Some models handle failures gracefully; others loop. Roo Code lets you swap models without changing your workflow, so you can find the one that recovers best for your specific use cases.

**The key insight for production workflows: an agent that closes the loop treats failures as feedback, not as templates to repeat.**

## Comparing model evaluation approaches

| Dimension            | Raw success rate focus     | Recovery-aware evaluation                    |
| -------------------- | -------------------------- | -------------------------------------------- |
| Primary metric       | Task completion percentage | Task completion plus failure behavior        |
| Failure handling     | Not measured               | Explicit test cases for recovery             |
| Token efficiency     | Ignored                    | Tracks cost of failure loops                 |
| Wall-clock time      | Ignored                    | Measures time to resolution or escalation    |
| Production readiness | Misleading                 | Accurate predictor of real-world performance |

## Frequently asked questions

### Why do some models loop on failures instead of recovering?

Models learn patterns from their context window. When a failed tool call enters the context, some models treat it as a valid approach and repeat it. The failure becomes the new pattern. Models with better instruction-following and error parsing can recognize the failure as information to act on rather than a template to copy.

### How do I test a model's recovery behavior before deploying it?

Create test cases with intentional failure conditions: missing files, unexpected error formats, and misleading initial context. Run the model through these scenarios and observe whether it adjusts its approach after the first failure or loops on the same call. Count retries and measure time to recovery or escalation.

### Does Roo Code help with model recovery testing?

Roo Code's BYOK architecture lets you swap models without changing your workflow. You can run the same task against multiple models and compare their recovery behavior directly. Since Roo Code closes the loop by running commands and iterating on results, you can observe how different models handle failures in your actual development environment.

### Is a lower success rate acceptable if recovery is better?

Often yes. A model with 90% success and graceful failure handling may outperform a 95% success model that loops indefinitely on failures. The 5% failure loop can consume hours of time and significant token budget. Graceful degradation means failures resolve quickly or surface clearly for human intervention.

### What signals indicate a model is about to enter a failure loop?

Watch for repeated identical tool calls, especially after error responses. If you see the same file path, the same command, or the same API call appear multiple times with the same failure, the model has likely entered a loop. Early detection lets you intervene before the context window fills with repeated failures.
