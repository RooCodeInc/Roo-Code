---
title: XML Tags May Be More Reliable Than Native Function Calling
slug: xml-tags-may-be-more-reliable-than-native-function-calling
description: Discover why XML tag-based tool definitions may outperform native function calling for AI agents, with practical guidance on when to swap formats for better reliability.
primary_schema:
    - Article
    - FAQPage
tags:
    - ai-agents
    - function-calling
    - prompt-engineering
    - tool-use
status: published
publish_date: "2025-04-22"
publish_time_pt: "9:00am"
source: "Office Hours"
---

The model called the tool. The tool returned nothing.

You check the logs. The function call looks fine. The schema is valid. The model just... didn't parse the response correctly.

## The format matters more than you think

You're building an agent. You wire up native function calling because that's the documented approach: define a JSON schema, the model returns structured JSON, you parse and execute.

It works. Until it doesn't.

The failure mode is subtle. The model calls the tool, but the arguments are slightly wrong. Or the model hallucinates a field that isn't in the schema. Or it calls the right tool with the wrong parameters, and you spend an hour debugging what looks like a model reasoning problem when it's actually a format problem.

Native function calling with structured JSON outputs should be the reliable path. It's what the API documentation recommends. It's what most tutorials show. But some practitioners are finding that an older approach holds up when native calls get flaky.

## The XML alternative

Cline uses XML tags to define tools instead of native function calling. Rather than relying on the model's built-in function calling capability, tools are defined using XML structure in the prompt itself.

The early feedback is that it works more reliably across different models.

> "Cline uses the XML tag style approach for defining tools. And so that seems to be a little bit more reliable than some of the other models that they've been experimenting with."
>
> Paige Bailey, [Office Hours S01E03](https://www.youtube.com/watch?v=rqMSBUSJos8&t=874)

Why would an older, seemingly "less native" approach work better? One hypothesis: XML tagging is a format the models have seen extensively in training data. The structure is unambiguous. Opening and closing tags create clear boundaries. The model doesn't have to switch between "reasoning mode" and "structured output mode" in the same way.

Native function calling asks the model to produce JSON that matches a schema while also reasoning about when and how to use the tool. XML tagging keeps everything in the same text stream. The model writes XML because it's writing text, not because it's switching to a special structured output mode.

## The tradeoff

XML tagging isn't universally better. Native function calling has real advantages: it's the documented API feature, it has better tooling support, and providers are actively improving it.

The tradeoff is reliability vs. ecosystem support. If you're using a single model from a single provider and native function calling works consistently, there's no reason to switch. If you're building an agent that needs to work across multiple models, or if you're seeing inconsistent tool use that you can't explain, the format is worth investigating.

> "I would be really curious to see if you've created benchmarks or eval showing different performance between using native function calling versus this XML tagging style and approach."
>
> Paige Bailey, [Office Hours S01E03](https://www.youtube.com/watch?v=rqMSBUSJos8&t=845)

The honest answer: the data is thin. Practitioners report better results with XML tagging, but rigorous benchmarks comparing the two approaches are rare. If you build one, that data would be useful to the community.

## Native function calling vs. XML tagging

| Dimension               | Native Function Calling                                           | XML Tagging                                         |
| ----------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| Cross-model reliability | Variable - depends on provider implementation                     | More consistent across different models             |
| Tooling support         | Strong - first-party SDKs and documentation                       | Manual - requires prompt engineering                |
| Debugging               | Opaque - errors happen inside the model's structured output layer | Transparent - tool calls visible in the text stream |
| Schema enforcement      | Strict - provider validates against schema                        | Flexible - parsing handled in your code             |
| Training data alignment | Newer convention, less represented in training corpora            | Extensively represented in training data            |

## How Roo Code handles tool format reliability

Roo Code closes the loop by letting the agent run tools, observe results, and iterate until the task is complete. This means tool reliability directly impacts task completion rates.

When you bring your own key (BYOK) and choose your preferred model, you're also choosing that model's function calling implementation. Some models handle native function calling well. Others don't. Rather than forcing you onto a single model that works with one format, Roo Code lets you swap providers and test which combination works best for your specific use case.

**The practical benefit**: if you're seeing tool call failures with one model, you can switch to another model without changing your workflow. The agent keeps closing the loop regardless of which format the underlying model prefers.

## Why this matters for your workflow

If you're debugging an agent and the tool calls keep failing in ways that don't make sense, you have two options. You can assume the model is the problem and try a different model. Or you can assume the format is the problem and try a different format.

The second option is cheaper and faster to test.

Swapping from native function calling to XML tagging is a prompt-level change. You can A/B test it on your existing eval suite without changing your model or your infrastructure. If the reliability improves, you've found your problem. If it doesn't, you've eliminated a variable.

## The concrete next step

If you're seeing inconsistent tool use: try swapping the format before assuming the model is the problem.

Define your tools with XML tags. Run your existing evals. Compare the success rates.

If you find a measurable difference, share the benchmark. The ecosystem needs more data on this.

## Frequently asked questions

### Why do XML tags work better than native function calling for some models?

XML tags appear extensively in model training data, making the format familiar and unambiguous. Opening and closing tags create clear boundaries that models parse reliably. Native function calling requires the model to switch between reasoning and structured output modes, which introduces additional failure points.

### When should I stick with native function calling?

If you're using a single model from a single provider and tool calls work consistently, native function calling is the right choice. It has better tooling support, first-party documentation, and providers are actively improving reliability. Only investigate XML tagging when you see unexplained tool call failures.

### How do I test XML tagging against native function calling?

Define your tools using XML structure in the prompt instead of the native function calling API. Run your existing evaluation suite against both approaches and compare success rates. This is a prompt-level change that doesn't require infrastructure modifications.

### Does Roo Code use XML tagging or native function calling?

Roo Code supports multiple providers through BYOK (bring your own key), which means the underlying tool format depends on which model you choose. This flexibility lets you test different models and find the combination that works most reliably for your specific tasks while the agent continues to close the loop on your behalf.

### Are there benchmarks comparing XML tagging vs. native function calling?

Rigorous public benchmarks are rare. Practitioners report anecdotal improvements with XML tagging, but the community needs more structured data. If you build comparison benchmarks, sharing that data would help others make informed decisions about tool format selection.
