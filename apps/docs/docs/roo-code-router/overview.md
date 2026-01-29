---
description: Roo Code Router is the easiest way to use Roo Code without additional accounts or managing API keys
keywords:
    - Roo Code Cloud
    - Roo Code Router
    - LLM
    - Models
---

# Roo Code Router Overview

To make it as smooth as possible to use Roo Code, which depends on a provider service for LLM inference, we've built the Roo Code Router.

You don't have to use our provider to use Roo Code (you can choose from dozens), but it's the easiest way to do it, since it only needs your Roo Code Cloud account and offers a selection of models we tested and approved to work with Roo Code:

- State of the art models from the top frontier labs (including Anthropic, OpenAI, Google, xAI, etc)
- Tested open weight models from upcoming labs (Moonshot AI, MiniMax, GLM, etc)

Since it's integrated into the Roo Code suite of products, you don't need to manage API keys to use it – just connect your account. With the [Team plan](/roo-code-cloud/team-plan), you can extend access to your entire team, ending the days of provider API keys flying around.

## Model Availability

Specific model availability changes over time. We strive to
keep the list relatively short, so you know you can trust
whatever you pick.

You can always find the current list [on our website](https://roocode.com/provider) or the Roo Code Cloud app, under ["Models"](https://app.roocode.com/models).

## Price and Privacy

We never use your data for training and don't keep logs of the prompts themselves
(keep in mind that if you use task sync or Cloud Agents, we have to keep
copies of your tasks for obvious reasons).

Sometimes stealth models are offered completely for free. These are
usually advanced models in late stages of testing, with code names and
limited availability. These models will most likely involve the use
of your prompts as training data, so be mindful of that when using.

Paid models most likely don't use any of your data for training, but it's always
best to check the privacy policy of the vendors themselves.

You can always find the current pricing [on our website](https://roocode.com/provider) or the Roo Code Cloud app, under ["Models"](https://app.roocode.com/models).

:::info Looking for free inference?
When you sign up for a Roo Code Cloud account, you'll be given a number of "Free Minutes" to try the product out (you'll see a cute gift box icon). Those free minutes cover both the [Cloud Agent](/roo-code-cloud/cloud-agents) run time _and_ inference via Roo Code Router (which, as we established, cost credits). Those can't be used in the extension.

If you want free inference in the extension, look for a free model when available (or use another provider which may offer it to you for free).
:::

## How to use it

### Roo Code Cloud Agents

When choosing a model to power your agent, just pick the Roo Code Router.
There aren't really any more instructions needed :)

### Roo Code VS Code Extension

Ensure you're logged into your Cloud account in the extension, and you'll
be able to configure Roo as a provider in Provider Settings.

### In 3rd-party tools

Since it's designed to make it easier to use Roo, we don't make the provider
available in other products. There's no API key for you to copy and use elsewhere.
