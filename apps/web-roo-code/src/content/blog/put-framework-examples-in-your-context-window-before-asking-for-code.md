---
title: Put Framework Examples in Your Context Window Before Asking for Code
slug: put-framework-examples-in-your-context-window-before-asking-for-code
description: Learn why AI coding assistants default to popular frameworks and how providing concrete code examples in your context window steers output toward your actual stack.
primary_schema:
    - Article
    - FAQPage
tags:
    - prompt-engineering
    - context-window
    - frameworks
    - ai-coding
status: published
publish_date: "2025-04-22"
publish_time_pt: "9:00am"
source: "Office Hours"
---

You ask for Next.js.

You get Create React App.

Every. Single. Time.

## The default trap

You're building a Next.js app with the app router. You've been explicit about it in your prompts. "Next.js 14, app router, server components." The model nods, generates code, and hands you a Create React App scaffold with client-side routing.

You try again. You add "NOT Create React App." You add "I repeat: Next.js." You're now three prompts deep, manually rewriting the generated code to match your actual stack.

The model isn't broken. It's defaulting to its training distribution. And its training distribution has a lot of Create React App.

## The fix is in the context window

You have two options here. One is expensive: fine-tune the model to reliably produce your framework of choice.

The other is free: show it what you want.

> "Don't underestimate the value of just putting things into the context window and showing the model examples."
>
> Paige Bailey, [Office Hours S01E03](https://www.youtube.com/watch?v=rqMSBUSJos8)

Before you ask for code, paste two examples of the kind of app you're building. Not documentation links. Actual code. The file structure you expect. The patterns you follow. The imports that signal your framework.

The prompt becomes something like:

Hey, here are two examples of the kinds of apps
that I'm trying to build.

[paste example 1]
[paste example 2]

Now please generate an app that does this particular task.

Models are pattern-matchers. If the pattern is in the context, the output follows. If the pattern isn't there, the model falls back to whatever showed up most often in its training data.

## Why this works

Context windows are large now. Gemini, Claude, GPT-4: all of them can hold substantial code samples alongside your request. The constraint isn't capacity; it's whether you're using that capacity to steer or just to ask.

Most prompts are "here's what I want, go." The model guesses based on keywords. If "React" is in your prompt, it picks the most common React pattern it knows.

When you include examples, you're not asking the model to guess. You're showing it the answer format before the question. The model completes the pattern rather than inventing one.

This works for:

- Framework-specific code (Next.js vs. Create React App vs. Remix)
- Coding style (your team's conventions vs. generic tutorials)
- File organization (monorepo structure, naming conventions)
- API patterns (REST vs. GraphQL, specific libraries)

## The tradeoff

You're spending context tokens on examples before you even ask your question. If you're running a tight budget, those tokens add up.

The math: tokens upfront vs. iterations later.

For straightforward requests where the framework is unambiguous, skip the examples. For anything where you've been fighting the model's defaults, the upfront tokens usually cost less than three failed prompts and the time spent rewriting output.

> "If you want it to be able to reliably generate other kinds of web applications, something that is more Next.js specific or another framework, then you might need to fine-tune it to be excellent at producing that kind of code."
>
> Paige Bailey, [Office Hours S01E03](https://www.youtube.com/watch?v=rqMSBUSJos8)

Fine-tuning is the heavy solution. Context window steering is the lightweight one. For most individual developers and small teams, lightweight wins.

## Why this matters for your workflow

If you're shipping production code and the model keeps generating the wrong framework, you're spending time on translation instead of building. Every "fix the imports" and "restructure this to app router" is friction that should have been avoided.

For an engineer building three features this week, that friction compounds. The model generates, you rewrite, you prompt again, it drifts, you rewrite again.

Dropping two examples into context before asking eliminates the guessing. The model sees the pattern, matches it, and stays in your stack.

## The rule

If your generated code keeps coming out in the wrong framework, stop adding negative constraints. Stop writing "NOT Create React App."

Show the model what you want. Paste two examples. Let the context window do the steering.

The model follows patterns. Give it one.

## How Roo Code closes the loop with context-aware generation

Roo Code is an AI coding agent that closes the loop - it can propose diffs, run commands and tests, and iterate based on the results. This agentic workflow changes how context steering plays out in practice.

When you configure Roo Code with custom instructions and workspace context, you're not manually pasting examples into every prompt. The agent maintains awareness of your project structure, your existing code patterns, and your framework choices. It reads your actual files before generating new ones.

**The key advantage:** Roo Code operates with BYOK (bring your own key), meaning you spend tokens intentionally for outcomes rather than paying for guesswork. When the agent can see your `app/` directory with Next.js app router conventions, it doesn't hallucinate Create React App patterns. It matches what's already there.

This is context window steering automated at the workflow level - the agent inspects, generates, runs tests, and iterates until the output fits your stack.

## Context steering approaches compared

| Dimension          | Manual prompting         | Example pasting                    | Agentic workflow (Roo Code)       |
| ------------------ | ------------------------ | ---------------------------------- | --------------------------------- |
| Context accuracy   | Low - relies on keywords | Medium - requires manual selection | High - reads actual project files |
| Token efficiency   | Wasted on iteration      | Upfront cost for examples          | Intentional spend with BYOK       |
| Framework drift    | Common across prompts    | Reduced within session             | Minimal - agent maintains context |
| Iteration handling | Manual rewrite cycle     | Fewer iterations needed            | Automated run-test-iterate loop   |
| Setup effort       | None                     | Moderate - curating examples       | One-time configuration            |

## Frequently asked questions

### Why does the AI keep generating the wrong framework even when I specify it?

Large language models default to their training distribution. If Create React App appears more frequently in training data than Next.js app router patterns, the model gravitates toward the common case unless you provide stronger signals. Keywords alone often aren't enough to override statistical defaults.

### How many example files should I include in my context window?

Two well-chosen examples typically suffice. Pick files that demonstrate your framework's distinctive patterns - the imports, file structure, and conventions that differentiate it from alternatives. More examples help for complex or unusual setups, but diminishing returns set in quickly.

### Does this approach work for languages and frameworks beyond React?

Yes. Context window steering works for any domain where the model might default to a more common pattern: Python web frameworks (Django vs. FastAPI), CSS approaches (Tailwind vs. vanilla), testing libraries, API styles, and language-specific idioms. The principle is universal.

### How does Roo Code handle framework context differently than chat-based tools?

Roo Code operates as an agentic coding assistant that reads your workspace files directly, maintaining awareness of your project's actual structure and patterns. Instead of requiring you to paste examples into each prompt, the agent inspects your codebase, generates code that matches existing conventions, runs tests to verify correctness, and iterates based on results. This closes the loop automatically rather than requiring manual correction cycles.

### When should I skip example pasting and just prompt directly?

Skip examples when your request is unambiguous and framework-agnostic, when the model has consistently produced correct output for similar requests, or when you're prototyping and don't care about matching production conventions. For anything touching your real codebase where framework accuracy matters, the upfront token cost of examples pays for itself.
