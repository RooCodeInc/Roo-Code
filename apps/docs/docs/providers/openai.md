---
sidebar_label: OpenAI
description: Connect Roo Code to OpenAI's official API for access to GPT and reasoning models with advanced capabilities and verbosity control.
keywords:
    - OpenAI
    - GPT models
    - reasoning models
    - Roo Code
    - AI integration
    - API key
    - official OpenAI API
    - verbosity
    - reasoning effort
---

# Using OpenAI With Roo Code

Roo Code supports accessing models directly through the official OpenAI API, including the latest GPT-5 family with advanced features like reasoning effort control and verbosity settings.

:::info Want to use a ChatGPT Plus/Pro subscription instead?
Use the **OpenAI – ChatGPT Plus/Pro** provider to sign in via OAuth (no API key): [OpenAI – ChatGPT Plus/Pro](/providers/openai-chatgpt-plus-pro).
:::

**Website:** [https://openai.com/](https://openai.com/)

---

## Getting an API Key

1.  **Sign Up/Sign In:** Go to the [OpenAI Platform](https://platform.openai.com/). Create an account or sign in.
2.  **Navigate to API Keys:** Go to the [API keys](https://platform.openai.com/api-keys) page.
3.  **Create a Key:** Click "Create new secret key". Give your key a descriptive name (e.g., "Roo Code").
4.  **Copy the Key:** **Important:** Copy the API key _immediately_. You will not be able to see it again. Store it securely.

---

## Available Models

Roo Code supports all models available through OpenAI's API.

For the complete, up-to-date model list and capabilities, see [OpenAI's models documentation](https://platform.openai.com/docs/models).

---

## Configuration in Roo Code

### Setup

1.  **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2.  **Select Provider:** Choose "OpenAI" from the "API Provider" dropdown.
3.  **Enter API Key:** Paste your OpenAI API key into the "OpenAI API Key" field.
4.  **Select Model:** Choose your desired model from the "Model" dropdown.
5.  **(Optional) Base URL:** If you need to use a custom base URL, enter the URL. Most people won't need to adjust this.

---

## Advanced Features

### Reasoning Effort Control

For models that support reasoning (GPT-5, o1, o3, o4 families), you can control how deeply the model thinks:

**GPT-5 Models:**

- `minimal` - Fastest responses with basic reasoning
- `low` - Quick responses with light reasoning
- `medium` (default) - Balanced reasoning and response time
- `high` - Deep reasoning for complex problems

**o1/o3/o4 Models:**

- `low` - Minimal thinking time
- `medium` - Balanced approach
- `high` - Maximum thinking for complex problems

Some models have preset reasoning levels that cannot be changed.

### Verbosity Control

Available for GPT-5 models and select others, verbosity controls the detail level of responses:

- `low` - Concise, direct responses
- `medium` (default) - Balanced detail
- `high` - Comprehensive, detailed responses

### Temperature Settings

Temperature controls output randomness (0.0 to 2.0):

- **GPT-5 models:** Default 1.0 for balanced creativity
- **Other models:** Default 0.0 for deterministic output
- **Note:** Not available for o1/o3 reasoning models

### Conversation Continuity (GPT-5)

GPT-5 models maintain conversation context efficiently through response IDs, reducing token usage while preserving context. This happens automatically - no configuration needed.

---

## Tips and Notes

- **Pricing:** Refer to the [OpenAI Pricing](https://openai.com/pricing) page for current model costs and discounts, including prompt caching.
- **Azure OpenAI Service:** If you'd like to use the Azure OpenAI service, please see our section on [OpenAI-compatible](/providers/openai-compatible) providers.
- **Context Optimization:** For GPT-5-Codex, leverage prompt caching by maintaining consistent context across requests to reduce costs significantly.
