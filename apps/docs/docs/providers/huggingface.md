---
sidebar_label: Hugging Face
description: Connect Roo Code to Hugging Face's inference router for access to open-source LLMs. Choose from multiple inference providers and models like Llama, Mistral, and more.
keywords:
    - hugging face
    - huggingface
    - roo code
    - api provider
    - open source models
    - llama
    - mistral
    - inference router
    - ai models
    - inference providers
image: /img/social-share.jpg
---

# Using Hugging Face With Roo Code

Roo Code integrates with the Hugging Face router to provide access to a curated collection of open-source models optimized for code assistance. The integration allows you to choose from multiple inference providers and automatically selects the best available option.

**Website:** [https://huggingface.co/](https://huggingface.co/)

---

## Getting an API Key

1. **Sign Up/Sign In:** Go to [Hugging Face](https://huggingface.co/) and create an account or sign in.
2. **Navigate to Settings:** Click on your profile picture and select "Settings".
3. **Access Tokens:** Go to the "Access Tokens" section in your settings.
4. **Create Token:** Click "New token" and give it a descriptive name (e.g., "Roo Code").
5. **Set Permissions:** Select "Read" permissions (this is sufficient for Roo Code).
6. **Copy Token:** **Important:** Copy the token immediately. Store it securely.

---

## Supported Models

Roo Code displays models from the 'roocode' collection on Hugging Face, which includes curated open-source models optimized for code assistance. The default model is `meta-llama/Llama-3.3-70B-Instruct` if no model is selected.

Available models are dynamically retrieved from the Hugging Face API. The exact list of models may vary based on availability. Both the model and provider dropdowns are searchable, allowing you to quickly find specific options.

---

## Configuration in Roo Code

1. **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2. **Select Provider:** Choose "Hugging Face" from the "API Provider" dropdown.
3. **Enter API Key:** Paste your Hugging Face API token into the "Hugging Face API Key" field.
4. **Select Model:** Choose your desired model from the "Model" dropdown. The dropdown shows the model count and is searchable.
5. **Choose Inference Provider (Optional):** Select a specific inference provider from the dropdown, or leave it on "Auto" (default) to automatically select the best available provider.

---

## Inference Provider Selection

Hugging Face's router connects to multiple inference providers. You can either:

- **Auto Mode (Default):** Automatically selects the best available provider based on model availability and performance
- **Manual Selection:** Choose a specific provider from the dropdown

The dropdown displays the status of each provider:

- `live` - Provider is operational and available
- `staging` - Provider is in testing phase
- `error` - Provider is currently experiencing issues

Provider names are formatted for better readability in the UI (e.g., "sambanova" appears as "SambaNova").

When you select a specific provider, the model capabilities (max tokens, pricing) will update to reflect that provider's specific configuration. Pricing information is only displayed when a specific provider is selected, not in Auto mode.

---

## Model Information Display

For each selected model, Roo Code displays:

- **Max Output:** The maximum number of tokens the model can generate (varies by provider)
- **Pricing:** Cost per million input and output tokens (displayed only when a specific provider is selected)
- **Image Support:** Currently, all models are shown as text-only. This is a Roo Code implementation limitation, not a restriction of the Hugging Face API.

---

## Available Providers

The list of available providers is dynamic and retrieved from the Hugging Face API. Common providers include:

- **Together AI** - High-performance inference platform
- **Fireworks AI** - Fast and scalable model serving
- **DeepInfra** - Cost-effective GPU infrastructure
- **Hyperbolic** - Optimized inference service
- **Cerebras** - Hardware-accelerated inference

_Note: The providers shown above are examples of commonly available options. The actual list may vary._

---

## Tips and Notes

- **Provider Failover:** When using Auto mode, if the selected provider fails, Hugging Face's infrastructure will automatically try alternative providers
- **Rate Limits:** Different providers may have different rate limits and availability
- **Pricing Variability:** Costs can vary significantly between providers for the same model
- **Model Updates:** The roocode collection is regularly updated with new and improved models
