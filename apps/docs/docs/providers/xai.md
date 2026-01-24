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

## Available Models

Roo Code supports all Grok models available through xAI's API.

For the complete, up-to-date model list and capabilities, see [xAI's documentation](https://docs.x.ai/docs).

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

Several Grok models have reasoning capabilities. However, only the Grok 3 Mini models support configurable reasoning effort control:

- `grok-3-mini` - Supports reasoning effort control
- `grok-3-mini-fast` - Supports reasoning effort control

Other models (`grok-code-fast-1`, `grok-4.1-fast`, `grok-4`, `grok-3`, `grok-3-fast`) are reasoning-capable but don't expose the `reasoning_effort` parameter.

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
