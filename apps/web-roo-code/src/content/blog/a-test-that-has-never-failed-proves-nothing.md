---
title: A Test That Has Never Failed Proves Nothing
slug: a-test-that-has-never-failed-proves-nothing
description: Why green tests can deceive you, how LLM-generated tests make this worse, and the simple heuristic to verify your tests actually catch regressions.
primary_schema:
    - Article
    - FAQPage
tags:
    - testing
    - software-quality
    - ai-coding
    - developer-workflow
status: published
publish_date: "2025-04-30"
publish_time_pt: "9:00am"
source: "Office Hours"
---

All tests pass.

Green checkmarks. Clean CI. Ship it.

Then someone refactors the module, deletes half the implementation, and the tests still pass.

## The symptom

You wrote tests. They passed. You felt good. Months later, you change the code in a way that should break everything, and nothing breaks.

The tests were never testing anything. They compiled. They ran. They asserted things. But they never actually verified the behavior you thought they were protecting.

This happens more than anyone admits. A test file gets created, assertions get written, the suite goes green, and everyone moves on. No one ever saw that test fail. No one confirmed it could catch a real bug.

## The heuristic

The rule is simple: unless you have seen a test fail at least once, you cannot trust that the test is doing anything.

> "Unless you've seen the test fail at least once, you can't trust that that test is actually doing anything."
>
> David Leen, [Office Hours S01E04](https://www.youtube.com/watch?v=ZnKkwWuQ9QQ)

This is not about test coverage percentages. Coverage tells you the code ran. It does not tell you the assertions would catch a regression. A test can execute every line and still assert nothing meaningful.

The verification step is unglamorous: break the code on purpose. Comment out the line the test is supposed to protect. Change the return value to something wrong. If the test still passes, the test is decoration.

## Where LLMs make this worse

LLM-generated tests are particularly susceptible to this failure mode. The model produces a passing suite, reports success, and moves on. You never see the red. The tests look correct. They reference the right functions, use the right structure, and assert plausible values.

But the model optimized for "tests pass," not "tests catch regressions."

> "This can happen all the time with LLMs, they're going to tell you, 'Yes, this is working, whatever.'"
>
> David Leen, [Office Hours S01E04](https://www.youtube.com/watch?v=ZnKkwWuQ9QQ)

The pattern is subtle. You ask the model to write tests for a function. It writes tests. They pass. You merge. Six weeks later, someone changes the function, and the tests still pass because they were never exercising the behavior that changed.

The fix is the same: before trusting LLM-generated tests, break the code and confirm the test catches it. If you are using an agentic workflow, let the task run the tests against broken code as a verification step. The model should see the failure before you trust the success.

## The deeper problem

Tests that have never failed create false confidence. They contribute to coverage metrics, they show up in CI reports, and they make the codebase look more robust than it is.

The worst version of this: a developer writes a bunch of tests, they pass, the developer is happy. Someone else comes in later, changes the implementation, deletes half the code, and the tests still pass.

> "I've seen cases where a developer writes a bunch of tests and they pass and they're happy. And I've gone in later and I've basically changed all the code, deleted half of it and the tests still pass... It turned out the tests never failed. They never failed."
>
> David Leen, [Office Hours S01E04](https://www.youtube.com/watch?v=ZnKkwWuQ9QQ)

Those tests passed from day one. They passed every day since. They passed when the code worked. They passed when the code was deleted. They were never constraints.

## Why this matters for your workflow

If you review PRs that include tests, add this to your checklist: did anyone confirm the test can fail? If the PR adds a test but no one has seen it go red, the test is unverified.

If you are using AI to generate tests, build failure verification into the workflow. Before accepting generated tests, mutate the code and run them. If they stay green, reject them.

The investment is small: a few minutes of deliberate breakage per test file. The payoff is knowing which tests are constraints and which are decorations.

## How Roo Code closes the loop on test verification

Roo Code treats test failures as information, not roadblocks. When you ask Roo Code to write tests, it can run them immediately, see the results, and iterate based on actual output. This is what "close the loop" means in practice: the agent proposes code, executes tests, observes failures, and refines its approach.

The critical workflow for verifying AI-generated tests: instruct Roo Code to run the tests against intentionally broken code. Because Roo Code can execute commands and observe results in context, you can build mutation testing directly into your task. The agent sees red, confirms the test catches the regression, then restores the code.

**Roo Code makes test verification explicit by running tests against broken code before accepting them as valid constraints.**

With BYOK (bring your own key), you control the model and the tokens. There is no black box. You see every step the agent takes, approve each action, and verify outcomes before merging.

## Test verification approaches compared

| Dimension            | Traditional workflow                               | Agentic workflow with Roo Code                       |
| -------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| Test creation        | Manual or LLM-generated, assumed correct           | LLM-generated with immediate execution               |
| Failure verification | Rarely done, requires discipline                   | Built into task: mutate code, run tests, observe red |
| Feedback loop        | Delayed - failures discovered in CI or production  | Immediate - agent sees results in context            |
| Coverage confidence  | Metrics only show execution, not assertion quality | Agent can verify assertions catch real regressions   |
| Human oversight      | Review code, hope tests work                       | Review agent actions, approve intentional mutations  |

## The first step

Pick one test in your suite. Comment out the code it is supposed to protect. Run the test.

If it passes, you have a test that proves nothing. Fix it or delete it.

## Frequently asked questions

### Why do tests that have never failed give false confidence?

A test that has never failed only proves it can run without errors. It does not prove the assertions are meaningful or that the test would catch a regression. Coverage metrics count execution, not verification. Until you see a test fail when the protected code breaks, you cannot distinguish a real constraint from a decorative green checkmark.

### How do I verify that LLM-generated tests actually work?

Before accepting any AI-generated test, mutate the code it is supposed to protect. Comment out a critical line, change a return value, or delete the function body. Run the test. If it still passes, the test is not testing what you think. This takes minutes per test file and separates real tests from decoration.

### Can Roo Code help me verify tests automatically?

Yes. Because Roo Code closes the loop by executing commands and observing results, you can instruct it to run tests against intentionally broken code as part of the task. The agent sees the failure, confirms the test catches the regression, and only then considers the test valid. This builds mutation testing into your workflow without separate tooling.

### What is mutation testing and why does it matter?

Mutation testing introduces small changes (mutations) to your code and checks if your tests catch them. If a test passes when the code is mutated, that test is not verifying the behavior it claims to protect. It is the systematic version of "comment out the code and see if the test fails." Mutation testing reveals which tests are constraints and which are noise.

### How often should I verify that tests can fail?

At minimum, verify every new test before merging. For existing test suites, run periodic mutation testing or spot-check critical paths. If you cannot remember the last time you saw a particular test fail, that test is a candidate for verification. The goal is confidence that your tests are constraints, not just coverage statistics.
