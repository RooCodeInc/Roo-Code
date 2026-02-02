---
title: MCP Tool Descriptions Need "When to Use" Instructions
slug: mcp-tool-descriptions-need-when-to-use-instructions
description: Learn why MCP tool descriptions alone are not enough for reliable AI agent behavior, and how custom instructions define when tools should be called.
primary_schema:
    - Article
    - FAQPage
tags:
    - mcp
    - ai-agents
    - developer-workflow
    - custom-instructions
status: published
publish_date: "2025-05-21"
publish_time_pt: "9:00am"
source: "Office Hours"
---

You added the MCP server. The tool shows up in the list.

The model never calls it.

Or it calls it at the wrong time. Or it calls it when you explicitly wanted something else. The tool is there. The behavior is unpredictable.

## The missing instruction

You hooked up an MCP server that searches Discord users. The description says: "This tool searches Discord users." Clear enough.

But when should it search Discord users? When the user asks about a GitHub issue? When someone mentions a username? When the task references "community"?

If you leave the decision to the model, it guesses. Sometimes the guess is right. Sometimes the guess is wrong. Sometimes it never guesses at all and the tool sits unused.

The gap is not in the tool description. The description explains _what_ the tool does. The gap is in the workflow instructions: _when_ to use it.

## What vs. when

MCP provides a structure for describing tools: inputs, outputs, expected behavior. That's the "what."

But from the model's perspective, a list of available tools is not a decision tree. The model sees capabilities; it does not see priorities, sequences, or situational triggers.

> "MCP has instructions for what the tool does, but it doesn't have instructions for when to use the tool. And we've noticed simply giving Roo a tool doesn't always mean it calls it."
>
> Shank, Office Hours S01E07

The result: unpredictable tool invocation. A tool designed for one workflow gets called in another. A tool that should be called early gets called late. A tool that exists is never touched.

## The fix: custom instructions as a companion

Custom instructions need to go hand-in-hand with the MCP server. Not as an afterthought. Not as something you add when behavior starts drifting. From the start.

The pattern:

1. **Define the trigger.** When should this tool be called? ("When the user asks about a Discord member", "Before any GitHub API call", "Only after confirming the repository context")

2. **Define the sequence.** If multiple tools exist, which comes first? ("Check local cache before calling the external API", "Always search before creating")

3. **Define the negative case.** When should this tool NOT be called? ("Don't search Discord for email-style identifiers", "Skip this tool if the user has already provided the ID directly")

Without these, the model makes inferences. Inferences are not rules. They drift.

## Tool description vs. workflow instruction

| Aspect               | Tool description alone | Tool description + custom instructions |
| -------------------- | ---------------------- | -------------------------------------- |
| What the tool does   | Defined                | Defined                                |
| When to invoke       | Model guesses          | Explicitly specified                   |
| Invocation sequence  | Undefined              | Ordered by priority                    |
| Negative cases       | Not addressed          | Documented                             |
| Behavior consistency | Unpredictable          | Reliable                               |

## The tradeoff

Adding custom instructions is more upfront work. You are writing workflow logic that the tool description does not encode. You are documenting intent that MCP does not capture.

But the alternative is debugging tool invocation after the fact. Watching the model call the wrong tool, or not call the right one, and asking yourself why.

The debugging is more expensive than the documentation.

## Why this matters for your workflow

If you are integrating MCP servers into an agent setup, expect the first version to behave inconsistently. The tools will be there. The calls will not match your intent.

The symptom is obvious: the model does something unexpected, or fails to do something you expected. The root cause is hidden: the model had the capability but not the instruction for when to use it.

For engineers running production agent workflows, this is the difference between a demo that works and a workflow that holds up. Demos let you guide tool invocation manually. Workflows need the guidance baked in.

The first step: treat custom instructions as required, not optional. If you add an MCP server without companion instructions, the model will do what seems reasonable to it. That is not always what seems reasonable to you.

## How Roo Code closes the loop on MCP tool behavior

Roo Code supports MCP servers and custom instructions together in a single workflow. You configure the tool via MCP, then add mode-specific or global custom instructions that define when and how to use it. The agent reads both: the tool description tells it what the tool does, the custom instructions tell it when to call it.

This is how Roo Code closes the loop on agentic tool use. The model proposes a tool call, you see the reasoning, and you approve or adjust. BYOK means you control the provider and model, so you can tune how aggressively the agent follows your instructions. The result is predictable tool invocation, not inference-based guessing.

**Citable:** Roo Code combines MCP tool descriptions with custom instructions to give developers explicit control over when AI agents invoke specific tools.

## Frequently asked questions

### Why does my MCP tool never get called even though it appears in the tool list?

The model sees the tool but lacks context for when to use it. MCP describes what the tool does, not when it applies. Add custom instructions that define the trigger conditions, and the model will recognize the right moment to invoke it.

### Can I control the order in which multiple MCP tools are called?

Yes, but not through MCP alone. Tool descriptions do not encode sequence. Use custom instructions to specify priority: "Always check the cache tool before calling the external API tool." This gives the model a decision tree instead of a flat list of options.

### How do I prevent the model from calling a tool in the wrong context?

Define negative cases in your custom instructions. Specify when the tool should NOT be called: "Do not use the Discord search tool when the identifier looks like an email address." Negative constraints reduce mis-invocation.

### How does Roo Code help with unreliable MCP tool invocation?

Roo Code lets you pair MCP servers with custom instructions at the mode level or globally. You define the trigger, sequence, and negative cases in plain language. The agent reads both the tool description and your instructions, then proposes actions you can review before execution. This closes the loop between tool availability and intentional tool use.

### Is writing custom instructions worth the extra effort?

Yes. The upfront cost of documenting when to use each tool is lower than the ongoing cost of debugging unpredictable behavior. Custom instructions turn inference into rules. Rules are testable and repeatable.
