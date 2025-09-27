---
description: Configure xAI's Grok models in Roo Code. Access Grok-4, Grok-3, Grok-2, and vision models with large context windows, reasoning capabilities, and prompt caching.
keywords:
    - xAI
    - Grok
    - Roo Code
    - AI models
    - reasoning AI
    - vision models
    - large context
    - Grok Code Fast
    - Grok-4
    - Grok-3
    - Grok-2
    - prompt caching
image: /img/social-share.jpg
sidebar_label: xAI (Grok)
---

# Using xAI (Grok) With Roo Code

xAI is the company behind Grok, a large language model known for its conversational abilities and large context window. Grok models are designed to provide helpful, informative, and contextually relevant responses.

**Website:** [https://x.ai/](https://x.ai/)

---

## Getting an API Key

1.  **Sign Up/Sign In:** Go to the [xAI Console](https://console.x.ai/). Create an account or sign in.
2.  **Navigate to API Keys:** Go to the API keys section in your dashboard.
3.  **Create a Key:** Click to create a new API key. Give your key a descriptive name (e.g., "Roo Code").
4.  **Copy the Key:** **Important:** Copy the API key _immediately_. You will not be able to see it again. Store it securely.

---

## Supported Models

Roo Code supports the following xAI Grok models:

### Current Models

- `grok-code-fast-1` (Default) - xAI's Grok Code Fast model with 262K context window and prompt caching, optimized for reasoning and coding tasks
- `grok-4` - xAI's Grok-4 model with 262K context window, image support, and prompt caching
- `grok-3` - xAI's Grok-3 model with 128K context window and prompt caching
- `grok-3-fast` - xAI's Grok-3 fast model with 128K context window and prompt caching
- `grok-3-mini` - xAI's Grok-3 mini model with 128K context window, reasoning support, and prompt caching
- `grok-3-mini-fast` - xAI's Grok-3 mini fast model with 128K context window, reasoning support, and prompt caching
- `grok-2-1212` - xAI's Grok-2 model (version 1212) with 128K context window
- `grok-2-vision-1212` - xAI's Grok-2 Vision model (version 1212) with image support and 32K context window

:::info Grok Code Fast - Free Access in Roo Code
`grok-code-fast-1` is available for **free** through the [Roo Code Cloud provider](/providers/roo-code-cloud) during the promotional period. When using the xAI provider directly in Roo Code, standard pricing will apply once established. This model was previously known as "roo/sonic" and has been renamed. For free access within Roo Code, use the Roo Code Cloud provider instead of the xAI provider.
:::

---

## Configuration in Roo Code

1.  **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2.  **Select Provider:** Choose "xAI" from the "API Provider" dropdown.
3.  **Enter API Key:** Paste your xAI API key into the "xAI API Key" field.
4.  **Select Model:** Choose your desired Grok model from the "Model" dropdown.

---

## Reasoning Capabilities

Grok 3 Mini models feature specialized reasoning capabilities, allowing them to "think before responding" - particularly useful for complex problem-solving tasks.

### Reasoning-Enabled Models

Reasoning is only supported by:

- `grok-3-mini` - Supports reasoning effort control
- `grok-3-mini-fast` - Supports reasoning effort control

The standard Grok 3 models (`grok-3` and `grok-3-fast`) and Grok 4 do not support reasoning effort parameters.

### Controlling Reasoning Effort

When using reasoning-enabled models, you can control how hard the model thinks with the `reasoning_effort` parameter:

- `low`: Minimal thinking time, using fewer tokens for quick responses
- `high`: Maximum thinking time, leveraging more tokens for complex problems

Choose `low` for simple queries that should complete quickly, and `high` for harder problems where response latency is less important.

### Key Features

- **Step-by-Step Problem Solving**: The model thinks through problems methodically before delivering an answer
- **Math & Quantitative Strength**: Excels at numerical challenges and logic puzzles
- **Reasoning Trace Access**: The model's thinking process is available via the `reasoning_content` field in the response completion object

---

## Prompt Caching

Prompt caching is available for select Grok models including `grok-code-fast-1`, `grok-4`, `grok-3`, `grok-3-fast`, `grok-3-mini`, and `grok-3-mini-fast`. This feature can reduce costs and improve response times.

---

## Pricing

Pricing varies by model. Refer to the [xAI documentation](https://console.x.ai/) for current pricing information.

**Note:** `grok-code-fast-1` is available for free through the [Roo Code Cloud provider](/providers/roo-code-cloud) during the promotional period. Standard pricing will apply when using the xAI provider directly in Roo Code.
