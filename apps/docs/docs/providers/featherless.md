---
sidebar_label: Featherless AI
description: Configure Featherless AI's open-source models in Roo Code. Access free DeepSeek, Qwen, and other high-performance models through an OpenAI-compatible API.
keywords:
    - featherless
    - featherless ai
    - roo code
    - api provider
    - deepseek
    - qwen
    - free models
    - open source ai
    - reasoning models
    - kimi k2
image: /img/social-share.jpg
---

# Using Featherless AI With Roo Code

Featherless AI provides access to high-performance open-source models including DeepSeek, Qwen, and other large language models. All models are currently free to use, making it an excellent choice for budget-conscious developers.

**Website:** [https://featherless.ai](https://featherless.ai)

---

## Getting an API Key

1. **Sign Up/Sign In:** Go to [Featherless AI](https://featherless.ai). Create an account or sign in.
2. **Navigate to API Keys:** Access the [API keys page](https://featherless.ai/account/api-keys) in your account.
3. **Create a Key:** Generate a new API key. Give it a descriptive name (e.g., "Roo Code").
4. **Copy the Key:** **Important:** Copy the API key immediately. It will only be shown once. Store it securely.

---

## Supported Models

Roo Code supports the following Featherless models:

- `deepseek-ai/DeepSeek-R1-0528` (Default) - DeepSeek R1 reasoning model with `<think>` tag support
- `deepseek-ai/DeepSeek-V3-0324` - DeepSeek V3 model
- `moonshotai/Kimi-K2-Instruct` - Kimi K2 instruction-following model
- `openai/gpt-oss-120b` - GPT-OSS 120B parameter model
- `Qwen/Qwen3-Coder-480B-A35B-Instruct` - Qwen3 specialized coding model

### Model Capabilities

All models support:

- **Context Window:** ~32,678 tokens
- **Max Output:** 4,096 tokens
- **Pricing:** Free (no cost for input/output tokens)

:::info
**DeepSeek R1 Models:** The DeepSeek R1 models (like `DeepSeek-R1-0528`) include special reasoning capabilities with `<think>` tag support for step-by-step problem solving. These models automatically separate reasoning from regular output.
:::

---

## Configuration in Roo Code

1. **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2. **Select Provider:** Choose "Featherless AI" from the "API Provider" dropdown.
3. **Enter API Key:** Paste your Featherless API key into the "Featherless API Key" field.
4. **Select Model:** Choose your desired model from the "Model" dropdown.

---

## Tips and Notes

- **Free Tier:** All models are currently free with no usage costs, making Featherless ideal for experimentation and development.
- **Model Selection:** Choose models based on your needs:
    - **DeepSeek R1 models:** Best for complex reasoning and problem-solving tasks
    - **DeepSeek V3:** General-purpose model for various tasks
    - **Qwen3 Coder:** Optimized for code generation and programming tasks
    - **Kimi K2:** Balanced instruction-following model
    - **GPT-OSS:** Large general-purpose model
- **OpenAI Compatibility:** Featherless uses an OpenAI-compatible API format for easy integration.
- **Limitations:** No image support or prompt caching available on any model.
