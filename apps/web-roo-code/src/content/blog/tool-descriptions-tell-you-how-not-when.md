---
title: Tool Descriptions Tell You How, Not When
slug: tool-descriptions-tell-you-how-not-when
description: Learn why MCP tool descriptions explain mechanics but not workflow timing, and how to write rules files that tell AI agents when to invoke each tool.
primary_schema:
    - Article
    - FAQPage
tags:
    - mcp
    - agentic-workflows
    - prompt-engineering
    - tool-use
status: published
publish_date: "2025-07-16"
publish_time_pt: "9:00am"
source: "Office Hours"
---

```json
"tools": [{
  "name": "search_codebase",
  "description": "Searches the codebase for matching patterns"
}]

That description tells you what the tool does. It tells you nothing about when to call it.

## The gap

You add an MCP to your workflow. The tool descriptions are clear: this one reads files, that one queries your database, this one posts to Slack. The model knows how each tool works.

Then it calls the Slack tool in the middle of a debugging task. Or it ignores the codebase search entirely when context would have prevented a hallucination.

The model is not broken. The tool description did its job. The problem is that tool descriptions explain mechanics. They do not encode your workflow.

## Descriptions vs. decision criteria

Tool descriptions answer "how does this work?" They do not answer:

- At what stage of the task should this be invoked?
- What signals indicate this tool is the right choice?
- What should be tried first, and what is a fallback?
- When should this tool be skipped entirely?

> "Tool descriptions are not always enough. They tell you how the tool works, but they generally don't include when to use the tool. When to use the tool is very much dependent on the specific workflow and the MCP does not know the Roo Code workflow or your workflow."
>
> Hannes Rudolph, [Office Hours S01E14](https://www.youtube.com/watch?v=mi-3BxpZRgM)

The MCP author does not know your context. They cannot predict that you want the search tool invoked before any code generation, or that the Slack tool should only fire after a PR is merged, never during debugging.

## The fix: a rules file with tool use guidelines

The solution is explicit instructions that encode your workflow logic. A dedicated section in your rules file that specifies:

1. **Triggers:** What conditions indicate this tool should be invoked?
2. **Workflow stage:** At what point in a task sequence does this tool belong?
3. **Decision criteria:** How should the model choose between similar tools?
4. **Exclusions:** When should this tool be skipped even if technically applicable?

> "Building some, I guess, a rules file that has a section called tool use guidelines or MCP tool use... and then being very clear and doing some trial and error, that's the most effective way to get that MCP to work."
>
> Hannes Rudolph, [Office Hours S01E14](https://www.youtube.com/watch?v=mi-3BxpZRgM)

You can add these instructions to global settings or mode-specific configurations:

> "If you want to use an MCP natively into your workflow, basically you just have to create the instructions for it and you can add it to the global instructions or your mode instructions."
>
> Guest, [Office Hours S01E14](https://www.youtube.com/watch?v=mi-3BxpZRgM)

## Trial and error is part of the process

There is no universal template for MCP usage rules. Your workflow is specific. The model will get it wrong initially. The iteration looks like:

1. Add the MCP with default descriptions
2. Watch where it invokes tools at wrong moments (or ignores them)
3. Add a rule addressing that specific failure
4. Test again
5. Repeat until the tool invocation pattern matches your intent

This is not a bug in the system. It is the expected calibration process when integrating external tools into an agent workflow.

## Why this matters for your workflow

If you are adding MCPs without explicit usage rules, you are relying on the model to guess your workflow from tool descriptions alone. It will guess wrong in ways that are not obvious until you watch it run.

The time spent writing tool use guidelines is recovered quickly. A model that calls the right tool at the right stage completes tasks in fewer loops. The alternative is watching it invoke database queries before it has read the relevant code, or post to Slack before the fix is verified.

## How Roo Code closes the loop on tool orchestration

Roo Code's architecture enables precise control over when and how tools are invoked through its mode system and custom instructions. Because Roo Code closes the loop - proposing actions, executing them, and iterating based on results - you can observe exactly where tool invocation goes wrong and add corrective rules in real time.

With BYOK (Bring Your Own Key), you control the model and the instructions without platform lock-in. Your tool use guidelines live in your `.roo/` configuration, versioned alongside your code. When you add an MCP server to Roo Code, you write the workflow rules once and they apply across every task.

**Roo Code transforms MCP integration from guesswork into systematic calibration: watch the agent run, identify the tool timing failures, add rules to your modes, and iterate until invocation matches intent.**

## Tool description vs. workflow rule: comparison

| Dimension | Tool description alone | Tool description + workflow rules |
|-----------|----------------------|----------------------------------|
| What the model knows | Mechanics of the tool | Mechanics plus when to invoke |
| Invocation timing | Model guesses based on task text | Explicit triggers and stages |
| Fallback behavior | Undefined | Specified in rules |
| Exclusion conditions | None | When to skip even if applicable |
| Calibration process | Hope it works | Iterate until it matches intent |

## Start with one MCP

Pick the MCP that causes the most friction today. Write three lines of usage guidance: when to invoke, when to skip, and what to try first. Add it to your rules file. Run a task and see what changes.

The model learns from your instructions, not from the tool description alone. Tell it when.

## Frequently asked questions

### Why does my AI agent call the wrong tool even though the description is accurate?

Tool descriptions explain what a tool does, not when it belongs in your workflow. The model has no context about your preferred sequence, your triggers, or your exclusions. Without explicit workflow rules, it infers timing from task text alone and often guesses wrong.

### Where should I put MCP tool use guidelines in Roo Code?

Add them to your global instructions for rules that apply everywhere, or to mode-specific instructions for context-dependent behavior. In Roo Code, these live in your `.roo/` configuration directory and can be scoped to specific modes like Code, Debug, or Architect.

### How many rules do I need to write for each MCP tool?

Start with three: when to invoke, when to skip, and what to try first. Most tool timing problems resolve with these basics. Add more rules only when you observe specific failure patterns during task execution.

### Is trial and error the only way to calibrate MCP tool timing?

Yes, because your workflow is unique. The MCP author cannot anticipate your task sequences or decision criteria. The calibration loop - run, observe, add rule, repeat - is the expected process for integrating external tools into any agentic workflow.

### Can I share my tool use guidelines with my team?

Absolutely. Because Roo Code stores instructions in your `.roo/` directory, you can version control your tool use guidelines alongside your codebase. Every team member gets the same calibrated MCP behavior without individual setup.

```
