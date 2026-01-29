---
sidebar_label: Connecting To AI Provider
description: Learn how to connect Roo Code to AI providers like Anthropic Claude, OpenAI, and OpenRouter. Step-by-step guide for API key setup and configuration.
keywords:
    - Roo Code API key
    - Claude API
    - OpenAI API
    - OpenRouter
    - Anthropic API
    - AI provider setup
    - API configuration
---

import KangarooIcon from '@site/src/components/KangarooIcon';

# Connecting Your First LLM Provider

Roo Code needs an inference provider to access the LLM models that make it work.

A great model to start is **Claude Sonnet 4.5**, which offers a lot of power at a reasonable price point. To get it going, choose a provider:

- **Roo Code Router (Recommended):** the easiest way to access multiple providers tested with Roo Code. No API needed. To get started, just choose Roo Code Router as a provider and follow instructions. [Learn more about it](/roo-code-router/overview).

- **OpenRouter:** Provides access to multiple AI models from different labs through a single API key. Great for flexibility and getting started reasonably fast. To get an API key, [follow these instructions <LucideIcon name="ArrowRight" />](/providers/openrouter#getting-an-api-key)

- **Anthropic:** Direct access to the Claude family of models. Requires API access approval and may have [rate limits depending on your tier](https://docs.anthropic.com/en/api/rate-limits#requirements-to-advance-tier). To get an API key, [follow these instructions <LucideIcon name="ArrowRight" />](/providers/anthropic#getting-an-api-key)

Roo Code is compatible with [other providers](/providers) which offer Claude, and with a wide range of different models you can try.

:::info Model Selection Advice
We recommend **Claude Sonnet 4.5** because it "just works" out of the box for most tasks. We use it internally a lot.

You can choose other models, but that introduces complexity. Different models vary in how they follow tool instructions, parse formats, and maintain context through multi-step operations, so it may be better to try them later. If you do experiment with other models, choose ones specifically designed for structured reasoning and tool use.
:::

---

## Configuring the provider in VS Code

1. Open the Roo Code panel by clicking the Roo Code icon (<KangarooIcon />) in the VS Code Activity Bar
2. In the welcome screen, choose your LLM provider.
3. If you choose the Roo Code Router, just connect your account and choose `anthropic/claude-sonnet-4-5` from the dropdown. You're set.
4. If you chose another provider, paste the API key you copied from it into the right field and continue
5. Select your model (it should be called `claude-sonnet-4-5` or `anthropic/claude-sonnet-4-5`) and complete the process.

Now you can start coding!
