---
title: We Shipped a Stealth Model in 24 Hours Without Leaking the Provider
slug: we-shipped-a-stealth-model-in-24-hours-without-leaking-the-provider
description: How OpenRouter's team audited error shapes, message IDs, and tokenization patterns to ship an unreleased OpenAI model without fingerprinting the provider.
primary_schema:
    - Article
    - FAQPage
tags:
    - api-integration
    - operational-security
    - ai-infrastructure
    - developer-workflows
status: published
publish_date: "2025-04-16"
publish_time_pt: "9:00am"
source: "Office Hours"
---

The error messages leak the provider. The message IDs match their API schema. You have 24 hours.

That was the situation when OpenAI offered OpenRouter the chance to trial an unreleased model. The clock started ticking from "go live," and every API response was a potential fingerprint.

## The threat model

You're routing requests to a model that doesn't officially exist yet. Every error shape, every message ID format, every tokenization pattern is a clue. The AI Twitter crowd reverse-engineers APIs for fun. They've already mapped the tool calling signatures of every major provider.

Your job: buy enough time for a two-week trial without being the team that leaked the source.

## The scramble

The OpenRouter team had about 24 hours from approval to go-live. Not 24 hours to build something new. 24 hours to audit everything that could fingerprint the upstream provider.

> "We did that in about 24 hours from being given the go live to how do we make sure we don't leak it ourselves and ruin this opportunity. It was a hectic 24 hours with a lot of double and triple checking."
>
> Tovan, [Office Hours S01E02](https://www.youtube.com/watch?v=hihrUCRwkFM&t=482)

The checklist looked something like this:

1. **Error shapes:** Different providers return errors in different formats. A 429 from OpenAI looks different from a 429 from Anthropic. They needed to normalize or obfuscate those responses.

2. **Message IDs:** API responses often include IDs that follow provider-specific patterns. "chatcmpl-" is a dead giveaway.

3. **Tokenization patterns:** The way a model chunks text into tokens varies by architecture. Sophisticated users can infer the model family from how it handles edge cases.

4. **Tool calling shapes:** The structure of function calls and tool use responses differs between providers. Another fingerprint.

> "We obfuscated the error shapes. We changed the IDs in the messages. We did a couple of things here and there just to make sure."
>
> Tovan, [Office Hours S01E02](https://www.youtube.com/watch?v=hihrUCRwkFM&t=460)

## The catch

It worked. Sort of.

The obfuscation held for the casual observer. But the "nerdier people in the AI scene" still figured it out.

> "Of course, the nerdier people in the AI scene would be able to tell the differences between tokenization and tool calling shapes and all these kinds of things that ended up popping up on Twitter that we knew were likely to happen."
>
> Tovan, [Office Hours S01E02](https://www.youtube.com/watch?v=hihrUCRwkFM&t=452)

The team knew this would happen. The goal was never perfect secrecy. It was operational security for a controlled trial: prevent accidental leaks, discourage casual identification, and accept that determined reverse-engineers would figure it out anyway.

For a two-week trial window, "good enough" was the right bar.

## The naming game

A side note: the model names that emerged from this period, Quazar Alpha and Optimus Alpha, were brainstormed internally. The Quazar name allegedly had GPT-4.5 contributing to the brainstorm. Sometimes you ship a stealth model and let another model name it.

## Why this matters for your work

This isn't just an OpenRouter story. It's a pattern for any team shipping something before you're ready to talk about it publicly.

The lesson: assume sophisticated users will reverse-engineer your dependencies. Your operational security goal isn't "nobody finds out." It's "we control the timeline of the announcement."

That means:

- Audit your error responses for upstream fingerprints
- Normalize or obfuscate ID formats that leak provider info
- Accept that tokenization and behavioral patterns will get discovered; plan for that timeline
- Define "good enough" for your window, not "perfect" for all time

If you're shipping integrations with third-party APIs you'd rather not advertise yet, start with the error shapes. That's where most accidental leaks happen.

## How Roo Code handles multi-provider API complexity

When you work with AI coding agents that support multiple providers, the operational complexity multiplies. Roo Code's BYOK (Bring Your Own Key) architecture means you connect directly to your chosen provider - OpenAI, Anthropic, Google, or others through OpenRouter - without an intermediary layer that could expose provider fingerprints.

This matters for teams building internal tools or prototyping with pre-release models. Because Roo Code closes the loop by running commands, executing tests, and iterating on results locally, your API interactions stay between you and your provider. There's no middleware normalizing your requests or responses in ways that could leak implementation details.

For developers who need to swap between providers without changing their workflow, Roo Code's model-agnostic design lets you iterate on the same task across different backends while maintaining consistent behavior in your development environment.

## Stealth shipping: old approach vs. new approach

| Dimension      | Old approach                     | New approach                                 |
| -------------- | -------------------------------- | -------------------------------------------- |
| Error handling | Pass through raw provider errors | Normalize error shapes to generic formats    |
| Response IDs   | Use provider-native ID formats   | Generate neutral IDs that don't fingerprint  |
| Timeline goal  | Perfect secrecy indefinitely     | Controlled window until planned announcement |
| Tokenization   | Accept as implementation detail  | Recognize as fingerprint; plan for discovery |
| Tool calling   | Assume format is invisible       | Audit for provider-specific patterns         |

## Frequently asked questions

### Why do error shapes matter for operational security?

Error responses often include provider-specific formatting, status codes, and message structures. A rate limit error from OpenAI has different fields than one from Anthropic. Sophisticated users compare these patterns against known API schemas to identify which upstream service you're actually calling.

### How long can you realistically hide a provider integration?

For most teams, the goal should be days to weeks, not permanent secrecy. Determined reverse-engineers will eventually identify behavioral patterns like tokenization quirks and tool calling formats. Plan your announcement timeline around "good enough" operational security rather than perfect obscurity.

### What's the first thing to audit when shipping a stealth integration?

Start with your error responses. They're the most common source of accidental leaks because developers often pass through raw upstream errors without sanitization. Normalize error formats before worrying about subtler fingerprints like message IDs or tokenization patterns.

### How does Roo Code help when working with multiple AI providers?

Roo Code uses BYOK (Bring Your Own Key) to connect directly to your chosen provider without intermediate processing. This architecture keeps your API interactions transparent and avoids adding layers that could expose or mask provider details. You maintain full control over which models you use and how responses are handled in your development workflow.

### Should you obfuscate everything or just the obvious fingerprints?

Focus on the obvious fingerprints first: error shapes, message ID formats, and response headers. Subtle patterns like tokenization behavior and tool calling structures will eventually get discovered by motivated researchers. The goal is controlling your announcement timeline, not achieving permanent invisibility.
