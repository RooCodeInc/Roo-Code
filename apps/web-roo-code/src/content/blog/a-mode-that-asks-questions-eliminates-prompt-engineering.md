---
title: A Mode That Asks Questions Eliminates Prompt Engineering
slug: a-mode-that-asks-questions-eliminates-prompt-engineering
description: Learn how building a custom mode that asks questions instead of waiting for perfect prompts eliminates prompt engineering and extracts the context your AI coding agent needs through conversation.
primary_schema:
    - Article
    - FAQPage
tags:
    - custom-modes
    - prompt-engineering
    - workflow
    - roo-code
status: published
publish_date: "2025-07-23"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

You do not have to write the perfect prompt.

You have to answer questions.

## The prompt engineering trap

You open VS Code. You need to implement a new feature. You stare at the chat input, trying to figure out how to describe what you want in enough detail that the model will not go off in some random direction.

Where should the file go? What naming conventions does your codebase use? Are there existing patterns you want to follow? What edge cases matter?

You know all of this. But translating it into a single, comprehensive prompt feels like writing a spec document before you can start coding.

So you write something vague. The model makes assumptions. You correct it. It makes different assumptions. Three prompts later, you are debugging the prompt instead of the code.

## The interrogation pattern

There is another approach: build a mode that asks you questions instead of waiting for you to think of everything upfront.

You say "I need to implement this feature." The mode asks where you want it. You answer. It asks how it should look. You answer. It asks what constraints apply. You answer.

When you are done, the mode has all the context it needs. Not because you wrote a perfect prompt, but because the interrogation process surfaced requirements you did not think to specify.

> "Something that asks you questions eliminates the need for prompt engineering completely, because the mode already has all the context it needs from you just by asking you questions."
>
> Guest, [Roo Cast S01E02](https://www.youtube.com/watch?v=Hjw7rUlGLPs&t=1365)

This works because humans are better at answering questions than writing comprehensive specifications. You know what you want when someone asks you directly. You do not always know what details are relevant until someone prompts you for them.

## How the mode works

The pattern is straightforward. You create a custom mode in Roo Code that does not have access to code tools. It can only ask questions and, when it has enough context, delegate to another mode that can actually make changes.

> "I had a mode that I called chat mode. Basically, it did sort of the same thing. It didn't have access to code tools at all, so it really needed to use the orchestrator tool, the new task tool, but the mode would ask me questions about anything."
>
> Guest, [Roo Cast S01E02](https://www.youtube.com/watch?v=Hjw7rUlGLPs&t=1249)

The constraint is the feature. Because the mode cannot touch code, it has to gather information. It cannot skip ahead and make assumptions.

## The tradeoff

This adds a conversation step before any code gets written. If you already know exactly what you want and can articulate it precisely, the interrogation phase is overhead.

But if you are implementing something new, something where the requirements are fuzzy or the codebase context matters, the upfront conversation pays for itself. You spend two minutes answering questions instead of twenty minutes correcting wrong assumptions.

## Why this matters for your team

For a five-person team shipping features across an unfamiliar codebase, the "lazy prompt" problem compounds. Each developer hits the same friction: they know what they want but struggle to express it in a way the model understands without context.

A questioning mode inverts the burden. Instead of requiring everyone to become prompt engineers, you build a mode that extracts the relevant context through conversation. Junior developers get the same quality of context-aware suggestions as seniors who have internalized every folder structure and naming convention.

> "A mode that gets information from you, because sometimes you're lazy or you don't know exactly what you want, a mode that can ask you relevant questions is really, really useful when you're trying to implement something new."
>
> Guest, [Roo Cast S01E02](https://www.youtube.com/watch?v=Hjw7rUlGLPs&t=1353)

The shift is from "write a better prompt" to "answer questions until the mode knows enough." The second one scales across skill levels.

## How Roo Code enables the interrogation pattern

Roo Code's custom modes let you build specialized workflows that close the loop between gathering context and taking action. A questioning mode works by restricting tool access so the agent must ask before it acts, then delegating to Code mode or Architect mode once it has gathered sufficient context.

This pattern leverages BYOK (bring your own key) to keep costs predictable while you iterate through the question-and-answer phase. Because Roo Code runs locally in VS Code and you control your API keys, the conversation overhead does not create hidden token markup or vendor lock-in.

**The key insight: custom modes turn prompt engineering from a user skill into a system design choice.** Instead of training your team to write better prompts, you build modes that extract the information they already know through targeted questions.

## Prompting approach comparison

| Dimension            | Traditional prompting                        | Questioning mode                             |
| -------------------- | -------------------------------------------- | -------------------------------------------- |
| Who provides context | User writes comprehensive prompt upfront     | Mode asks targeted questions                 |
| Skill dependency     | Requires prompt engineering expertise        | Requires only domain knowledge               |
| Error correction     | Fix assumptions after code is generated      | Surface requirements before code is written  |
| Context completeness | Often incomplete, leading to iteration loops | Systematically gathered through conversation |
| Team scalability     | Quality varies by individual prompt skill    | Consistent quality across skill levels       |

## Start here

If your team keeps hitting the "wrong assumptions" loop, build a questioning mode. Remove the code tools. Force it to ask before it acts.

The upfront conversation is not overhead. It is the prompt you did not know you needed.

## Frequently asked questions

### What is a questioning mode in Roo Code?

A questioning mode is a custom mode configured without access to code editing tools. Because it cannot modify files directly, it must gather context by asking you questions before delegating the actual implementation to another mode like Code or Architect. This forces thorough context gathering before any changes are made.

### How do I create a custom mode that only asks questions?

In Roo Code, create a new custom mode and remove all file editing and command execution tools from its allowed tools list. Keep only the ability to read files and spawn new tasks. Add system instructions telling the mode to gather requirements through questions before delegating to a mode with implementation capabilities.

### Does the questioning phase slow down development?

For well-defined tasks where you can articulate requirements precisely, yes. But for new features, unfamiliar codebases, or fuzzy requirements, the two minutes spent answering questions prevents the twenty-minute correction loop that happens when the model makes wrong assumptions.

### Can this pattern work with any AI coding tool?

The pattern of asking before acting is universal, but executing it requires a tool that supports custom modes with restricted tool access and multi-mode delegation. Roo Code provides this through its custom modes system and the new task tool that allows one mode to hand off to another.

### How does this help teams with mixed experience levels?

Junior developers often struggle to write prompts that include all the context a senior developer would naturally include. A questioning mode levels the playing field by systematically extracting that context through conversation. The mode asks about folder structure, naming conventions, and patterns regardless of who is using it.
