---
sidebar_label: DeepInfra
description: Configure DeepInfra's high-performance AI models in Roo Code. Access Qwen Coder, Llama, and other open-source models with prompt caching and vision capabilities.
keywords:
    - deepinfra
    - deep infra
    - roo code
    - api provider
    - qwen coder
    - llama models
    - prompt caching
    - vision models
    - open source ai
image: /img/social-share.jpg
---

# Using DeepInfra With Roo Code

DeepInfra provides cost-effective access to high-performance open-source models with features like prompt caching, vision support, and specialized coding models. Their infrastructure offers low latency and automatic load balancing across global edge locations.

**Website:** [https://deepinfra.com/](https://deepinfra.com/)

---

## Getting an API Key

1. **Sign Up/Sign In:** Go to [DeepInfra](https://deepinfra.com/). Create an account or sign in.
2. **Navigate to API Keys:** Access the API keys section in your dashboard.
3. **Create a Key:** Generate a new API key. Give it a descriptive name (e.g., "Roo Code").
4. **Copy the Key:** **Important:** Copy the API key immediately. Store it securely.

---

## Supported Models

Roo Code dynamically fetches available models from DeepInfra's API. The default model is:

- `Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo` (256K context, optimized for coding)

Common models available include:

- **Coding Models:** Qwen Coder series, specialized for programming tasks
- **General Models:** Llama 3.1, Mixtral, and other open-source models
- **Vision Models:** Models with image understanding capabilities
- **Reasoning Models:** Models with advanced reasoning support

Browse the full catalog at [deepinfra.com/models](https://deepinfra.com/models).

---

## Configuration in Roo Code

1. **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2. **Select Provider:** Choose "DeepInfra" from the "API Provider" dropdown.
3. **Enter API Key:** Paste your DeepInfra API key into the "DeepInfra API Key" field.
4. **Select Model:** Choose your desired model from the "Model" dropdown.
    - Models will auto-populate after entering a valid API key
    - Click "Refresh Models" to update the list

---

## Advanced Features

### Prompt Caching

DeepInfra supports prompt caching for eligible models, which:

- Reduces costs for repeated contexts
- Improves response times for similar queries
- Automatically manages cache based on task IDs

### Vision Support

Models with vision capabilities can:

- Process images alongside text
- Understand visual content for coding tasks
- Analyze screenshots and diagrams

### Custom Base URL

For enterprise deployments, you can configure a custom base URL in the advanced settings.

---

## Tips and Notes

- **Performance:** DeepInfra offers low latency with automatic load balancing across global locations.
- **Cost Efficiency:** Competitive pricing with prompt caching to reduce costs for repeated contexts.
- **Model Variety:** Access to the latest open-source models including specialized coding models.
- **Context Windows:** Models support context windows up to 256K tokens for large codebases.
- **Pricing:** Pay-per-use model with no minimums. Check [deepinfra.com](https://deepinfra.com/) for current pricing.
