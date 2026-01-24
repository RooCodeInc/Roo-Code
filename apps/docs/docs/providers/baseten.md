---
title: Baseten
sidebar_label: Baseten
description: Learn how to configure and use Baseten's Model APIs with Roo Code. Access frontier open-source models with enterprise-grade performance, reliability, and competitive pricing.
keywords:
    - Baseten
    - Model APIs
    - open-source models
    - DeepSeek
    - Kimi K2
    - Qwen
    - Roo Code
    - AI integration
    - API key
    - enterprise inference
---

# Using Baseten With Roo Code

Baseten provides on-demand frontier model APIs designed for production applications, not just experimentation. Built on the Baseten Inference Stack, these APIs deliver optimized inference for leading open-source models from OpenAI, DeepSeek, Moonshot AI, and Alibaba Cloud.

**Website:** [https://www.baseten.co/products/model-apis/](https://www.baseten.co/products/model-apis/)

---

## Getting an API Key

1. **Sign Up/Sign In:** Go to [Baseten](https://www.baseten.co/) and create an account or sign in.

2. **Navigate to API Keys:** Access your dashboard and go to the API Keys section at [https://app.baseten.co/settings/api_keys](https://app.baseten.co/settings/api_keys).

3. **Create a Key:** Generate a new API key. Give it a descriptive name (e.g., "Roo Code").

4. **Copy the Key:** Copy the API key immediately and store it securely.

---

## Available Models

Roo Code supports all models available through Baseten's Model APIs.

For the complete, up-to-date model list and pricing, see [Baseten's Model APIs page](https://www.baseten.co/products/model-apis/).

---

## Configuration in Roo Code

1. **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.

2. **Select Provider:** Choose "Baseten" from the "API Provider" dropdown.

3. **Enter API Key:** Paste your Baseten API key into the "Baseten API Key" field.

4. **Select Model:** Choose your desired model from the "Model" dropdown.

:::warning Kimi K2 Thinking Model
To use the `moonshotai/Kimi-K2-Thinking` model, you must enable native tool calling in the Roo Code settings. This setting allows Roo Code to call the model's tools through their native tool processor and is required for this reasoning model to function properly.
:::

---

## Tips and Notes

- **Pricing:** See the [Baseten Model APIs page](https://www.baseten.co/products/model-apis/) for current pricing information.
