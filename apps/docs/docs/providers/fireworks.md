---
sidebar_label: Fireworks AI
description: Use Fireworks AI with Roo Code to access state-of-the-art open-source and proprietary AI models like Kimi, Qwen, and DeepSeek on a high-performance platform with large context windows up to 256K tokens.
keywords:
    - fireworks ai
    - fireworks
    - kimi models
    - kimi k2
    - qwen models
    - qwen3
    - deepseek models
    - deepseek
    - roo code
    - api provider
    - ai models
    - language models
    - llm api
    - open source models
    - serverless models
    - openai compatible
image: /img/social-share.jpg
---

# Using Fireworks AI With Roo Code

Fireworks AI is a high-performance platform for running AI models, offering fast, cost-effective access to a wide range of state-of-the-art open-source language models. Built for speed and reliability, Fireworks AI provides serverless deployment options with OpenAI-compatible APIs and context windows up to 256,000 tokens.

**Website:** [https://fireworks.ai/](https://fireworks.ai/)

---

## Getting an API Key

1. **Sign Up/Sign In:** Go to [Fireworks AI](https://fireworks.ai/) and create an account or sign in.
2. **Navigate to API Keys:** After logging in, go to the [API Keys page](https://app.fireworks.ai/settings/users/api-keys) in the account settings.
3. **Create a Key:** Click "Create API key" and give your key a descriptive name (e.g., "Roo Code").
4. **Copy the Key:** Copy the API key _immediately_ and store it securely. You will not be able to see it again.

---

## Supported Models

Fireworks AI offers several high-performance models:

### Kimi K2

- `accounts/fireworks/models/kimi-k2-instruct` (Default)
    - 1 trillion total parameters with 32B activated params
    - 128K context window
    - Optimized for agentic capabilities
    - $0.60/M input, $2.50/M output

### Qwen3 Series

- `accounts/fireworks/models/qwen3-235b-a22b-instruct-2507`

    - 256K context window
    - Competitive with closed-source models
    - $0.22/M input, $0.88/M output

- `accounts/fireworks/models/qwen3-coder-480b-a35b-instruct`
    - 256K context window
    - Specialized for coding tasks
    - $0.45/M input, $1.80/M output

### DeepSeek Series

- `accounts/fireworks/models/deepseek-r1-0528`

    - 160K context window
    - Advanced reasoning with reduced hallucination
    - Function calling support
    - $3.00/M input, $8.00/M output

- `accounts/fireworks/models/deepseek-v3`
    - 128K context window
    - 671B total parameters with 37B activated
    - $0.90/M input, $0.90/M output

---

## Configuration in Roo Code

1. **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2. **Select Provider:** Choose "Fireworks AI" from the "API Provider" dropdown.
3. **Enter API Key:** Paste your Fireworks AI API key into the "Fireworks AI API Key" field.
4. **Model Selection:** The default model (Kimi K2) is automatically selected. You can change it from the model dropdown if needed.

---

## Model Selection Guide

Choose models based on your needs:

| Model           | Best For                            | Context | Price           |
| --------------- | ----------------------------------- | ------- | --------------- |
| **Kimi K2**     | General tasks, balanced performance | 128K    | Mid-range       |
| **Qwen3 235B**  | Cost-effective general use          | 256K    | Budget-friendly |
| **Qwen3 Coder** | Code generation and debugging       | 256K    | Mid-range       |
| **DeepSeek R1** | Complex reasoning, function calling | 160K    | Premium         |
| **DeepSeek V3** | Strong general performance          | 128K    | Balanced        |

---

## Tips and Notes

- **Cost-Effective:** Fireworks AI offers significantly lower pricing than proprietary models while maintaining competitive performance.
- **Large Context Windows:** Most models support 128K-256K tokens, suitable for processing large documents and maintaining extended conversations.
- **OpenAI Compatibility:** The provider uses an OpenAI-compatible API format with streaming support and usage tracking.
- **Rate Limits:** Fireworks AI has usage-based rate limits. Monitor your usage in the dashboard and consider upgrading your plan if needed.
- **Text-Only:** All models are text-only without image support or prompt caching capabilities.
- **Default Temperature:** Uses 0.5 temperature by default for balanced creativity and consistency.
- **API Keys:** Stored locally on your machine for security.
- **Pricing:** See the [Fireworks AI pricing page](https://fireworks.ai/pricing) for current rates. Prices shown are per million tokens.
